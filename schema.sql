-- 오늘의 별 1단계 / Supabase SQL Editor에서 전체 실행
begin;
-- Student passwords are stored as bcrypt hashes outside the snapshot JSONB.
create extension if not exists pgcrypto;
create table if not exists public.startoday_classes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 revision bigint not null default 0, created_at timestamptz not null default now(), unique(owner_id)
);
alter table public.startoday_classes enable row level security;
drop policy if exists own_class on public.startoday_classes;
create policy own_class on public.startoday_classes for select to authenticated using(owner_id=auth.uid());
create table if not exists public.startoday_backups (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),class_id uuid not null references public.startoday_classes(id),data jsonb not null,created_at timestamptz not null default now()
);
alter table public.startoday_backups enable row level security;
drop policy if exists own_backups on public.startoday_backups;
create policy own_backups on public.startoday_backups for select to authenticated using(owner_id=auth.uid());
create table if not exists public.startoday_audit (
 id bigint generated always as identity primary key,owner_id uuid not null,class_id uuid not null,revision bigint not null,table_name text not null,row_id text not null,operation text not null,created_at timestamptz not null default now()
);
alter table public.startoday_audit enable row level security;
drop policy if exists own_audit on public.startoday_audit;
create policy own_audit on public.startoday_audit for select to authenticated using(owner_id=auth.uid());
-- 각 기능은 독립 테이블, 필드는 data(JSONB) 내부에 보관합니다.
-- owner_id/class_id는 DB가 강제하며, 브라우저에서 전달하는 값에 의존하지 않습니다.
do $$ declare t text; begin
 foreach t in array array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas','surveys','survey_responses'] loop
 execute format('create table if not exists public.%I (class_id uuid not null references public.startoday_classes(id),owner_id uuid not null references auth.users(id),id text not null,data jsonb not null check(jsonb_typeof(data)=''object'' and data->>''id''=id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(class_id,id))','startoday_'||t);
 execute format('alter table public.%I enable row level security','startoday_'||t);
 execute format('drop policy if exists own_rows on public.%I','startoday_'||t);
 execute format('create policy own_rows on public.%I for select to authenticated using(owner_id=auth.uid())','startoday_'||t);
 execute format('revoke all on public.%I from anon,authenticated','startoday_'||t);
 execute format('grant select on public.%I to authenticated','startoday_'||t);
 end loop;
end $$;
-- Survey columns mirror JSONB so the versioned teacher commit/backup path stays atomic.
alter table public.startoday_surveys add column if not exists title text not null default '',add column if not exists status text not null default 'open' check(status in ('open','closed')),add column if not exists closed_at timestamptz;
alter table public.startoday_survey_responses add column if not exists survey_id text not null,add column if not exists student_id text not null,add column if not exists placements jsonb not null,add column if not exists submitted_at timestamptz not null default now();
create unique index if not exists startoday_one_open_survey on public.startoday_surveys(class_id) where status='open';
create unique index if not exists startoday_survey_one_response on public.startoday_survey_responses(survey_id,student_id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='startoday_response_survey_fk') then alter table public.startoday_survey_responses add constraint startoday_response_survey_fk foreign key(class_id,survey_id) references public.startoday_surveys(class_id,id) deferrable initially deferred;end if;
end $$;
-- Optional JSONB reason-tag catalog; no table/column migration is required.
create or replace function public.startoday_survey_reason_tags(p_config jsonb default null)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare config jsonb:=p_config;result jsonb:='{}'::jsonb;grp text;labels jsonb;
begin
 if config is null or config='null'::jsonb then
  config:='{"comfortable":["어렸을 때부터 친구였다","학원·방과후를 같이 다닌다","같이 놀면 재밌다","말이 잘 통한다","친절하고 잘 도와준다","같은 모둠·짝 활동이 편하다"],"uncomfortable":["장난을 많이 친다","놀리거나 기분 나쁜 말을 한다","화를 잘 내거나 까칠하다","같이 있으면 어색하다","예전에 다툰 적이 있다","아직 이야기를 많이 못 해 봤다"]}'::jsonb;
 end if;
 if jsonb_typeof(config) is distinct from 'object' then raise exception 'INVALID_SURVEY_REASON_TAGS';end if;
 foreach grp in array array['comfortable','uncomfortable'] loop
  if jsonb_typeof(config->grp) is distinct from 'array' then raise exception 'INVALID_SURVEY_REASON_TAGS';end if;
  if jsonb_array_length(config->grp)>20 or exists(select 1 from jsonb_array_elements(config->grp) x where jsonb_typeof(x) is distinct from 'string' or length(btrim(x#>>'{}')) not between 1 and 80) then raise exception 'INVALID_SURVEY_REASON_TAGS';end if;
  select coalesce(jsonb_agg(btrim(value#>>'{}') order by ordinal),'[]'::jsonb) into labels from jsonb_array_elements(config->grp) with ordinality x(value,ordinal);
  result:=result||jsonb_build_object(grp,labels);
 end loop;
 labels:=(result->'comfortable')||(result->'uncomfortable');
 if (select count(distinct value) from jsonb_array_elements(labels))<>jsonb_array_length(labels) then raise exception 'INVALID_SURVEY_REASON_TAGS';end if;
 return result;
end $$;
revoke all on function public.startoday_survey_reason_tags(jsonb) from public,anon,authenticated;
create or replace function public.startoday_survey_columns() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare placement jsonb;
begin
 if tg_table_name='startoday_surveys' then
  if jsonb_typeof(new.data->'title') is distinct from 'string' or length(btrim(new.data->>'title')) not between 1 and 100 or coalesce(new.data->>'status','') not in ('open','closed') then raise exception 'INVALID_SURVEY';end if;
  if new.data ? 'reasonTags' then perform public.startoday_survey_reason_tags(new.data->'reasonTags');end if;
  if tg_op='UPDATE' and old.status='closed' and new.data is distinct from old.data then raise exception 'SURVEY_IMMUTABLE';end if;
  new.title:=new.data->>'title';new.status:=new.data->>'status';new.created_at:=coalesce((new.data->>'createdAt')::timestamptz,new.created_at);new.closed_at:=case when new.status='closed' then coalesce((new.data->>'closedAt')::timestamptz,now()) end;
 else
  if jsonb_typeof(new.data->'placements') is distinct from 'array' or jsonb_array_length(new.data->'placements')>500 or exists(select 1 from jsonb_array_elements(new.data->'placements') p where jsonb_typeof(p->'x') is distinct from 'number' or jsonb_typeof(p->'y') is distinct from 'number' or jsonb_typeof(p->'targetId') is distinct from 'string' or jsonb_typeof(p->'reason') is distinct from 'string') then raise exception 'INVALID_PLACEMENTS';end if;
  if exists(select 1 from jsonb_array_elements(new.data->'placements') p where (p->>'x')::numeric not between 0 and 100 or (p->>'y')::numeric not between 0 and 100 or length(p->>'reason')>300) then raise exception 'INVALID_PLACEMENTS';end if;
  for placement in select * from jsonb_array_elements(new.data->'placements') loop
   if placement ? 'tags' and placement->'tags'<>'null'::jsonb then
    if jsonb_typeof(placement->'tags') is distinct from 'array' then raise exception 'INVALID_SURVEY_TAGS';end if;
    if jsonb_array_length(placement->'tags')>40 or exists(select 1 from jsonb_array_elements(placement->'tags') tag where jsonb_typeof(tag) is distinct from 'string' or length(btrim(tag#>>'{}')) not between 1 and 80) or (select count(distinct value) from jsonb_array_elements(placement->'tags'))<>jsonb_array_length(placement->'tags') then raise exception 'INVALID_SURVEY_TAGS';end if;
   end if;
  end loop;
  new.survey_id:=new.data->>'surveyId';new.student_id:=new.data->>'studentId';new.placements:=new.data->'placements';new.submitted_at:=coalesce((new.data->>'submittedAt')::timestamptz,now());
 end if;
 return new;
end $$;
drop trigger if exists survey_columns on public.startoday_surveys;
create trigger survey_columns before insert or update on public.startoday_surveys for each row execute function public.startoday_survey_columns();
drop trigger if exists response_columns on public.startoday_survey_responses;
create trigger response_columns before insert or update on public.startoday_survey_responses for each row execute function public.startoday_survey_columns();
revoke all on function public.startoday_survey_columns() from public,anon,authenticated;
create unique index if not exists startoday_unique_assignment_state on public."startoday_assignmentStates"(class_id,(data->>'assignmentId'),(data->>'date'),(data->>'studentId'));
create unique index if not exists startoday_unique_routine_state on public."startoday_routineStates"(class_id,(data->>'routineId'),(data->>'date'),(data->>'studentId'));
create unique index if not exists startoday_unique_auto_record on public.startoday_records(class_id,(data->>'autoRef')) where data->>'autoRef' is not null;
create index if not exists startoday_record_date on public.startoday_records(class_id,(data->>'date'));
-- Economy data remains class-scoped; students have no direct table access.
create table if not exists public.startoday_shop_items (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),class_id uuid not null references public.startoday_classes(id),
 data jsonb not null check(data ?& array['id','name','price','stock'] and jsonb_typeof(data)='object' and data->>'id'=id::text and length(btrim(data->>'name'))>0 and jsonb_typeof(data->'price')='number' and (data->>'price')::numeric between 0 and 1000000000 and (data->>'price')::numeric=trunc((data->>'price')::numeric) and (data->'stock'='null'::jsonb or jsonb_typeof(data->'stock')='number' and (data->>'stock')::numeric between 0 and 1000000000 and (data->>'stock')::numeric=trunc((data->>'stock')::numeric))),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(class_id,id)
);
create table if not exists public.startoday_economy_tx (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),class_id uuid not null references public.startoday_classes(id),student_id text not null,
 data jsonb not null check(data ?& array['id','studentId','type','amount','createdAt'] and jsonb_typeof(data)='object' and data->>'id'=id::text and data->>'studentId'=student_id and data->>'type' in ('구매','환불','선물','지급','차감','회수','선물취소','사용','아바타구매','예금가입','예금만기','주식매수','주식매도','주식정산') and jsonb_typeof(data->'amount')='number' and abs((data->>'amount')::numeric)<=1000000000 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric)),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(class_id,id)
);
-- Extend the existing ledger without rewriting historical transactions.
alter table public.startoday_economy_tx drop constraint if exists startoday_economy_tx_check;
alter table public.startoday_economy_tx drop constraint if exists startoday_economy_tx_data_check;
alter table public.startoday_economy_tx add constraint startoday_economy_tx_data_check check(data ?& array['id','studentId','type','amount','createdAt'] and jsonb_typeof(data)='object' and data->>'id'=id::text and data->>'studentId'=student_id and data->>'type' in ('구매','환불','선물','지급','차감','회수','선물취소','사용','아바타구매','예금가입','예금만기','주식매수','주식매도','주식정산') and jsonb_typeof(data->'amount')='number' and abs((data->>'amount')::numeric)<=1000000000 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric));
do $$ declare t text;begin
 foreach t in array array['shop_items','economy_tx'] loop
 execute format('alter table public.%I enable row level security','startoday_'||t);
 execute format('drop policy if exists own_class on public.%I','startoday_'||t);
 execute format('create policy own_class on public.%I for all to authenticated using(owner_id=auth.uid() and exists(select 1 from public.startoday_classes c where c.id=class_id and c.owner_id=auth.uid())) with check(owner_id=auth.uid() and exists(select 1 from public.startoday_classes c where c.id=class_id and c.owner_id=auth.uid()))','startoday_'||t);
 execute format('revoke all on public.%I from public,anon,authenticated','startoday_'||t);
 execute format('grant select,insert,update on public.%I to authenticated','startoday_'||t);
 end loop;
end $$;
grant delete on public.startoday_shop_items to authenticated;
create index if not exists startoday_economy_student on public.startoday_economy_tx(class_id,student_id);
create unique index if not exists startoday_one_refund on public.startoday_economy_tx(class_id,(data->>'originalTxId')) where data->>'type'='환불';
-- Group-buy metadata mirrors the existing JSONB contract used by backups and clients.
alter table public.startoday_shop_items add column if not exists is_group_buy boolean not null default false;
alter table public.startoday_shop_items add column if not exists group_goal integer not null default 0;
alter table public.startoday_shop_items add column if not exists group_collected integer not null default 0;
alter table public.startoday_shop_items add column if not exists is_funded boolean not null default false;
alter table public.startoday_shop_items add column if not exists is_used boolean not null default false;
create or replace function public.startoday_group_item_sync() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.is_group_buy:=coalesce((new.data->>'isGroupBuy')::boolean,false);
 new.group_goal:=coalesce((new.data->>'groupGoal')::integer,0);
 new.group_collected:=coalesce((new.data->>'groupCollected')::integer,0);
 new.is_funded:=coalesce((new.data->>'isFunded')::boolean,false);
 new.is_used:=coalesce((new.data->>'isUsed')::boolean,false);
 if new.is_group_buy then
  if jsonb_typeof(new.data->'groupGoal') is distinct from 'number' or (new.data->>'groupGoal')::numeric<>trunc((new.data->>'groupGoal')::numeric) or jsonb_typeof(new.data->'groupCollected') is distinct from 'number' or (new.data->>'groupCollected')::numeric<>trunc((new.data->>'groupCollected')::numeric) then raise exception 'INVALID_GROUP_BUY';end if;
  if new.group_goal not between 1 and 1000000000 or new.group_collected not between 0 and new.group_goal or new.is_funded is distinct from (new.group_collected=new.group_goal) or new.is_used and not new.is_funded or new.data->'stock' is distinct from 'null'::jsonb or (new.data->>'price')::numeric<>new.group_goal then raise exception 'INVALID_GROUP_BUY';end if;
 elsif new.group_collected<>0 or new.is_funded or new.is_used then raise exception 'INVALID_GROUP_BUY';end if;
 if TG_OP='UPDATE' and old.group_collected>0 then
  if not new.is_group_buy or new.group_collected<old.group_collected or old.is_funded and (not new.is_funded or new.group_goal<>old.group_goal) or old.is_used and not new.is_used then raise exception 'GROUP_BUY_HAS_CONTRIBUTIONS';end if;
 end if;
 return new;
end $$;
revoke all on function public.startoday_group_item_sync() from public,anon,authenticated;
drop trigger if exists startoday_group_item_sync on public.startoday_shop_items;
create trigger startoday_group_item_sync before insert or update on public.startoday_shop_items for each row execute function public.startoday_group_item_sync();
update public.startoday_shop_items set data=data where coalesce((data->>'isGroupBuy')::boolean,false) and not is_group_buy;
create table if not exists public.startoday_group_buy_contribs (
 class_id uuid not null references public.startoday_classes(id), owner_id uuid not null references auth.users(id),
 id text not null, item_id uuid not null, student_id text not null, amount integer not null check(amount between 1 and 1000000000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'id'=id),
 primary key(class_id,id), unique(class_id,item_id,student_id),
 foreign key(class_id,item_id) references public.startoday_shop_items(class_id,id) deferrable initially deferred,
 foreign key(class_id,student_id) references public.startoday_students(class_id,id) deferrable initially deferred
);
create or replace function public.startoday_group_contrib_sync() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.item_id:=(new.data->>'itemId')::uuid;new.student_id:=new.data->>'studentId';
 if jsonb_typeof(new.data->'amount') is distinct from 'number' or (new.data->>'amount')::numeric<>trunc((new.data->>'amount')::numeric) then raise exception 'INVALID_AMOUNT';end if;
 new.amount:=(new.data->>'amount')::integer;
 new.created_at:=(new.data->>'createdAt')::timestamptz;new.updated_at:=(new.data->>'updatedAt')::timestamptz;
 if new.id<>new.item_id::text||':'||new.student_id then raise exception 'INVALID_CONTRIBUTION_ID';end if;
 return new;
end $$;
revoke all on function public.startoday_group_contrib_sync() from public,anon,authenticated;
drop trigger if exists startoday_group_contrib_sync on public.startoday_group_buy_contribs;
create trigger startoday_group_contrib_sync before insert or update on public.startoday_group_buy_contribs for each row execute function public.startoday_group_contrib_sync();
alter table public.startoday_group_buy_contribs enable row level security;
drop policy if exists own_rows on public.startoday_group_buy_contribs;
create policy own_rows on public.startoday_group_buy_contribs for select to authenticated using(owner_id=auth.uid());
revoke all on public.startoday_group_buy_contribs from public,anon,authenticated;
grant select on public.startoday_group_buy_contribs to authenticated;
-- Check final transaction state so backup batches and atomic funding both remain valid.
create or replace function public.startoday_group_buy_integrity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid;target uuid;item public.startoday_shop_items;contributed bigint;
begin
 cid:=coalesce(new.class_id,old.class_id);
 if TG_TABLE_NAME='startoday_shop_items' then target:=coalesce(new.id,old.id);else target:=coalesce(new.item_id,old.item_id);end if;
 select * into item from public.startoday_shop_items where class_id=cid and id=target;
 select coalesce(sum(amount),0) into contributed from public.startoday_group_buy_contribs where class_id=cid and item_id=target;
 if contributed>0 and (item.id is null or not item.is_group_buy) or item.is_group_buy and contributed<>item.group_collected then raise exception 'GROUP_BUY_TOTAL_MISMATCH';end if;
 return null;
end $$;
revoke all on function public.startoday_group_buy_integrity() from public,anon,authenticated;
drop trigger if exists startoday_group_buy_integrity on public.startoday_shop_items;
create constraint trigger startoday_group_buy_integrity after insert or update or delete on public.startoday_shop_items deferrable initially deferred for each row execute function public.startoday_group_buy_integrity();
drop trigger if exists startoday_group_buy_integrity on public.startoday_group_buy_contribs;
create constraint trigger startoday_group_buy_integrity after insert or update or delete on public.startoday_group_buy_contribs deferrable initially deferred for each row execute function public.startoday_group_buy_integrity();
-- Bank and stock state is authoritative: teachers read it, students use authenticated RPCs only.
create table if not exists public.startoday_bank_deposits (
 id uuid primary key, class_id uuid not null references public.startoday_classes(id), owner_id uuid not null references auth.users(id), student_id text not null,
 principal integer not null check(principal between 1 and 100000000), weeks integer not null check(weeks between 2 and 52 and weeks%2=0), rate_percent numeric(5,2) not null check(rate_percent between 0 and 100),
 interest integer not null check(interest>=0 and principal+interest<=1000000000), paid_interest integer not null default 0 check(paid_interest>=0),
 created_at timestamptz not null default now(), matures_at timestamptz not null, status text not null default 'active' check(status in ('active','matured')), settled_at timestamptz,
 foreign key(class_id,student_id) references public.startoday_students(class_id,id)
);
create table if not exists public.startoday_stock_quotes (
 id text primary key, class_id uuid references public.startoday_classes(id), symbol text not null check(symbol ~ '^[A-Z0-9][A-Z0-9.\^-]{0,19}$'), name text not null check(length(btrim(name)) between 1 and 80),
 price_krw numeric(18,4) not null check(price_krw>0 and price_krw<=1000000000), change_krw numeric(18,4) not null default 0, change_percent numeric(12,4) not null default 0,
 updated_at timestamptz not null default now(), source text not null default 'market' check(source in ('market','manual')),
 check(id=coalesce(class_id::text,'market')||':'||symbol),check((class_id is null and source='market') or (class_id is not null and source='manual'))
);
create table if not exists public.startoday_stock_holdings (
 class_id uuid not null references public.startoday_classes(id), owner_id uuid not null references auth.users(id), student_id text not null, symbol text not null,
 shares numeric(14,4) not null default 0 check(shares>=0), avg_price_krw numeric(18,4) not null default 0 check(avg_price_krw>=0), total_buy_points bigint not null default 0 check(total_buy_points>=0),
 primary key(class_id,student_id,symbol), foreign key(class_id,student_id) references public.startoday_students(class_id,id)
);
create table if not exists public.startoday_stock_orders (
 id uuid primary key, class_id uuid not null references public.startoday_classes(id), owner_id uuid not null references auth.users(id), student_id text not null, symbol text not null,
 side text not null check(side in ('buy','sell')), price_krw numeric(18,4) not null check(price_krw>0 and price_krw<=1000000000), shares numeric(14,4) not null check(shares>0),
 amount_points integer not null check(amount_points between 1 and 1000000000), requested_points integer, krw_per_point integer not null check(krw_per_point between 1 and 1000000),
 created_at timestamptz not null default now(),settle_at timestamptz not null,status text not null default 'pending' check(status in ('pending','settled')),settled_at timestamptz,
 foreign key(class_id,student_id) references public.startoday_students(class_id,id)
);
create index if not exists startoday_due_deposits on public.startoday_bank_deposits(class_id,matures_at) where status='active';
create index if not exists startoday_due_orders on public.startoday_stock_orders(class_id,settle_at) where status='pending';
create index if not exists startoday_bank_student on public.startoday_bank_deposits(class_id,student_id,created_at desc);
create index if not exists startoday_order_student on public.startoday_stock_orders(class_id,student_id,created_at desc);
create index if not exists startoday_quote_symbol on public.startoday_stock_quotes(symbol,updated_at desc);
do $$ declare t text;begin
 foreach t in array array['bank_deposits','stock_holdings','stock_orders'] loop
  execute format('alter table public.%I enable row level security','startoday_'||t);
  execute format('drop policy if exists own_finance on public.%I','startoday_'||t);
  execute format('create policy own_finance on public.%I for select to authenticated using(owner_id=auth.uid() and exists(select 1 from public.startoday_classes c where c.id=class_id and c.owner_id=auth.uid()))','startoday_'||t);
  execute format('revoke all on public.%I from public,anon,authenticated','startoday_'||t);
  execute format('grant select on public.%I to authenticated','startoday_'||t);
 end loop;
end $$;
alter table public.startoday_stock_quotes enable row level security;
drop policy if exists read_quotes on public.startoday_stock_quotes;
create policy read_quotes on public.startoday_stock_quotes for select to authenticated using(class_id is null or exists(select 1 from public.startoday_classes c where c.id=class_id and c.owner_id=auth.uid()));
revoke all on public.startoday_stock_quotes from public,anon,authenticated;
grant select on public.startoday_stock_quotes to authenticated;
-- Supabase's service role is used by the trusted GitHub Actions cache worker, never in the app.
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant select,insert,update on public.startoday_stock_quotes to service_role;grant select on public.startoday_settings,public.startoday_stock_holdings to service_role;end if;end $$;

create or replace function public.startoday_finance_config(config jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare bank jsonb:=coalesce(nullif(config->'bankConfig','null'::jsonb),'{"tiers":[{"minStars":0,"ratePercent":2},{"minStars":10,"ratePercent":3},{"minStars":30,"ratePercent":4},{"minStars":50,"ratePercent":5}]}'::jsonb);
 stock jsonb:='{"open":"09:00","close":"14:30","krwPerPoint":100,"settlementMinutes":80,"symbols":[{"symbol":"005930.KS","name":"삼성전자"},{"symbol":"000660.KS","name":"SK하이닉스"},{"symbol":"035420.KS","name":"NAVER"}]}'::jsonb||coalesce(nullif(config->'stockConfig','null'::jsonb),'{}'::jsonb);t jsonb;
begin
 if jsonb_typeof(bank->'tiers') is distinct from 'array' or jsonb_array_length(bank->'tiers') not between 1 and 20 then raise exception 'INVALID_FINANCE_CONFIG';end if;
 for t in select * from jsonb_array_elements(bank->'tiers') loop
  if jsonb_typeof(t->'minStars') is distinct from 'number' or (t->>'minStars')::numeric not between 0 and 1000000 or (t->>'minStars')::numeric<>trunc((t->>'minStars')::numeric) or jsonb_typeof(t->'ratePercent') is distinct from 'number' or (t->>'ratePercent')::numeric not between 0 and 100 or (t->>'ratePercent')::numeric<>round((t->>'ratePercent')::numeric,2) then raise exception 'INVALID_FINANCE_CONFIG';end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(bank->'tiers') x where (x->>'minStars')::integer=0) or (select count(distinct value->>'minStars') from jsonb_array_elements(bank->'tiers'))<>jsonb_array_length(bank->'tiers') then raise exception 'INVALID_FINANCE_CONFIG';end if;
 if coalesce(stock->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(stock->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or stock->>'open'>=stock->>'close' or jsonb_typeof(stock->'krwPerPoint') is distinct from 'number' or (stock->>'krwPerPoint')::numeric not between 1 and 1000000 or (stock->>'krwPerPoint')::numeric<>trunc((stock->>'krwPerPoint')::numeric) or jsonb_typeof(stock->'settlementMinutes') is distinct from 'number' or (stock->>'settlementMinutes')::numeric not between 0 and 10080 or (stock->>'settlementMinutes')::numeric<>trunc((stock->>'settlementMinutes')::numeric) or jsonb_typeof(stock->'symbols') is distinct from 'array' or jsonb_array_length(stock->'symbols')>40 then raise exception 'INVALID_FINANCE_CONFIG';end if;
 for t in select * from jsonb_array_elements(stock->'symbols') loop
  if coalesce(t->>'symbol','') !~ '^[A-Z0-9][A-Z0-9.\^-]{0,19}$' or jsonb_typeof(t->'name') is distinct from 'string' or length(btrim(t->>'name')) not between 1 and 80 then raise exception 'INVALID_FINANCE_CONFIG';end if;
 end loop;
 if (select count(distinct value->>'symbol') from jsonb_array_elements(stock->'symbols'))<>jsonb_array_length(stock->'symbols') then raise exception 'INVALID_FINANCE_CONFIG';end if;
 return jsonb_build_object('bank',jsonb_build_object('tiers',(select jsonb_agg(jsonb_build_object('minStars',tier_row->'minStars','ratePercent',tier_row->'ratePercent') order by (tier_row->>'minStars')::integer) from jsonb_array_elements(bank->'tiers') tier_row)),'stock',jsonb_build_object('open',stock->'open','close',stock->'close','krwPerPoint',stock->'krwPerPoint','settlementMinutes',stock->'settlementMinutes','symbols',(select coalesce(jsonb_agg(jsonb_build_object('symbol',symbol_row->'symbol','name',symbol_row->'name')),'[]'::jsonb) from jsonb_array_elements(stock->'symbols') symbol_row)));
end $$;
create or replace function public.startoday_finance_settings_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$begin perform public.startoday_finance_config(new.data);return new;end $$;
drop trigger if exists finance_settings_guard on public.startoday_settings;
create trigger finance_settings_guard before insert or update on public.startoday_settings for each row execute function public.startoday_finance_settings_guard();
create or replace function public.startoday_stock_market_open(config jsonb,stamp timestamptz) returns boolean language sql immutable set search_path=public,pg_temp as $$
 select extract(isodow from stamp at time zone 'Asia/Seoul') between 1 and 5 and to_char(stamp at time zone 'Asia/Seoul','HH24:MI') between config->>'open' and config->>'close'
$$;
create or replace function public.startoday_finance_tx(cid uuid,sid text,kind text,amount integer,ref uuid,memo text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid:=gen_random_uuid();owner uuid;
begin
 select owner_id into strict owner from public.startoday_classes where id=cid;
 insert into public.startoday_economy_tx(id,owner_id,class_id,student_id,data) values(tid,owner,cid,sid,jsonb_build_object('id',tid,'studentId',sid,'type',kind,'amount',amount,'originalTxId',ref,'memo',memo,'createdAt',clock_timestamp()));
end $$;
alter table public.startoday_economy_tx drop constraint if exists startoday_finance_tx_sign;
alter table public.startoday_economy_tx add constraint startoday_finance_tx_sign check(case when data->>'type' in ('예금가입','주식매수') then (data->>'amount')::integer<0 when data->>'type' in ('예금만기','주식정산') then (data->>'amount')::integer>=0 when data->>'type'='주식매도' then (data->>'amount')::integer=0 else true end);
create unique index if not exists startoday_finance_tx_once on public.startoday_economy_tx(class_id,(data->>'type'),(data->>'originalTxId')) where data->>'type' in ('예금가입','예금만기','주식매수','주식매도','주식정산');
create or replace function public.startoday_finance_settle(cid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;d public.startoday_bank_deposits;o public.startoday_stock_orders;changed boolean:=false;stamp timestamptz:=clock_timestamp();
begin
 select * into strict c from public.startoday_classes where id=cid for update;
 for d in select * from public.startoday_bank_deposits where class_id=cid and status='active' and matures_at<=stamp order by matures_at,id for update loop
  perform public.startoday_finance_tx(cid,d.student_id,'예금만기',d.principal+d.interest,d.id,'정기예금 만기');
  update public.startoday_bank_deposits set status='matured',paid_interest=interest,settled_at=stamp where id=d.id;changed:=true;
 end loop;
 for o in select * from public.startoday_stock_orders where class_id=cid and status='pending' and settle_at<=stamp order by created_at,id for update loop
  if o.side='buy' then
   insert into public.startoday_stock_holdings(class_id,owner_id,student_id,symbol,shares,avg_price_krw,total_buy_points) values(cid,c.owner_id,o.student_id,o.symbol,o.shares,o.price_krw,o.amount_points)
   on conflict(class_id,student_id,symbol) do update set avg_price_krw=round((startoday_stock_holdings.avg_price_krw*startoday_stock_holdings.shares+excluded.avg_price_krw*excluded.shares)/(startoday_stock_holdings.shares+excluded.shares),4),shares=startoday_stock_holdings.shares+excluded.shares,total_buy_points=startoday_stock_holdings.total_buy_points+excluded.total_buy_points;
  end if;
  perform public.startoday_finance_tx(cid,o.student_id,'주식정산',case when o.side='sell' then o.amount_points else 0 end,o.id,o.symbol||case when o.side='sell' then ' 매도 입금' else ' 매수 입고' end);
  update public.startoday_stock_orders set status='settled',settled_at=stamp where id=o.id;changed:=true;
 end loop;
 if changed then
  update public.startoday_classes set revision=revision+1 where id=cid returning * into c;
  insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,c.revision,'finance',cid::text,'settle');
 end if;
end $$;
create or replace function public.startoday_finance_data(cid uuid,sid text default null) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'bank_deposits',coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'principal',principal,'weeks',weeks,'ratePercent',rate_percent,'interest',interest,'paidInterest',paid_interest,'createdAt',created_at,'maturesAt',matures_at,'status',status,'settledAt',settled_at)) from public.startoday_bank_deposits where class_id=cid and (sid is null or student_id=sid)),'[]'::jsonb),
 'stock_holdings',coalesce((select jsonb_agg(jsonb_build_object('id',student_id||':'||symbol,'studentId',student_id,'symbol',symbol,'shares',shares,'avgPriceKrw',avg_price_krw,'totalBuyPoints',total_buy_points)) from public.startoday_stock_holdings where class_id=cid and (sid is null or student_id=sid)),'[]'::jsonb),
 'stock_orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'symbol',symbol,'side',side,'priceKrw',price_krw,'shares',shares,'amountPoints',amount_points,'requestedPoints',requested_points,'krwPerPoint',krw_per_point,'createdAt',created_at,'settleAt',settle_at,'status',status,'settledAt',settled_at)) from public.startoday_stock_orders where class_id=cid and (sid is null or student_id=sid)),'[]'::jsonb),
 'stock_quotes',coalesce((select jsonb_agg(jsonb_build_object('id',symbol,'symbol',symbol,'name',name,'priceKrw',price_krw,'changeKrw',change_krw,'changePercent',change_percent,'updatedAt',updated_at,'source',source)) from (
  select distinct on(q.symbol) q.* from public.startoday_stock_quotes q where (q.class_id is null or q.class_id=cid) and (exists(select 1 from public.startoday_settings s,jsonb_array_elements(public.startoday_finance_config(s.data)->'stock'->'symbols') sym where s.class_id=cid and sym->>'symbol'=q.symbol) or exists(select 1 from public.startoday_stock_holdings h where h.class_id=cid and h.symbol=q.symbol)) order by q.symbol,q.updated_at desc,q.class_id nulls last
 ) effective),'[]'::jsonb))
$$;
create or replace function public.startoday_finance_stars(cid uuid,sid text) returns bigint language sql stable security definer set search_path=public,pg_temp as $$select coalesce((select sum(case when r.data->>'autoRef' is not null then case when a.data->>'noStar'='true' then 0 when ast.data->>'status'='완료' then 1 when ast.data->>'status'='안함' then -1 else 0 end else case r.data->>'kind' when '칭찬' then 1 when '지도' then -1 else 0 end end) from public.startoday_records r left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId' where r.class_id=cid and r.data->'studentIds' ? sid and r.data->>'date'<=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')),0)$$;
create or replace function public.startoday_finance_student_data(cid uuid,sid text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('bankConfig',cfg->'bank','stockConfig',cfg->'stock','stars',public.startoday_finance_stars(cid,sid),'deposits',f->'bank_deposits','holdings',f->'stock_holdings','orders',f->'stock_orders','quotes',f->'stock_quotes') from (select public.startoday_finance_data(cid,sid) f,public.startoday_finance_config(coalesce((select data from public.startoday_settings where class_id=cid and id='main'),'{}'::jsonb)) cfg) x
$$;
create or replace function public.startoday_finance_order(cid uuid,sid text,action text,payload jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;cfg jsonb;bank jsonb;stock jsonb;req uuid;principal integer;weeks integer;rate numeric;interest bigint;stars bigint;
 v_symbol text;quote public.startoday_stock_quotes;qty numeric;amount numeric;h public.startoday_stock_holdings;reserved numeric;stamp timestamptz:=clock_timestamp();rev bigint;
begin
 select * into strict c from public.startoday_classes where id=cid for update;
 if not exists(select 1 from public.startoday_students where class_id=cid and id=sid and data->>'deletedAt' is null) then raise exception 'INVALID_STUDENT';end if;
 perform public.startoday_finance_settle(cid);
 select public.startoday_finance_config(coalesce(data,'{}'::jsonb)) into cfg from public.startoday_settings where class_id=cid and id='main';
 bank:=cfg->'bank';stock:=cfg->'stock';if cfg is null then raise exception 'INVALID_FINANCE_CONFIG';end if;
 if action='refresh' then return;end if;
 req:=(payload->>'requestId')::uuid;if req is null then raise exception 'INVALID_REQUEST_ID';end if;
 -- UUID retry keys are scoped and checked against the original request, never a second debit.
 if exists(select 1 from public.startoday_bank_deposits where id=req) then
  if action<>'deposit' or not exists(select 1 from public.startoday_bank_deposits bd where bd.id=req and bd.class_id=cid and bd.student_id=sid and bd.principal=(payload->>'principal')::numeric and bd.weeks=(payload->>'weeks')::numeric) then raise exception 'REQUEST_CONFLICT';end if;return;
 end if;
 if exists(select 1 from public.startoday_stock_orders where id=req) then
  if action not in ('buy','sell') or not exists(select 1 from public.startoday_stock_orders where id=req and class_id=cid and student_id=sid and side=action and symbol=payload->>'symbol' and ((action='buy' and requested_points=(payload->>'amountPoints')::numeric) or (action='sell' and shares=(payload->>'shares')::numeric))) then raise exception 'REQUEST_CONFLICT';end if;return;
 end if;
 if action='deposit' then
  if jsonb_typeof(payload->'principal') is distinct from 'number' or (payload->>'principal')::numeric<>trunc((payload->>'principal')::numeric) or (payload->>'principal')::numeric not between 1 and 100000000 or jsonb_typeof(payload->'weeks') is distinct from 'number' or (payload->>'weeks')::numeric<>trunc((payload->>'weeks')::numeric) or (payload->>'weeks')::numeric not between 2 and 52 then raise exception 'INVALID_DEPOSIT';end if;
  principal:=(payload->>'principal')::integer;weeks:=(payload->>'weeks')::integer;if weeks%2<>0 then raise exception 'INVALID_DEPOSIT';end if;
  stars:=public.startoday_finance_stars(cid,sid);
  select (t->>'ratePercent')::numeric into rate from jsonb_array_elements(bank->'tiers') t where (t->>'minStars')::integer<=greatest(stars,0) order by (t->>'minStars')::integer desc limit 1;
  interest:=floor(principal::numeric*rate/100*(weeks/2));if principal+interest>1000000000 then raise exception 'AMOUNT_LIMIT';end if;
  if public.startoday_coin_balance(cid,sid)<principal then raise exception 'INSUFFICIENT_BALANCE';end if;
  insert into public.startoday_bank_deposits(id,class_id,owner_id,student_id,principal,weeks,rate_percent,interest,created_at,matures_at) values(req,cid,c.owner_id,sid,principal,weeks,rate,interest,stamp,stamp+weeks*interval '7 days');
  perform public.startoday_finance_tx(cid,sid,'예금가입',-principal,req,'정기예금 '||weeks||'주');
 elsif action in ('buy','sell') then
  if not public.startoday_stock_market_open(stock,stamp) then raise exception 'MARKET_CLOSED';end if;
  v_symbol:=payload->>'symbol';if v_symbol is null or v_symbol !~ '^[A-Z0-9][A-Z0-9.\^-]{0,19}$' then raise exception 'INVALID_SYMBOL';end if;
  if action='buy' and not exists(select 1 from jsonb_array_elements(stock->'symbols') t where t->>'symbol'=v_symbol) then raise exception 'SYMBOL_DISABLED';end if;
  select q.* into quote from public.startoday_stock_quotes q where q.symbol=v_symbol and (q.class_id is null or q.class_id=cid) order by updated_at desc,class_id nulls last limit 1;
  if quote.id is null or quote.updated_at<stamp-interval '30 minutes' or quote.updated_at>stamp+interval '1 minute' then raise exception 'QUOTE_STALE';end if;
  if action='buy' then
   if jsonb_typeof(payload->'amountPoints') is distinct from 'number' or (payload->>'amountPoints')::numeric<>trunc((payload->>'amountPoints')::numeric) or (payload->>'amountPoints')::numeric not between 1 and 1000000000 then raise exception 'INVALID_AMOUNT';end if;
   qty:=floor((payload->>'amountPoints')::numeric*(stock->>'krwPerPoint')::integer/quote.price_krw*10000)/10000;
   amount:=ceil(qty*quote.price_krw/(stock->>'krwPerPoint')::integer);
   select coalesce(sum(o.shares),0) into reserved from public.startoday_stock_orders o where o.class_id=cid and o.student_id=sid and o.symbol=v_symbol and o.side='buy' and o.status='pending';
   if qty+reserved+coalesce((select held.shares from public.startoday_stock_holdings held where held.class_id=cid and held.student_id=sid and held.symbol=v_symbol),0)>9999999999.9999 then raise exception 'SHARE_LIMIT';end if;
   if public.startoday_coin_balance(cid,sid)<amount then raise exception 'INSUFFICIENT_BALANCE';end if;
  else
   if jsonb_typeof(payload->'shares') is distinct from 'number' or (payload->>'shares')::numeric<>trunc((payload->>'shares')::numeric,4) then raise exception 'INVALID_SHARES';end if;
   qty:=(payload->>'shares')::numeric;amount:=floor(qty*quote.price_krw/(stock->>'krwPerPoint')::integer);
   select sh.* into h from public.startoday_stock_holdings sh where sh.class_id=cid and sh.student_id=sid and sh.symbol=v_symbol for update;
   if h.student_id is null or qty>h.shares then raise exception 'INSUFFICIENT_SHARES';end if;
  end if;
  if qty<=0 or qty>9999999999.9999 or amount not between 1 and 1000000000 then raise exception 'INVALID_AMOUNT';end if;
  if action='sell' then update public.startoday_stock_holdings sh set total_buy_points=case when qty=h.shares then 0 else h.total_buy_points-floor(h.total_buy_points*qty/h.shares)::bigint end,avg_price_krw=case when qty=h.shares then 0 else h.avg_price_krw end,shares=h.shares-qty where sh.class_id=cid and sh.student_id=sid and sh.symbol=v_symbol;end if;
  insert into public.startoday_stock_orders(id,class_id,owner_id,student_id,symbol,side,price_krw,shares,amount_points,requested_points,krw_per_point,created_at,settle_at) values(req,cid,c.owner_id,sid,v_symbol,action,quote.price_krw,qty,amount,case when action='buy' then (payload->>'amountPoints')::integer end,(stock->>'krwPerPoint')::integer,stamp,stamp+(stock->>'settlementMinutes')::integer*interval '1 minute');
  perform public.startoday_finance_tx(cid,sid,case when action='buy' then '주식매수' else '주식매도' end,case when action='buy' then -amount::integer else 0 end,req,v_symbol||' 시장가 주문');
 else raise exception 'INVALID_FINANCE_ACTION';end if;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'finance',req::text,action);
 perform public.startoday_finance_settle(cid);
end $$;

create or replace function public.startoday_teacher_finance(p_class_id uuid,p_student_id text default null,p_action text default 'refresh',p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sym text;price numeric;name text;
begin
 if auth.uid() is null or not exists(select 1 from public.startoday_classes where id=p_class_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN';end if;
 if p_action='quote' then
  perform 1 from public.startoday_classes where id=p_class_id for update;
  sym:=p_payload->>'symbol';name:=p_payload->>'name';price:=(p_payload->>'priceKrw')::numeric;
  if sym is null or sym !~ '^[A-Z0-9][A-Z0-9.\^-]{0,19}$' or name is null or length(btrim(name)) not between 1 and 80 or price is null or price<=0 or price>1000000000 or price<>round(price,4) then raise exception 'INVALID_QUOTE';end if;
  insert into public.startoday_stock_quotes(id,class_id,symbol,name,price_krw,source,updated_at) values(p_class_id::text||':'||sym,p_class_id,sym,name,price,'manual',clock_timestamp()) on conflict(id) do update set name=excluded.name,price_krw=excluded.price_krw,change_krw=0,change_percent=0,source='manual',updated_at=excluded.updated_at;
  update public.startoday_classes set revision=revision+1 where id=p_class_id;
 elsif p_action='refresh' then perform public.startoday_finance_settle(p_class_id);
 else perform public.startoday_finance_order(p_class_id,p_student_id,p_action,p_payload);end if;
 return public.startoday_snapshot();
end $$;
create or replace function public.startoday_student_finance(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_action text default 'refresh',p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;cid uuid;sid text;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then raise exception 'AUTH_REQUIRED';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 perform public.startoday_finance_order(cid,sid,p_action,p_payload);
 return jsonb_build_object('classId',cid,'revision',(select revision from public.startoday_classes where id=cid),'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_finance_config(jsonb),public.startoday_finance_settings_guard(),public.startoday_stock_market_open(jsonb,timestamptz),public.startoday_finance_tx(uuid,text,text,integer,uuid,text),public.startoday_finance_settle(uuid),public.startoday_finance_data(uuid,text),public.startoday_finance_stars(uuid,text),public.startoday_finance_student_data(uuid,text),public.startoday_finance_order(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.startoday_teacher_finance(uuid,text,text,jsonb),public.startoday_student_finance(text,text,text,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.startoday_teacher_finance(uuid,text,text,jsonb) to authenticated;
grant execute on function public.startoday_student_finance(text,text,text,integer,text,text,jsonb) to anon,authenticated;


-- 학급회의 원자료는 전용 인증 함수만 읽고 변경합니다.
create table if not exists public.startoday_meeting_officers(
 class_id uuid primary key references public.startoday_classes(id),owner_id uuid not null references auth.users(id),chair_ids jsonb not null default '[]' check(jsonb_typeof(chair_ids)='array'),vice_chair_ids jsonb not null default '[]' check(jsonb_typeof(vice_chair_ids)='array'),updated_at timestamptz not null default now()
);
create table if not exists public.startoday_meeting_topics(
 id uuid primary key,class_id uuid not null references public.startoday_classes(id),owner_id uuid not null references auth.users(id),proposer_id text,
 title text not null check(length(btrim(title)) between 1 and 200),description text not null default '' check(length(description)<=5000),kind text not null check(kind in ('yesno','custom')),options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)>=2),max_choices integer not null check(max_choices>=1 and max_choices<=jsonb_array_length(options)),
 status text not null default 'pending' check(status in ('pending','open','closed','deleted')),approvals jsonb not null default '[]',electorate jsonb not null default '[]',closes_at timestamptz,opened_at timestamptz,closed_at timestamptz,created_at timestamptz not null default now(),unique(class_id,id)
);
create table if not exists public.startoday_meeting_ballots(
 topic_id uuid not null,student_id text not null,class_id uuid not null references public.startoday_classes(id),owner_id uuid not null references auth.users(id),choices jsonb not null check(jsonb_typeof(choices)='array' and jsonb_array_length(choices)>0),created_at timestamptz not null default now(),primary key(topic_id,student_id),foreign key(class_id,topic_id) references public.startoday_meeting_topics(class_id,id),foreign key(class_id,student_id) references public.startoday_students(class_id,id)
);
create table if not exists public.startoday_meeting_minutes(
 id uuid primary key,class_id uuid not null references public.startoday_classes(id),owner_id uuid not null references auth.users(id),data jsonb not null,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists startoday_meeting_topics_class on public.startoday_meeting_topics(class_id,created_at desc);
create index if not exists startoday_meeting_topics_due on public.startoday_meeting_topics(class_id,closes_at) where status='open';
create index if not exists startoday_meeting_minutes_class on public.startoday_meeting_minutes(class_id,updated_at desc);
do $$ declare t text;begin
 foreach t in array array['meeting_officers','meeting_topics','meeting_ballots','meeting_minutes'] loop
  execute format('alter table public.%I enable row level security','startoday_'||t);
  execute format('drop policy if exists meeting_owner on public.%I','startoday_'||t);
  execute format('create policy meeting_owner on public.%I for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())','startoday_'||t);
  execute format('revoke all on public.%I from public,anon,authenticated','startoday_'||t);
 end loop;
end $$;
create or replace function public.startoday_meeting_officers_data(cid uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id','main','chairIds',coalesce((select jsonb_agg(x.value) from public.startoday_meeting_officers o,jsonb_array_elements(o.chair_ids) x where o.class_id=cid and exists(select 1 from public.startoday_students s where s.class_id=cid and s.id=x.value#>>'{}' and s.data->>'deletedAt' is null)),'[]'::jsonb),'viceChairIds',coalesce((select jsonb_agg(x.value) from public.startoday_meeting_officers o,jsonb_array_elements(o.vice_chair_ids) x where o.class_id=cid and exists(select 1 from public.startoday_students s where s.class_id=cid and s.id=x.value#>>'{}' and s.data->>'deletedAt' is null)),'[]'::jsonb))
$$;
create or replace function public.startoday_meeting_close_due(cid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;changed integer;
begin
 select * into strict c from public.startoday_classes where id=cid for update;
 update public.startoday_meeting_topics t set status='closed',closed_at=clock_timestamp() where t.class_id=cid and t.status='open' and (t.closes_at<=clock_timestamp() or jsonb_array_length(t.electorate)>0 and not exists(select 1 from jsonb_array_elements_text(t.electorate) member where not exists(select 1 from public.startoday_meeting_ballots b where b.topic_id=t.id and b.student_id=member)));
 get diagnostics changed=row_count;
 if changed>0 then update public.startoday_classes set revision=revision+1 where id=cid returning * into c;insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,c.revision,'meeting',cid::text,'close_due');end if;
end $$;
create or replace function public.startoday_meeting_topic_card(cid uuid,tid uuid,sid text default null,teacher boolean default false) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'kind',t.kind,'options',t.options,'maxChoices',t.max_choices,'status',t.status,'proposerId',t.proposer_id,'createdAt',t.created_at,'closesAt',t.closes_at,'closedAt',t.closed_at,'participated',(select count(*) from public.startoday_meeting_ballots b where b.topic_id=t.id),'total',case when t.status='pending' then (select count(*) from public.startoday_students s where s.class_id=cid and s.data->>'deletedAt' is null) else jsonb_array_length(t.electorate) end,'hasVoted',exists(select 1 from public.startoday_meeting_ballots b where b.topic_id=t.id and b.student_id=sid),'reviewCount',jsonb_array_length(t.approvals),'reviewTotal',(select count(distinct value) from jsonb_array_elements((public.startoday_meeting_officers_data(cid)->'chairIds')||(public.startoday_meeting_officers_data(cid)->'viceChairIds'))),'reviewed',t.approvals ? sid)
 ||case when teacher or t.status='closed' then jsonb_build_object('results',(select jsonb_agg(opt||jsonb_build_object('count',(select count(*) from public.startoday_meeting_ballots b where b.topic_id=t.id and b.choices ? (opt->>'id'))) order by n) from jsonb_array_elements(t.options) with ordinality x(opt,n))) else '{}'::jsonb end
 from public.startoday_meeting_topics t where t.class_id=cid and t.id=tid
$$;
create or replace function public.startoday_meeting_payload(cid uuid,sid text default null,teacher boolean default false) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('authoritative',true,'isTeacher',teacher,'studentId',sid,'isChair',(public.startoday_meeting_officers_data(cid)->'chairIds') ? sid,'isVice',(public.startoday_meeting_officers_data(cid)->'viceChairIds') ? sid,'officers',public.startoday_meeting_officers_data(cid),
 'roster',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'no',s.data->'no','name',s.data->>'name') order by (s.data->>'no')::integer) from public.startoday_students s where s.class_id=cid and s.data->>'deletedAt' is null),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(public.startoday_meeting_topic_card(cid,t.id,sid,teacher) order by t.created_at desc,t.id) from public.startoday_meeting_topics t where t.class_id=cid and t.status<>'deleted'),'[]'::jsonb),
 'minutes',coalesce((select jsonb_agg(m.data||jsonb_build_object('id',m.id,'version',m.version,'createdAt',m.created_at,'updatedAt',m.updated_at,'participants',(m.data->>'total')::integer-(m.data->>'absent')::integer-(m.data->>'notAttending')::integer,'rate',case when (m.data->>'total')::integer>0 then round(((m.data->>'total')::integer-(m.data->>'absent')::integer-(m.data->>'notAttending')::integer)*100.0/(m.data->>'total')::integer,2) else 0 end,'quorum',(m.data->>'total')::integer>0 and ((m.data->>'total')::integer-(m.data->>'absent')::integer-(m.data->>'notAttending')::integer)*4>=(m.data->>'total')::integer*3,'voteCards',coalesce((select jsonb_agg(coalesce(public.startoday_meeting_topic_card(cid,(card->>'id')::uuid,sid,teacher),case when teacher or card->>'status'='closed' then card else card-'results' end) order by n) from jsonb_array_elements(m.data->'voteCards') with ordinality x(card,n)),'[]'::jsonb)) order by m.data->>'date' desc,m.created_at desc) from public.startoday_meeting_minutes m where m.class_id=cid),'[]'::jsonb))
$$;
create or replace function public.startoday_meeting_option_config(p jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare kind text;opts jsonb;max_choices integer;entry jsonb;
begin
  kind:=p->>'kind';if kind is null or kind not in ('yesno','custom') then raise exception 'MEETING_INVALID_OPTIONS';end if;
  opts:=case when kind='yesno' then '[{"id":"yes","label":"찬성"},{"id":"no","label":"반대"}]'::jsonb else p->'options' end;
  if jsonb_typeof(opts) is distinct from 'array' or jsonb_array_length(opts)<2 then raise exception 'MEETING_INVALID_OPTIONS';end if;
  for entry in select * from jsonb_array_elements(opts) loop
   if jsonb_typeof(entry->'id') is distinct from 'string' or length(entry->>'id') not between 1 and 100 or jsonb_typeof(entry->'label') is distinct from 'string' or length(btrim(entry->>'label')) not between 1 and 200 then raise exception 'MEETING_INVALID_OPTIONS';end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(opts))<>jsonb_array_length(opts) or (select count(distinct btrim(value->>'label')) from jsonb_array_elements(opts))<>jsonb_array_length(opts) then raise exception 'MEETING_INVALID_OPTIONS';end if;
  if kind='custom' and (jsonb_typeof(p->'maxChoices') is distinct from 'number' or (p->>'maxChoices')::numeric<>trunc((p->>'maxChoices')::numeric) or (p->>'maxChoices')::numeric not between 1 and jsonb_array_length(opts)) then raise exception 'MEETING_INVALID_OPTIONS';end if;
  max_choices:=case when kind='yesno' then 1 else (p->>'maxChoices')::integer end;
 select jsonb_agg(jsonb_build_object('id',opt->>'id','label',btrim(opt->>'label')) order by n) into opts from jsonb_array_elements(opts) with ordinality x(opt,n);
 return jsonb_build_object('kind',kind,'options',opts,'maxChoices',max_choices);
end $$;
create or replace function public.startoday_meeting_mutate(cid uuid,sid text,teacher boolean,action text,p jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;o jsonb;members jsonb;chair boolean;vice boolean;t public.startoday_meeting_topics;mid uuid;topic_id uuid;kind text;opts jsonb;max_choices integer;deadline timestamptz;open_now boolean;electors jsonb;labels jsonb;entry jsonb;v_approvals jsonb;rev bigint;old public.startoday_meeting_minutes;total integer;absent integer;nonatt integer;cards jsonb;key text;
begin
 select * into strict c from public.startoday_classes where id=cid for update;
 if not teacher and not exists(select 1 from public.startoday_students where class_id=cid and id=sid and data->>'deletedAt' is null) then raise exception 'MEETING_FORBIDDEN';end if;
 perform public.startoday_meeting_close_due(cid);
 if action='refresh' then return;end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>1000000 then raise exception 'MEETING_INVALID_DATA';end if;
 o:=public.startoday_meeting_officers_data(cid);chair:=coalesce((o->'chairIds') ? sid,false);vice:=coalesce((o->'viceChairIds') ? sid,false);
 select coalesce(jsonb_agg(value),'[]'::jsonb) into members from(select distinct value from jsonb_array_elements((o->'chairIds')||(o->'viceChairIds'))) x;
 if action='officers' then
  if not teacher then raise exception 'MEETING_FORBIDDEN';end if;
  foreach key in array array['chairIds','viceChairIds'] loop
   if jsonb_typeof(p->key) is distinct from 'array' then raise exception 'MEETING_INVALID_OFFICERS';end if;
   if (select count(distinct value) from jsonb_array_elements(p->key))<>jsonb_array_length(p->key) or exists(select 1 from jsonb_array_elements(p->key) x where jsonb_typeof(x)<>'string' or not exists(select 1 from public.startoday_students s where s.class_id=cid and s.id=x#>>'{}' and s.data->>'deletedAt' is null)) then raise exception 'MEETING_INVALID_OFFICERS';end if;
  end loop;
  insert into public.startoday_meeting_officers(class_id,owner_id,chair_ids,vice_chair_ids) values(cid,c.owner_id,p->'chairIds',p->'viceChairIds') on conflict(class_id) do update set chair_ids=excluded.chair_ids,vice_chair_ids=excluded.vice_chair_ids,updated_at=clock_timestamp();
  update public.startoday_meeting_topics set approvals='[]'::jsonb where class_id=cid and status='pending';
 elsif action='propose' then
  topic_id:=(p->>'id')::uuid;if topic_id is null then raise exception 'MEETING_INVALID_TOPIC';end if;
  if jsonb_typeof(p->'title') is distinct from 'string' or length(btrim(p->>'title')) not between 1 and 200 or jsonb_typeof(coalesce(p->'description','""'::jsonb)) is distinct from 'string' or length(coalesce(p->>'description',''))>5000 then raise exception 'MEETING_INVALID_TOPIC';end if;
  entry:=public.startoday_meeting_option_config(p);kind:=entry->>'kind';opts:=entry->'options';max_choices:=(entry->>'maxChoices')::integer;
  deadline:=nullif(p->>'closesAt','')::timestamptz;if deadline is not null and deadline<=clock_timestamp() then raise exception 'MEETING_DEADLINE';end if;
  open_now:=teacher and coalesce(p->>'openNow','false')='true';select coalesce(jsonb_agg(id),'[]'::jsonb) into electors from public.startoday_students where class_id=cid and data->>'deletedAt' is null;
  insert into public.startoday_meeting_topics(id,class_id,owner_id,proposer_id,title,description,kind,options,max_choices,status,electorate,closes_at,opened_at) values(topic_id,cid,c.owner_id,case when teacher then null else sid end,btrim(p->>'title'),coalesce(p->>'description',''),kind,opts,max_choices,case when open_now then 'open' else 'pending' end,case when open_now then electors else '[]'::jsonb end,deadline,case when open_now then clock_timestamp() end);
 elsif action='minutes' then
  if not teacher and not vice then raise exception 'MEETING_FORBIDDEN';end if;
  mid:=(p->>'id')::uuid;if mid is null or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or to_char((p->>'date')::date,'YYYY-MM-DD')<>p->>'date' or jsonb_typeof(p->'content') is distinct from 'string' or length(p->>'content')>100000 then raise exception 'MEETING_INVALID_MINUTES';end if;
  foreach key in array array['moderators','recorders'] loop
   if jsonb_typeof(p->key) is distinct from 'array' then raise exception 'MEETING_INVALID_MINUTES';end if;
   if exists(select 1 from jsonb_array_elements(p->key) n where jsonb_typeof(n)<>'string' or length(btrim(n#>>'{}')) not between 1 and 100) then raise exception 'MEETING_INVALID_MINUTES';end if;
  end loop;
  foreach key in array array['total','absent','notAttending'] loop
   if jsonb_typeof(p->key) is distinct from 'number' or (p->>key)::numeric<>trunc((p->>key)::numeric) or (p->>key)::numeric not between 0 and 10000 then raise exception 'MEETING_INVALID_ATTENDANCE';end if;
  end loop;
  total:=(p->>'total')::integer;absent:=(p->>'absent')::integer;nonatt:=(p->>'notAttending')::integer;if absent+nonatt>total then raise exception 'MEETING_INVALID_ATTENDANCE';end if;
  if jsonb_typeof(p->'voteIds') is distinct from 'array' then raise exception 'MEETING_INVALID_MINUTES';end if;
  if (select count(distinct value) from jsonb_array_elements(p->'voteIds'))<>jsonb_array_length(p->'voteIds') then raise exception 'MEETING_INVALID_MINUTES';end if;
  for entry in select * from jsonb_array_elements(p->'voteIds') loop
   if not exists(select 1 from public.startoday_meeting_topics mt where mt.class_id=cid and mt.id=(entry#>>'{}')::uuid and mt.status in ('open','closed')) then raise exception 'MEETING_INVALID_MINUTES';end if;
  end loop;
  select coalesce(jsonb_agg(public.startoday_meeting_topic_card(cid,(value#>>'{}')::uuid,null,true)),'[]'::jsonb) into cards from jsonb_array_elements(p->'voteIds');
  select * into old from public.startoday_meeting_minutes where class_id=cid and id=mid for update;
  if old.id is not null and (jsonb_typeof(p->'version') is distinct from 'number' or (p->>'version')::numeric is distinct from old.version::numeric) then raise exception 'MEETING_CONFLICT';end if;
  entry:=jsonb_build_object('date',p->>'date','moderators',p->'moderators','recorders',p->'recorders','total',total,'absent',absent,'notAttending',nonatt,'content',p->>'content','voteCards',cards);
  insert into public.startoday_meeting_minutes(id,class_id,owner_id,data) values(mid,cid,c.owner_id,entry) on conflict(id) do update set data=excluded.data,version=startoday_meeting_minutes.version+1,updated_at=clock_timestamp() where startoday_meeting_minutes.class_id=cid;
  if not found then raise exception 'MEETING_FORBIDDEN';end if;
 else
  select * into t from public.startoday_meeting_topics where class_id=cid and id=(p->>'id')::uuid for update;
  if t.id is null or t.status='deleted' then raise exception 'MEETING_NOT_FOUND';end if;
  if action='vote' then
   if teacher or t.status<>'open' or not(t.electorate ? sid) then raise exception 'MEETING_NOT_OPEN';end if;
   if exists(select 1 from public.startoday_meeting_ballots own_ballot where own_ballot.topic_id=t.id and own_ballot.student_id=sid) then raise exception 'MEETING_ALREADY_VOTED';end if;
   if jsonb_typeof(p->'choices') is distinct from 'array' or jsonb_array_length(p->'choices') not between 1 and t.max_choices then raise exception 'MEETING_INVALID_CHOICES';end if;
   if (select count(distinct value) from jsonb_array_elements(p->'choices'))<>jsonb_array_length(p->'choices') or exists(select 1 from jsonb_array_elements(p->'choices') choice where jsonb_typeof(choice)<>'string' or not exists(select 1 from jsonb_array_elements(t.options) opt where opt->>'id'=choice#>>'{}')) then raise exception 'MEETING_INVALID_CHOICES';end if;
   insert into public.startoday_meeting_ballots(topic_id,student_id,class_id,owner_id,choices) values(t.id,sid,cid,c.owner_id,p->'choices');
  elsif action='close' then
   if not teacher or t.status not in ('open','closed') then raise exception 'MEETING_FORBIDDEN';end if;
   update public.startoday_meeting_topics set status='closed',closed_at=coalesce(closed_at,clock_timestamp()) where id=t.id;
  elsif action in ('approve','endorse','defer','delete_topic','configure_topic') then
   if t.status<>'pending' then raise exception 'MEETING_NOT_PENDING';end if;
   if action='configure_topic' then
    if not teacher and not chair then raise exception 'MEETING_FORBIDDEN';end if;entry:=public.startoday_meeting_option_config(p);update public.startoday_meeting_topics set kind=entry->>'kind',options=entry->'options',max_choices=(entry->>'maxChoices')::integer,approvals='[]' where id=t.id;
   elsif action in ('defer','delete_topic') then
    if not teacher and not chair then raise exception 'MEETING_FORBIDDEN';end if;
    update public.startoday_meeting_topics set status=case when action='delete_topic' then 'deleted' else 'pending' end,approvals='[]' where id=t.id;
   else
    if not teacher and (not(members ? sid) or action='approve' and not chair or chair and coalesce(p->>'acknowledged','false')<>'true') then raise exception 'MEETING_REVIEW_REQUIRED';end if;
    select coalesce(jsonb_agg(value),'[]'::jsonb) into v_approvals from(select distinct value from jsonb_array_elements(t.approvals||case when teacher then '[]'::jsonb else jsonb_build_array(sid) end) where members ? (value#>>'{}')) x;
    open_now:=teacher or jsonb_array_length(v_approvals)*2>jsonb_array_length(members) and exists(select 1 from jsonb_array_elements_text(v_approvals) a where (o->'chairIds') ? a);
    if open_now and t.closes_at<=clock_timestamp() then raise exception 'MEETING_DEADLINE';end if;
    select coalesce(jsonb_agg(id),'[]'::jsonb) into electors from public.startoday_students where class_id=cid and data->>'deletedAt' is null;
    update public.startoday_meeting_topics set approvals=v_approvals,status=case when open_now then 'open' else 'pending' end,electorate=case when open_now then electors else '[]'::jsonb end,opened_at=case when open_now then clock_timestamp() end where id=t.id;
   end if;
  else raise exception 'MEETING_INVALID_ACTION';end if;
 end if;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'meeting',coalesce(topic_id,mid,t.id,cid)::text,action);
 perform public.startoday_meeting_close_due(cid);
end $$;
create or replace function public.startoday_teacher_meeting(p_class_id uuid,p_action text default 'refresh',p_payload jsonb default '{}',p_student_id text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.startoday_classes where id=p_class_id and owner_id=auth.uid()) then raise exception 'MEETING_FORBIDDEN';end if;
 perform public.startoday_meeting_mutate(p_class_id,p_student_id,p_student_id is null,p_action,p_payload);
 result:=public.startoday_snapshot();
 if p_student_id is not null then result:=result||jsonb_build_object('meetingPreview',public.startoday_meeting_payload(p_class_id,p_student_id,false));end if;return result;
end $$;
create or replace function public.startoday_student_meeting(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_action text default 'refresh',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;cid uuid;sid text;snapshot jsonb;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);if verified is null or verified->>'mustChangePassword'='true' then raise exception 'MEETING_AUTH_REQUIRED';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';perform public.startoday_meeting_mutate(cid,sid,false,p_action,p_payload);snapshot:=public.startoday_student_payload(cid,sid);
 return jsonb_build_object('classId',cid,'revision',(select revision from public.startoday_classes where id=cid),'snapshot',snapshot);
end $$;
revoke all on function public.startoday_meeting_officers_data(uuid),public.startoday_meeting_close_due(uuid),public.startoday_meeting_topic_card(uuid,uuid,text,boolean),public.startoday_meeting_payload(uuid,text,boolean),public.startoday_meeting_mutate(uuid,text,boolean,text,jsonb),public.startoday_meeting_option_config(jsonb) from public,anon,authenticated;
revoke all on function public.startoday_teacher_meeting(uuid,text,jsonb,text),public.startoday_student_meeting(text,text,text,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.startoday_teacher_meeting(uuid,text,jsonb,text) to authenticated;
grant execute on function public.startoday_student_meeting(text,text,text,integer,text,text,jsonb) to anon,authenticated;

create or replace function public.startoday_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; result jsonb:='{}'; t text; rows jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.startoday_classes(owner_id) values(auth.uid()) on conflict(owner_id) do nothing;
 select * into c from public.startoday_classes where owner_id=auth.uid();
 perform public.startoday_finance_settle(c.id);
 perform public.startoday_meeting_close_due(c.id);
 -- 공유 잠금으로 여러 테이블 읽기 도중 다른 기기가 수정하지 못하게 합니다.
 perform 1 from public.startoday_classes where id=c.id for share;
 foreach t in array array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas','shop_items','economy_tx','group_buy_contribs','surveys','survey_responses'] loop
 -- Credentials never leave the database, not even as a hash, in a teacher snapshot or backup.
 if t='students' then
 execute format('select coalesce(jsonb_agg(data-''password''-''passwordHash''),''[]''::jsonb) from public.%I where class_id=$1 and owner_id=$2','startoday_'||t) into rows using c.id,auth.uid();
 else
 execute format('select coalesce(jsonb_agg(data),''[]''::jsonb) from public.%I where class_id=$1 and owner_id=$2','startoday_'||t) into rows using c.id,auth.uid();
 end if;
 result:=result||jsonb_build_object(t,rows);
 end loop;
 select * into c from public.startoday_classes where id=c.id;
 return jsonb_build_object('class_id',c.id,'revision',c.revision,'data',result||public.startoday_finance_data(c.id)||jsonb_build_object('meeting',public.startoday_meeting_payload(c.id,null,true)));
end $$;
-- Canonical XP alias; pure helpers stay private to authenticated RPC implementations.
create or replace function public.startoday_area_name(value text) returns text language sql immutable as $$select case when value='학습태도' then '학습' else value end$$;
create or replace function public.startoday_area_list(value jsonb) returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(name order by position),'[]'::jsonb) from (
 select public.startoday_area_name(a.name) as name,min(a.position) as position from jsonb_array_elements_text(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) with ordinality a(name,position) where a.name is not null group by public.startoday_area_name(a.name)
 ) normalized;
$$;
revoke all on function public.startoday_area_name(text) from public,anon,authenticated;
revoke all on function public.startoday_area_list(jsonb) from public,anon,authenticated;
-- Merge the two spellings only. Other custom names and every record ID remain intact.
do $$begin if to_regclass('public.startoday_areas') is not null then
with aliases as (
 select class_id,id,row_number() over(partition by class_id order by (data->>'deletedAt' is not null),coalesce((data->>'sortOrder')::numeric,0),id) as position
 from public.startoday_areas where data->>'name' in ('학습태도','학습')
) delete from public.startoday_areas a using aliases d where a.class_id=d.class_id and a.id=d.id and d.position>1;
update public.startoday_areas set data=jsonb_set(data,'{name}','"학습"'::jsonb) where data->>'name'='학습태도';
end if;end $$;
update public.startoday_records set data=data||jsonb_build_object('areas',public.startoday_area_list(coalesce(data->'areas',jsonb_build_array(data->>'area'))))||case when data ? 'area' then jsonb_build_object('area',public.startoday_area_name(data->>'area')) else '{}'::jsonb end
 where coalesce(data->'areas','[]'::jsonb) ? '학습태도' or data->>'area'='학습태도';
update public.startoday_assignments set data=jsonb_set(data,'{statArea}','"학습"'::jsonb) where data->>'statArea'='학습태도';
-- Preserve a renamed custom first stat while recovering otherwise orphaned learning references.
do $$begin if to_regclass('public.startoday_areas') is not null then
 insert into public.startoday_areas(class_id,owner_id,id,data)
 select c.id,c.owner_id,available.id,jsonb_build_object('id',available.id,'name','학습','sortOrder',coalesce((select max((a.data->>'sortOrder')::numeric)+1 from public.startoday_areas a where a.class_id=c.id),0),'deletedAt',null)
 from public.startoday_classes c
 cross join lateral (select case when n=0 then 'area-learning' else 'area-learning-'||n end as id from generate_series(0,1000) n where not exists(select 1 from public.startoday_areas a where a.class_id=c.id and a.id=case when n=0 then 'area-learning' else 'area-learning-'||n end) order by n limit 1) available
 where not exists(select 1 from public.startoday_areas a where a.class_id=c.id and a.data->>'name'='학습') and (exists(select 1 from public.startoday_records r where r.class_id=c.id and (coalesce(r.data->'areas','[]'::jsonb) ? '학습' or r.data->>'area'='학습')) or exists(select 1 from public.startoday_assignments a where a.class_id=c.id and a.data->>'statArea'='학습'));
end if;end $$;


create or replace function public.startoday_commit(p_class_id uuid,p_revision bigint,p_ops jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; op jsonb; t text; v jsonb; old jsonb; n bigint; stamp text; quest jsonb; goal integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into c from public.startoday_classes where id=p_class_id and owner_id=auth.uid() for update;
 if c.id is null then raise exception 'FORBIDDEN'; end if;
 if c.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if jsonb_typeof(p_ops)<>'array' or jsonb_array_length(p_ops)>50000 then raise exception 'INVALID_BATCH'; end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 for op in select * from jsonb_array_elements(p_ops) loop
 t:=op->>'table';
 if not(t=any(array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas','shop_items','economy_tx','group_buy_contribs','surveys','survey_responses'])) or coalesce(op->>'id','')='' then raise exception 'INVALID_TABLE_OR_ID'; end if;
 if coalesce((op->>'remove')::boolean,false) then
 execute format('delete from public.%I where class_id=$1 and id::text=$2','startoday_'||t) using c.id,op->>'id';
 else
 v:=op->'data';
 if jsonb_typeof(v)<>'object' or v->>'id' is distinct from op->>'id' then raise exception 'INVALID_DATA'; end if;
 if t='settings' and v ? 'allowRefund' and jsonb_typeof(v->'allowRefund')<>'boolean' then raise exception 'INVALID_REFUND_SETTING';end if;
 if t='settings' and v ? 'pointPeriod' and (jsonb_typeof(v->'pointPeriod') is distinct from 'string' or v->>'pointPeriod' not in ('all','7d','14d','30d','month')) then raise exception 'INVALID_POINT_PERIOD';end if;
 if t='settings' and v ? 'studentPraisePeriod' and (jsonb_typeof(v->'studentPraisePeriod') is distinct from 'string' or v->>'studentPraisePeriod' not in ('all','30d','7d','month','recent3')) then raise exception 'INVALID_STUDENT_PRAISE_PERIOD';end if;
 if t='settings' and v ? 'titleGoal' and (jsonb_typeof(v->'titleGoal')<>'number' or (v->>'titleGoal')::numeric<>trunc((v->>'titleGoal')::numeric) or (v->>'titleGoal')::numeric not between 3 and 9999) then raise exception 'INVALID_TITLE_GOAL';end if;
 if t='students' then
  -- A reset or a never-changed student follows the class initial password, so no hash is kept.
  if coalesce(v->>'passwordResetRequired','false')='true' or coalesce(v->>'passwordChanged','false')<>'true' then
   delete from public.startoday_student_secrets where class_id=c.id and student_id=op->>'id';
  elsif v ? 'password' and coalesce(v->>'password','')<>'' then
   if jsonb_typeof(v->'password') is distinct from 'string' or char_length(v->>'password')>200 then raise exception 'INVALID_STUDENT_PASSWORD';end if;
   insert into public.startoday_student_secrets(class_id,student_id,password_hash,must_change,updated_at) values(c.id,op->>'id',public.startoday_password_hash(v->>'password'),not public.startoday_password_is_valid(v->>'password'),now()) on conflict(class_id,student_id) do update set password_hash=excluded.password_hash,must_change=excluded.must_change,updated_at=now();
  end if;
  -- Teacher edits only ever carry a new password; hashes stay out of the row itself.
  v:=v-'password'-'passwordHash';
  if v->>'nickname' is not null and v->>'nickname' !~ '^[가-힣]{1,8}$' then raise exception 'INVALID_NICKNAME';end if;
  select data into old from public.startoday_students where class_id=c.id and id=op->>'id';
  if jsonb_typeof(old->'avatarOwned')='array' then v:=v||jsonb_build_object('avatarOwned',(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(old->'avatarOwned'||case when jsonb_typeof(v->'avatarOwned')='array' then v->'avatarOwned' else '[]'::jsonb end)),'avatarEquipped',coalesce(v->'avatarEquipped',old->'avatarEquipped','{}'::jsonb));end if;
  if old->'rewardTitles' is not null then v:=v||jsonb_build_object('rewardTitles',(select coalesce(jsonb_agg(kept.reward order by kept.position),'[]'::jsonb) from(select distinct on(x.reward->>'id') x.reward,x.position from jsonb_array_elements(coalesce(old->'rewardTitles','[]'::jsonb)||coalesce(v->'rewardTitles','[]'::jsonb)) with ordinality x(reward,position) order by x.reward->>'id',x.position) kept));end if;
 end if;
 if t='assignments' and v->>'isQuest'='true' then
  if v ? 'questSubtasks' then
   if jsonb_typeof(v->'questSubtasks') is distinct from 'array' then raise exception 'INVALID_QUEST_SUBTASKS';end if;
   if jsonb_array_length(v->'questSubtasks')>999 or exists(select 1 from jsonb_array_elements(v->'questSubtasks') x(value) where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 200) or (select count(distinct value) from jsonb_array_elements(v->'questSubtasks'))<>jsonb_array_length(v->'questSubtasks') then raise exception 'INVALID_QUEST_SUBTASKS';end if;
   if jsonb_array_length(v->'questSubtasks')>0 and (v->>'questGoal')::integer<>jsonb_array_length(v->'questSubtasks') then raise exception 'INVALID_QUEST_GOAL';end if;
  end if;
  if jsonb_typeof(v->'questGoal') is distinct from 'number' or (v->>'questGoal')::numeric<>trunc((v->>'questGoal')::numeric) or (v->>'questGoal')::numeric not between 1 and 999 or coalesce(char_length(btrim(v->>'questTitle')),0) not between 1 and 40 then raise exception 'INVALID_QUEST';end if;
 end if;
 if t='settings' and v ? 'defaultStudentPassword' then
 select data into old from public.startoday_settings where class_id=c.id and id=op->>'id';
 if v->>'defaultStudentPassword' is distinct from old->>'defaultStudentPassword' then
 if coalesce(char_length(v->>'defaultStudentPassword'),0)<5 or char_length(v->>'defaultStudentPassword')>200 or v->>'defaultStudentPassword' !~ '[가-힣]' or v->>'defaultStudentPassword' ~ '[^가-힣0-9]' then raise exception 'INVALID_INITIAL_STUDENT_PASSWORD';end if;
 end if;
 end if;
 if t='areas' then v:=jsonb_set(v,'{name}',coalesce(to_jsonb(public.startoday_area_name(v->>'name')),'null'::jsonb));end if;
 if t='records' then v:=v||jsonb_build_object('areas',public.startoday_area_list(coalesce(v->'areas',jsonb_build_array(v->>'area'))));if v ? 'area' then v:=v||jsonb_build_object('area',public.startoday_area_name(v->>'area'));end if;end if;
 if t='assignments' and v ? 'statArea' then v:=v||jsonb_build_object('statArea',public.startoday_area_name(v->>'statArea'));end if;
 if t='areas' and (jsonb_typeof(v->'name') is distinct from 'string' or coalesce(btrim(v->>'name'),'')='' or jsonb_typeof(v->'sortOrder') is distinct from 'number' or (v->>'sortOrder')::numeric<0 or (v->>'sortOrder')::numeric<>trunc((v->>'sortOrder')::numeric)) then raise exception 'INVALID_AREA'; end if;
 if t='records' then
 execute 'select data from public.startoday_records where class_id=$1 and id=$2' into old using c.id,op->>'id';
 -- 최초 시각은 덮어쓸 수 없고, 수정 시각은 서버 시각으로 남깁니다.
 if nullif(old->>'createdAt','') is not null then v:=jsonb_set(v,'{createdAt}',old->'createdAt'); end if;
 if nullif(v->>'createdAt','') is null then v:=jsonb_set(v,'{createdAt}',to_jsonb(stamp)); end if;
 v:=jsonb_set(v,'{updatedAt}',to_jsonb(stamp));
 if not(v->>'kind'=any(array['칭찬','지도','관찰','추가기록'])) or jsonb_typeof(v->'studentIds')<>'array' then raise exception 'INVALID_RECORD'; end if;
 end if;
 if t in ('assignmentStates','routineStates') then
 if coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(v->>'studentId','')='' then raise exception 'INVALID_STATE'; end if;
 begin if to_char((v->>'date')::date,'YYYY-MM-DD')<>v->>'date' then raise exception 'INVALID_STATE';end if;exception when datetime_field_overflow or invalid_datetime_format then raise exception 'INVALID_STATE';end;
 if t='assignmentStates' and not(v->>'status'=any(array['진행중','완료','늦게완료','안함','면제'])) then raise exception 'INVALID_STATUS'; end if;
 if t='assignmentStates' then
  select data into quest from public.startoday_assignments where class_id=c.id and id=v->>'assignmentId';
  if quest->>'isQuest'='true' then
   goal:=coalesce((quest->>'questGoal')::integer,10);
   if jsonb_array_length(coalesce(quest->'questSubtasks','[]'::jsonb))>0 then
    if jsonb_typeof(v->'completedSubtasks') is distinct from 'array' then raise exception 'INVALID_COMPLETED_SUBTASKS';end if;
    if jsonb_array_length(v->'completedSubtasks')<>(v->>'stamps')::integer or (select count(distinct value) from jsonb_array_elements(v->'completedSubtasks'))<>jsonb_array_length(v->'completedSubtasks') or exists(select 1 from jsonb_array_elements(v->'completedSubtasks') x(value) where jsonb_typeof(value)<>'string' or not(quest->'questSubtasks' @> jsonb_build_array(value))) then raise exception 'INVALID_COMPLETED_SUBTASKS';end if;
   end if;
   if not coalesce(quest->'target'='"all"'::jsonb or quest->'target'->'studentIds' ? (v->>'studentId'),false) or v->>'date' is distinct from quest->>'date' or jsonb_typeof(v->'stamps') is distinct from 'number' or (v->>'stamps')::numeric<>trunc((v->>'stamps')::numeric) or (v->>'stamps')::numeric not between 0 and goal or v->>'status' is distinct from (case when (v->>'stamps')::integer>=goal then '완료' else '진행중' end) then raise exception 'INVALID_QUEST_STATE';end if;
   if (v->>'stamps')::integer>=goal then
    update public.startoday_students set data=data||jsonb_build_object('rewardTitles',coalesce(data->'rewardTitles','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id','quest:'||(quest->>'id'),'name',quest->>'questTitle','assignmentId',quest->>'id','earnedAt',stamp))) where class_id=c.id and id=v->>'studentId' and not exists(select 1 from jsonb_array_elements(coalesce(data->'rewardTitles','[]'::jsonb)) reward_entry(value) where reward_entry.value->>'id'='quest:'||(quest->>'id'));
   end if;
  end if;
 end if;
 if t='routineStates' and not(v->>'status'=any(array['진행중','완료','면제'])) then raise exception 'INVALID_STATUS'; end if;
 end if;
 if t='shop_items' then
 insert into public.startoday_shop_items(class_id,owner_id,id,data) values(c.id,auth.uid(),(op->>'id')::uuid,v) on conflict(class_id,id) do update set data=excluded.data,updated_at=now();
 elsif t='economy_tx' then
 if not exists(select 1 from public.startoday_students where class_id=c.id and id=v->>'studentId') then raise exception 'ECONOMY_STUDENT_REFERENCE';end if;
 insert into public.startoday_economy_tx(class_id,owner_id,id,student_id,data) values(c.id,auth.uid(),(op->>'id')::uuid,v->>'studentId',v) on conflict(class_id,id) do update set data=excluded.data,student_id=excluded.student_id,updated_at=now();
 else
 execute format('insert into public.%I(class_id,owner_id,id,data) values($1,$2,$3,$4) on conflict(class_id,id) do update set data=excluded.data,updated_at=now()','startoday_'||t) using c.id,auth.uid(),op->>'id',v;
 end if;
 end if;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(auth.uid(),c.id,c.revision+1,t,op->>'id',case when coalesce((op->>'remove')::boolean,false) then 'delete' else 'upsert' end);
 end loop;
 -- 최종 배치 상태에서 참조 무결성을 검사합니다. 복원 시 일시적인 삽입 순서는 허용합니다.
 if exists(select 1 from public.startoday_records r cross join lateral jsonb_array_elements_text(r.data->'studentIds') sid where r.class_id=c.id and not exists(select 1 from public.startoday_students s where s.class_id=c.id and s.id=sid.value)) then raise exception 'RECORD_STUDENT_REFERENCE'; end if;
 if exists(select 1 from public."startoday_assignmentStates" st where st.class_id=c.id and (st.id is distinct from concat(st.data->>'assignmentId',':',st.data->>'date',':',st.data->>'studentId') or not exists(select 1 from public.startoday_students s where s.class_id=c.id and s.id=st.data->>'studentId') or not exists(select 1 from public.startoday_assignments a where a.class_id=c.id and a.id=st.data->>'assignmentId'))) then raise exception 'ASSIGNMENT_STATE_REFERENCE'; end if;
 if exists(select 1 from public."startoday_routineStates" st where st.class_id=c.id and (st.id is distinct from concat(st.data->>'routineId',':',st.data->>'date',':',st.data->>'studentId') or not exists(select 1 from public.startoday_students s where s.class_id=c.id and s.id=st.data->>'studentId') or not exists(select 1 from public.startoday_routines r where r.class_id=c.id and r.id=st.data->>'routineId'))) then raise exception 'ROUTINE_STATE_REFERENCE'; end if;
 update public.startoday_classes set revision=revision+1 where id=c.id returning revision into n;
 return n;
end $$;
create or replace function public.startoday_backup(p_class_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare snap jsonb;
begin
 if not exists(select 1 from public.startoday_classes where id=p_class_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN'; end if;
 snap:=public.startoday_snapshot();
 insert into public.startoday_backups(owner_id,class_id,data) values(auth.uid(),p_class_id,snap);
 delete from public.startoday_backups where class_id=p_class_id and id not in(select id from public.startoday_backups where class_id=p_class_id order by created_at desc limit 2);
end $$;
revoke all on public.startoday_classes,public.startoday_backups,public.startoday_audit from anon,authenticated;
grant select on public.startoday_classes,public.startoday_backups,public.startoday_audit to authenticated;
revoke all on function public.startoday_snapshot(),public.startoday_commit(uuid,bigint,jsonb),public.startoday_backup(uuid) from public,anon;
grant execute on function public.startoday_snapshot(),public.startoday_commit(uuid,bigint,jsonb),public.startoday_backup(uuid) to authenticated;
-- Existing tag rows are retained as inaccessible legacy data; no current API uses them.
do $$ begin if to_regclass('public.startoday_tags') is not null then execute 'revoke all on public.startoday_tags from public,anon,authenticated';end if;end $$;
-- Occurrence test reused by the narrowly scoped peer-checker RPCs.
create or replace function public.startoday_assignment_occurs(a jsonb, day text)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(a->>'deletedAt' is null and (a->>'isQuest'='true' or
 (a->>'date'<=day and (a->>'endDate' is null or a->>'endDate'>=day) and
 ((a->'repeat'->>'type'='none' and a->>'date'=day) or a->'repeat'->>'type'='daily' or (a->'repeat'->>'type'='weekly' and a->'repeat'->'weekdays' @> jsonb_build_array(extract(dow from day::date)::integer))))),false);
$$;
revoke all on function public.startoday_assignment_occurs(jsonb,text) from public,anon,authenticated;
-- Student reads are an explicit allow-list, independent of teacher snapshots.
-- No anonymous SELECT policy is added to any existing class table.
create table if not exists public.startoday_student_login_attempts (
 class_id uuid not null references public.startoday_classes(id) on delete cascade,
 student_id text not null, failures integer not null default 0,
 window_start timestamptz not null default now(), primary key(class_id,student_id)
);
alter table public.startoday_student_login_attempts enable row level security;
revoke all on public.startoday_student_login_attempts from public,anon,authenticated;
-- Password secrets never enter snapshots, backups or teacher JSONB; only definer RPCs read them.
create table if not exists public.startoday_student_secrets (
 class_id uuid not null references public.startoday_classes(id) on delete cascade,
 student_id text not null, password_hash text not null, must_change boolean not null default false,
 updated_at timestamptz not null default now(), primary key(class_id,student_id)
);
alter table public.startoday_student_secrets enable row level security;
revoke all on public.startoday_student_secrets from public,anon,authenticated;
create or replace function public.startoday_password_digest(p_password text) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
 select encode(digest(p_password,'sha256'),'hex')
$$;
-- Fixed-length digest keeps bcrypt clear of its 72-byte input limit for long Hangul passwords.
create or replace function public.startoday_password_hash(p_password text) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
 select crypt(public.startoday_password_digest(p_password),gen_salt('bf',10))
$$;
create or replace function public.startoday_password_matches(p_password text,p_hash text) returns boolean language sql immutable set search_path=public,extensions,pg_temp as $$
 select coalesce(p_hash ~ '^\$2[aby]\$' and crypt(public.startoday_password_digest(coalesce(p_password,'')),p_hash)=p_hash,false)
$$;
create or replace function public.startoday_password_is_valid(p_password text) returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(char_length(p_password) between 5 and 200 and p_password ~ '^[가-힣0-9]+$' and p_password ~ '[가-힣]',false)
$$;
revoke all on function public.startoday_password_digest(text),public.startoday_password_hash(text),public.startoday_password_matches(text,text),public.startoday_password_is_valid(text) from public,anon,authenticated;
-- Stored projection of the profile JSON; existing generic commits and RLS stay intact.
alter table public.startoday_students add column if not exists equipped_title text generated always as (data->>'equippedTitle') stored;
-- Six XP domains: praise counts are independent of record wording.
create or replace function public.startoday_title_config(cid uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$begin return (
 select jsonb_build_object('goal',coalesce((select (data->>'titleGoal')::integer from public.startoday_settings where class_id=cid and id='main'),15),'labels',coalesce((select jsonb_object_agg(d.value->>'id',coalesce((select a.data->>'name' from public.startoday_areas a where a.class_id=cid and a.id=d.value->>'areaId'),d.value->>'label')) from jsonb_array_elements('[{"id":"learning","label":"학습","icon":"📘","areaId":"area-1","titles":["지식의 탐색자","사유의 탐구자","통찰의 현자"]},{"id":"tasks","label":"과제","icon":"📋","areaId":"area-2","titles":["약속의 수행자","완수의 장인","결실의 마스터"]},{"id":"relationships","label":"관계","icon":"🤝","areaId":"area-3","titles":["공감의 동행자","신뢰의 중재자","화합의 대사"]},{"id":"challenge","label":"도전","icon":"🧭","areaId":"area-4","titles":["용기의 모험가","역경의 돌파자","불굴의 개척자"]},{"id":"life","label":"생활","icon":"🌿","areaId":"area-5","titles":["자율의 길잡이","질서의 파수꾼","균형의 수호자"]},{"id":"jobs","label":"알바","icon":"🏰","areaId":"area-6","titles":["길드의 지원자","길드의 기둥","길드의 대들보"]}]'::jsonb) d),'{}'::jsonb)));end $$;
revoke all on function public.startoday_title_config(uuid) from public,anon,authenticated;
create or replace function public.startoday_kingdom_counts(cid uuid,sid text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_object_agg(d.value->>'id',(
 select count(*) from public.startoday_records r
 left join public."startoday_assignmentStates" st on st.class_id=cid and st.id=r.data->>'autoRef' and st.data->>'studentId'=sid
 left join public.startoday_assignments a on a.class_id=cid and a.id=st.data->>'assignmentId'
 where r.class_id=cid and r.data->>'kind'='칭찬' and r.data->'studentIds' ? sid and r.data->>'date'<=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD')
 and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')
 and (r.data->>'autoRef' is null or (a.id is not null and coalesce(a.data->>'noStar','false')<>'true' and st.data->>'status'='완료' and (coalesce(a.data->>'isQuest','false')<>'true' or coalesce((st.data->>'stamps')::integer,0)>=coalesce((a.data->>'questGoal')::integer,10))))
 and public.startoday_area_list(coalesce(r.data->'areas',jsonb_build_array(r.data->>'area'))) ? (public.startoday_title_config(cid)->'labels'->>(d.value->>'id'))
 )) from jsonb_array_elements('[{"id":"learning","label":"학습","icon":"📘","areaId":"area-1","titles":["지식의 탐색자","사유의 탐구자","통찰의 현자"]},{"id":"tasks","label":"과제","icon":"📋","areaId":"area-2","titles":["약속의 수행자","완수의 장인","결실의 마스터"]},{"id":"relationships","label":"관계","icon":"🤝","areaId":"area-3","titles":["공감의 동행자","신뢰의 중재자","화합의 대사"]},{"id":"challenge","label":"도전","icon":"🧭","areaId":"area-4","titles":["용기의 모험가","역경의 돌파자","불굴의 개척자"]},{"id":"life","label":"생활","icon":"🌿","areaId":"area-5","titles":["자율의 길잡이","질서의 파수꾼","균형의 수호자"]},{"id":"jobs","label":"알바","icon":"🏰","areaId":"area-6","titles":["길드의 지원자","길드의 기둥","길드의 대들보"]}]'::jsonb) d;
$$;
revoke all on function public.startoday_kingdom_counts(uuid,text) from public,anon,authenticated;

-- Payload helper is private: initial-password users never receive a snapshot.
-- Private numeric aggregation; advice text never leaves this helper.
create or replace function public.startoday_point_period_start(cid uuid,p_day date default (now() at time zone 'Asia/Seoul')::date) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select case data->>'pointPeriod'
 when '7d' then to_char(p_day-6,'YYYY-MM-DD') when '14d' then to_char(p_day-13,'YYYY-MM-DD') when '30d' then to_char(p_day-29,'YYYY-MM-DD') when 'month' then to_char(date_trunc('month',p_day),'YYYY-MM-DD') else '' end from public.startoday_settings where class_id=cid and id='main'),'')
$$;
revoke all on function public.startoday_point_period_start(uuid,date) from public,anon,authenticated;
create or replace function public.startoday_coin_balance(cid uuid,sid text) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select (case when coalesce((select data->>'pointMode' from public.startoday_settings where class_id=cid and id='main'),'realtime')='salary' then 0 else coalesce((select sum(case when r.data->>'autoRef' is not null then case when a.data->>'noStar'='true' then 0 when ast.data->>'status'='완료' then 1 when ast.data->>'status'='안함' then -1 else 0 end else case r.data->>'kind' when '칭찬' then 1 when '지도' then -1 else 0 end end)*10 from public.startoday_records r left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId' where r.class_id=cid and r.data->'studentIds' ? sid and r.data->>'date'>=public.startoday_point_period_start(cid) and r.data->>'date'<=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')),0) end)+coalesce((select sum((data->>'amount')::bigint) from public.startoday_economy_tx where class_id=cid and student_id=sid),0)
$$;
create or replace function public.startoday_economy_payload(cid uuid,sid text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('finance',public.startoday_finance_student_data(cid,sid),'studentId',sid,'balance',public.startoday_coin_balance(cid,sid),'allowRefund',coalesce((select data->>'allowRefund' from public.startoday_settings where class_id=cid and id='main'),'true')<>'false',
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'category',i.data->>'category','name',i.data->>'name','description',coalesce(i.data->>'description',''),'price',i.data->'price','stock',i.data->'stock','isGroupBuy',i.is_group_buy,'groupGoal',i.group_goal,'groupCollected',i.group_collected,'isFunded',i.is_funded,'isUsed',i.is_used,
 'contributors',case when i.is_group_buy then coalesce((select jsonb_agg(jsonb_build_object('studentId',gc.student_id,'name',case when st.data->>'deletedAt' is null then coalesce(st.data->>'name','전출 학생') else '전출 학생' end,'amount',gc.amount,'isMe',gc.student_id=sid) order by gc.amount desc,gc.student_id) from public.startoday_group_buy_contribs gc left join public.startoday_students st on st.class_id=gc.class_id and st.id=gc.student_id where gc.class_id=cid and gc.item_id=i.id),'[]'::jsonb) else '[]'::jsonb end) order by i.created_at,i.id) from public.startoday_shop_items i where i.class_id=cid and i.data->>'deletedAt' is null),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',data->>'type','itemId',data->>'itemId','itemName',data->>'itemName','itemCategory',coalesce(nullif(data->>'itemCategory',''),(select i.data->>'category' from public.startoday_shop_items i where i.class_id=cid and i.id::text=etx.data->>'itemId'),'기타'),'amount',data->'amount','status',data->>'status','createdAt',data->>'createdAt') order by created_at,id) from public.startoday_economy_tx etx where class_id=cid and student_id=sid),'[]'::jsonb))
$$;
revoke all on function public.startoday_coin_balance(uuid,text),public.startoday_economy_payload(uuid,text) from public,anon,authenticated;
create or replace function public.startoday_avatar_catalog() returns jsonb language sql immutable set search_path=public,pg_temp as $$ select '[{"id": "hair_1", "name": "동글 밤톨머리", "category": "머리", "price": 10, "image": "assets/avatar/hair_1.png", "description": "둥근 실루엣과 도톰한 앞머리"}, {"id": "outfit_1", "name": "첫걸음 교복 · 바지", "category": "옷", "price": 10, "image": "assets/avatar/outfit_1.png", "description": "흰 셔츠와 베이지 니트 조끼, 갈색 바지"}]'::jsonb $$;
revoke all on function public.startoday_avatar_catalog() from public,anon,authenticated;

create or replace function public.startoday_student_payload(cid uuid,sid text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student jsonb; config jsonb; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
 result jsonb; totals jsonb; letters jsonb; tasks jsonb; routines jsonb; timetable jsonb; calendar jsonb; praise_from text;
begin
 perform public.startoday_finance_settle(cid);
 perform public.startoday_meeting_close_due(cid);
 select data into student from public.startoday_students where class_id=cid and id=sid;
 select data into config from public.startoday_settings where class_id=cid and id='main';
 praise_from:=case config->>'studentPraisePeriod' when '30d' then to_char(day::date-29,'YYYY-MM-DD') when '7d' then to_char(day::date-6,'YYYY-MM-DD') when 'month' then substring(day,1,8)||'01' else '' end;
 -- Only numbers are aggregated from advice; its text is never returned.
 with scored as (
 select r.data,case when r.data->>'autoRef' is not null then case when a.data->>'noStar'='true' then 0 when ast.data->>'status'='완료' then 1 when ast.data->>'status'='안함' then -1 else 0 end else case r.data->>'kind' when '칭찬' then 1 when '지도' then -1 else 0 end end as delta
 from public.startoday_records r
 left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid
 left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId'
 where r.class_id=cid and r.data->'studentIds' ? sid and r.data->>'date'<=day
 and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')
 ) select jsonb_build_object('total',coalesce((select sum(delta) from scored),0),'areas',coalesce((select jsonb_object_agg(ar.data->>'name',coalesce((select sum(delta) from scored r where coalesce(r.data->'areas',jsonb_build_array(r.data->>'area')) ? (ar.data->>'name')),0)) from public.startoday_areas ar where ar.class_id=cid),'{}'::jsonb)) into totals;
 select coalesce(jsonb_agg(x.data order by x.date desc,x.created desc),'[]'::jsonb) into letters from (
 select jsonb_build_object('kind','칭찬','date',r.data->>'date','period',case when r.data->>'period'='기타' then '' else coalesce(r.data->>'period','') end,'text',case when r.data->>'autoRef' is not null then concat(a.data->>'title',case when ast.data->>'status'='늦게완료' then ' 늦게 완료' else ' 완료' end) else r.data->>'text' end,'areas',coalesce(r.data->'areas','[]'::jsonb)) as data,r.data->>'date' as date,r.data->>'createdAt' as created
 from public.startoday_records r
 left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid
 left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId'
 where (r.data->>'autoRef' is null or (a.id is not null and ast.data->>'status'='완료')) and r.class_id=cid and r.data->>'kind'='칭찬' and r.data->'studentIds' ? sid and r.data->>'date'>=praise_from and r.data->>'date'<=day
 order by r.data->>'date' desc,r.data->>'createdAt' desc,r.id desc limit case when config->>'studentPraisePeriod'='recent3' then 3 else null end) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title','memo',coalesce(a.data->>'memo',''),'checkerName',coalesce((select concat(s.data->>'no','. ',s.data->>'name') from public.startoday_students s where s.class_id=cid and s.id=a.data->>'checkerStudentId' and s.data->>'deletedAt' is null),''),'date',due.date,'isQuest',coalesce(a.data->>'isQuest','false')='true','goal',coalesce((a.data->>'questGoal')::integer,10),'stamps',coalesce((st.data->>'stamps')::integer,0),'startDate',a.data->>'date','endDate',a.data->>'endDate','questSubtasks',coalesce(a.data->'questSubtasks','[]'::jsonb),'completedSubtaskDates',coalesce(st.data->'completedSubtaskDates','{}'::jsonb),'completedSubtasks',coalesce(st.data->'completedSubtasks',(select coalesce(jsonb_agg(x.value order by x.n),'[]'::jsonb) from jsonb_array_elements(coalesce(a.data->'questSubtasks','[]'::jsonb)) with ordinality x(value,n) where x.n<=coalesce((st.data->>'stamps')::integer,0))),'overdue',due.date<day,'status',case when coalesce(a.data->>'isQuest','false')<>'true' and exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=due.date and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by due.date,a.data->>'title'),'[]'::jsonb) into tasks
 from public.startoday_assignments a
 cross join lateral (select day as date where a.data->>'isQuest'='true' union all select to_char(value,'YYYY-MM-DD') as date from generate_series((a.data->>'date')::date,day::date,interval '1 day') value where coalesce(a.data->>'isQuest','false')<>'true') due
 left join public."startoday_assignmentStates" st on st.class_id=cid and st.id=a.id||':'||case when a.data->>'isQuest'='true' then a.data->>'date' else due.date end||':'||sid
 where a.class_id=cid and public.startoday_assignment_occurs(a.data,due.date) and (coalesce(a.data->>'isQuest','false')<>'true' or due.date=day)
 and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)
 and (due.date=day or (coalesce(st.data->>'status','진행중')='진행중' and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=due.date and atd.data->>'excluded'='true')));
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.data->>'title','status',case when r.data->'exceptions'->day->>'exempt'='true' or exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=day and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by coalesce((r.data->>'sortOrder')::numeric,0)),'[]'::jsonb) into routines
 from public.startoday_routines r left join public."startoday_routineStates" st on st.class_id=cid and st.id=r.id||':'||day||':'||sid
 where r.class_id=cid and r.data->>'deletedAt' is null and (r.data->'target'='"all"'::jsonb or r.data->'target'->'studentIds' ? sid);
 select coalesce(jsonb_agg(jsonb_build_object('period',t.data->'period','periodTime',config->'periodTimes'->>((t.data->>'period')::integer-1),'subject',t.data->>'subjectCode','publicMemo',coalesce(t.data->>'publicMemo',t.data->>'memo',''),'privateMemo',coalesce(t.data->>'privateMemo',''),'color',rules.data->>'color','accentColor',rules.data->>'accentColor','colorSource',rules.data->>'colorSource','defaultColorValue',rules.data->>'defaultColorValue','location',coalesce(nullif(t.data->>'locationOverride',''),rules.data->>'location','')) order by (t.data->>'period')::integer),'[]'::jsonb) into timetable
 from public.startoday_timetables t left join public.startoday_subject_rules rules on rules.class_id=cid and rules.data->>'code'=t.data->>'subjectCode'
 where t.class_id=cid and t.data->>'date'=day and (t.data->>'period')::integer between 1 and 6;
 select jsonb_build_object(
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title','date',a.data->>'date','endDate',a.data->>'endDate','repeat',a.data->'repeat','isQuest',coalesce(a.data->>'isQuest','false')='true','questGoal',coalesce((a.data->>'questGoal')::integer,10),'memo',coalesce(a.data->>'memo',''),'checkerName',coalesce((select concat(s.data->>'no','. ',s.data->>'name') from public.startoday_students s where s.class_id=cid and s.id=a.data->>'checkerStudentId' and s.data->>'deletedAt' is null),''))) from public.startoday_assignments a where a.class_id=cid and coalesce(a.data->>'isQuest','false')<>'true' and a.data->>'deletedAt' is null and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)),'[]'::jsonb),
 'states',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',st.data->>'assignmentId','date',st.data->>'date','status',st.data->>'status','stamps',st.data->'stamps')) from public."startoday_assignmentStates" st where st.class_id=cid and st.data->>'studentId'=sid),'[]'::jsonb),
 'timetables',coalesce((select jsonb_agg(jsonb_build_object('date',t.data->>'date','period',t.data->'period','subject',t.data->>'subjectCode','publicMemo',coalesce(t.data->>'publicMemo',t.data->>'memo',''))) from public.startoday_timetables t where t.class_id=cid and (t.data->>'period')::integer between 1 and 6),'[]'::jsonb),
 'excludedDates',coalesce((select jsonb_agg(atd.data->>'date') from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'excluded'='true'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('date',e.date,'title',e.title,'description',e.description,'period',e.period,'timeOfDay',e.time_of_day,'isDday',e.is_dday,'isImportant',e.is_important)) from (
   select ev.data->>'date' as date,ev.data->>'title' as title,coalesce(ev.data->>'description','') as description,ev.data->'period' as period,ev.data->>'timeOfDay' as time_of_day, coalesce(ev.data->>'isDday','false')='true' as is_dday,coalesce(ev.data->>'isImportant','true')<>'false' as is_important from public.startoday_events ev where ev.class_id=cid
   union all select config->'academicCalendar'->>dates.key,dates.title,'학사일정 · 설정에서 관리','null'::jsonb,null::text,false,true from (values ('term1Start','개학식'),('summerEnd','여름방학식'),('term2Start','개학식'),('winterEnd','겨울방학식'),('winterReturn','개학식'),('springEnd','종업식')) dates(key,title) where config->'academicCalendar'->>dates.key ~ '^\d{4}-\d{2}-\d{2}$' and (dates.key not in ('winterReturn','springEnd') or config->'academicCalendar'->>'springBreak'='true')
   union all select distinct holiday.value,'자율휴업일','학사일정 · 재량휴업일','null'::jsonb,null::text,false,true from jsonb_array_elements_text(case when jsonb_typeof(config->'academicCalendar'->'holidays')='array' then config->'academicCalendar'->'holidays' else '[]'::jsonb end) holiday(value)
 ) e),'[]'::jsonb)) into calendar;
 result:=jsonb_build_object('avatar',jsonb_build_object('catalog',public.startoday_avatar_catalog(),'owned',case when jsonb_typeof(student->'avatarOwned')='array' then student->'avatarOwned' else '[]'::jsonb end,'equipped',case when jsonb_typeof(student->'avatarEquipped')='object' then student->'avatarEquipped' else '{}'::jsonb end),'economy',public.startoday_economy_payload(cid,sid),'student',jsonb_build_object('id',sid,'no',student->'no','name',student->>'name','equippedTitle',student->>'equippedTitle','nickname',student->>'nickname','rewardTitles',coalesce((select jsonb_agg(jsonb_build_object('id',t->>'id','name',t->>'name')) from jsonb_array_elements(coalesce(student->'rewardTitles','[]'::jsonb)) t),'[]'::jsonb)),'titleCounts',public.startoday_kingdom_counts(cid,sid),'titleConfig',public.startoday_title_config(cid),'className',coalesce(config->>'className','우리반'),'date',day,'lunchAfterPeriod',case when config->>'lunchAfterPeriod' in ('3','4','5') then (config->>'lunchAfterPeriod')::integer else 4 end,'score',totals,'praise',letters,'tasks',tasks,'routines',routines,'timetable',timetable,'calendar',calendar,'checkingAssignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title')) from public.startoday_assignments a where a.class_id=cid and a.data->>'checkerStudentId'=sid and coalesce(a.data->>'isQuest','false')<>'true' and public.startoday_assignment_occurs(a.data,day)),'[]'::jsonb));
 result:=result||jsonb_build_object('survey',(select jsonb_build_object('id',s.id,'title',s.title,'status',s.status,'reasonTags',public.startoday_survey_reason_tags(s.data->'reasonTags'),'submitted',exists(select 1 from public.startoday_survey_responses r where r.class_id=cid and r.survey_id=s.id and r.student_id=sid),'peers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.data->>'name') order by (p.data->>'no')::integer) from public.startoday_students p where p.class_id=cid and p.id<>sid and p.data->>'deletedAt' is null),'[]'::jsonb)) from public.startoday_surveys s where s.class_id=cid and s.status='open' order by s.created_at desc limit 1));
 return result||jsonb_build_object('meeting',public.startoday_meeting_payload(cid,sid,false));
end $$;
revoke all on function public.startoday_student_payload(uuid,text) from public,anon,authenticated;
-- Remove the code-based public API so it cannot bypass mandatory password changes.
drop function if exists public.startoday_student_login(text,text);
create or replace function public.startoday_student_authenticate(p_school text,p_grade text,p_class text,p_no integer,p_password text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare matches jsonb; cid uuid; sid text; student jsonb; config jsonb; initial text; expected text;
 v_failures integer; started timestamptz; must_change boolean; v_hash text; v_temporary boolean;
begin
 if p_school is null or length(trim(p_school))=0 or length(p_school)>200 or p_grade not in ('1','2','3','4','5','6') or p_grade is null or p_class is null or length(trim(p_class))=0 or length(p_class)>40 or p_no is null or p_no<1 or p_password is null or length(p_password)>200 or p_password ~ '[^가-힣0-9]' then return null;end if;
 select jsonb_agg(jsonb_build_object('cid',s.class_id,'sid',s.id)) into matches
 from public.startoday_students s join public.startoday_settings cfg on cfg.class_id=s.class_id and cfg.id='main'
 where s.data->>'deletedAt' is null and s.data->>'no'=p_no::text
 and (trim(p_school)=cfg.data->>'schoolName' or trim(p_school)=nullif(cfg.data->>'schoolCode',''))
 and cfg.data->>'grade'=p_grade and trim(cfg.data->>'classGroup')=trim(p_class);
 if matches is null or jsonb_array_length(matches)<>1 then return null;end if;
 cid:=(matches->0->>'cid')::uuid;sid:=matches->0->>'sid';
 -- Same lock ordering as teacher commits; re-read credentials after locking.
 perform 1 from public.startoday_classes where id=cid for update;
 select s.data,cfg.data into student,config from public.startoday_students s join public.startoday_settings cfg on cfg.class_id=s.class_id and cfg.id='main'
 where s.class_id=cid and s.id=sid and s.data->>'deletedAt' is null and s.data->>'no'=p_no::text
 and (trim(p_school)=cfg.data->>'schoolName' or trim(p_school)=nullif(cfg.data->>'schoolCode',''))
 and cfg.data->>'grade'=p_grade and trim(cfg.data->>'classGroup')=trim(p_class);
 if student is null then return null;end if;
 -- Fail closed: a class that never set its own initial password has no shared value to fall back on.
 initial:=nullif(btrim(coalesce(config->>'defaultStudentPassword','')),'');
 select x.password_hash,x.must_change into v_hash,v_temporary from public.startoday_student_secrets x where x.class_id=cid and x.student_id=sid;
 insert into public.startoday_student_login_attempts(class_id,student_id) values(cid,sid) on conflict do nothing;
 select a.failures,a.window_start into v_failures,started from public.startoday_student_login_attempts a where a.class_id=cid and a.student_id=sid for update;
 if started<now()-interval '15 minutes' then v_failures:=0;started:=now();end if;
 if v_failures>=10 then return null;end if;
 if v_hash is not null then
  -- Bcrypt hashes are checked in constant time by the extension; plaintext never returns.
  must_change:=coalesce(v_temporary,false);
  if not public.startoday_password_matches(p_password,v_hash) then
   update public.startoday_student_login_attempts a set failures=v_failures+1,window_start=started where a.class_id=cid and a.student_id=sid;
   return null;
  end if;
 else
  -- Legacy rows keep logging in with the password they had; the plaintext is replaced here.
  expected:=case when student->>'passwordResetRequired'='true' or student->>'passwordChanged'='false'
  or (coalesce(student->>'passwordChanged','false')<>'true' and (student->>'password' is null or student->>'password'='12345'))
  then initial else coalesce(student->>'password',initial) end;
  if p_password is distinct from expected then
   update public.startoday_student_login_attempts a set failures=v_failures+1,window_start=started where a.class_id=cid and a.student_id=sid;
   return null;
  end if;
  must_change:=expected=initial or not public.startoday_password_is_valid(expected);
  if student ? 'password' then
   if expected is distinct from initial then
    insert into public.startoday_student_secrets(class_id,student_id,password_hash,must_change) values(cid,sid,public.startoday_password_hash(expected),must_change) on conflict(class_id,student_id) do nothing;
   end if;
   update public.startoday_students set data=data-'password',updated_at=now() where class_id=cid and id=sid;
   student:=student-'password';
  end if;
 end if;
 update public.startoday_student_login_attempts a set failures=0,window_start=now() where a.class_id=cid and a.student_id=sid;
 must_change:=coalesce(student->>'passwordChanged','false')<>'true' or student->>'passwordResetRequired'='true' or coalesce(must_change,false);
 return jsonb_build_object('cid',cid,'sid',sid,'student',student,'config',config,'mustChangePassword',coalesce(must_change,false));
end $$;
revoke all on function public.startoday_student_authenticate(text,text,text,integer,text) from public,anon,authenticated;
create or replace function public.startoday_student_login(p_school text,p_grade text,p_class text,p_no integer,p_password text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null then return null;end if;
 if verified->>'mustChangePassword'='true' then return jsonb_build_object('mustChangePassword',true);end if;
 return public.startoday_student_payload((verified->>'cid')::uuid,verified->>'sid')||jsonb_build_object('mustChangePassword',false);
end $$;
revoke all on function public.startoday_student_login(text,text,text,integer,text) from public;
grant execute on function public.startoday_student_login(text,text,text,integer,text) to anon,authenticated;
create or replace function public.startoday_student_change_password(p_school text,p_grade text,p_class text,p_no integer,p_old_password text,p_new_password text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb; cid uuid; sid text; initial text; rev bigint; owner uuid;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_old_password);
 if verified is null then return null;end if;
 initial:=nullif(btrim(coalesce(verified->'config'->>'defaultStudentPassword','')),'');
 -- The class initial password is one-shot: it may only open a change for a student who has none yet.
 -- A student who already set a personal password can only be changed with that personal password.
 if verified->>'mustChangePassword' is distinct from 'true' and initial is not null and p_old_password=initial then raise exception 'INITIAL_PASSWORD_REVOKED';end if;
 if p_new_password is null or char_length(p_new_password)<5 or char_length(p_new_password)>200 or p_new_password !~ '[가-힣]' or p_new_password ~ '[^가-힣0-9]' or p_new_password is not distinct from initial or p_new_password=p_old_password then raise exception 'INVALID_STUDENT_PASSWORD';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 insert into public.startoday_student_secrets(class_id,student_id,password_hash,must_change,updated_at) values(cid,sid,public.startoday_password_hash(p_new_password),false,now()) on conflict(class_id,student_id) do update set password_hash=excluded.password_hash,must_change=false,updated_at=now();
 update public.startoday_students set data=(data-'password')||jsonb_build_object('passwordChanged',true,'passwordResetRequired',false,'passwordChangedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now() where class_id=cid and id=sid;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision,owner_id into rev,owner;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(owner,cid,rev,'students',sid,'student_password_change');
 delete from public.startoday_student_login_attempts where class_id=cid and student_id=sid;
 return public.startoday_student_payload(cid,sid)||jsonb_build_object('mustChangePassword',false);
end $$;
revoke all on function public.startoday_student_change_password(text,text,text,integer,text,text) from public;
grant execute on function public.startoday_student_change_password(text,text,text,integer,text,text) to anon,authenticated;
-- Teacher reset also clears a failed-login lock, including reset to the same value.
create or replace function public.startoday_student_reset_attempts() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.data->>'passwordResetRequired'='true' then delete from public.startoday_student_login_attempts where class_id=new.class_id and student_id=new.id;end if;
 return new;
end $$;
revoke all on function public.startoday_student_reset_attempts() from public,anon,authenticated;
drop trigger if exists student_password_reset_attempts on public.startoday_students;
create trigger student_password_reset_attempts after update on public.startoday_students for each row execute function public.startoday_student_reset_attempts();
-- Only an authenticated, non-reset student assigned as checker can use these.
-- No teacher record, password, private state memo or unrelated student profile is returned.
create or replace function public.startoday_checker_payload(cid uuid,sid text,aid text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a jsonb; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD'); roster jsonb;
begin
 select data into a from public.startoday_assignments where class_id=cid and id=aid;
 if a is null or a->>'isQuest'='true' or a->>'checkerStudentId' is distinct from sid or not public.startoday_assignment_occurs(a,day) then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'no',s.data->'no','name',s.data->>'name',
 'excluded',exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=s.id and atd.data->>'date'=day and atd.data->>'excluded'='true'),
 'completed',coalesce(st.data->>'status' in ('완료','늦게완료','면제'),false)) order by (s.data->>'no')::integer),'[]'::jsonb) into roster
 from public.startoday_students s left join public."startoday_assignmentStates" st on st.class_id=cid and st.id=aid||':'||day||':'||s.id
 where s.class_id=cid and s.data->>'deletedAt' is null and (a->'target'='"all"'::jsonb or a->'target'->'studentIds' ? s.id);
 return jsonb_build_object('classId',cid,'revision',(select revision from public.startoday_classes where id=cid),'assignment',jsonb_build_object('id',aid,'title',a->>'title'),'students',roster);
end $$;
revoke all on function public.startoday_checker_payload(uuid,text,text) from public,anon,authenticated;
create or replace function public.startoday_student_checker_list(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_assignment text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 return public.startoday_checker_payload((verified->>'cid')::uuid,verified->>'sid',p_assignment);
end $$;
revoke all on function public.startoday_student_checker_list(text,text,text,integer,text,text) from public;
grant execute on function public.startoday_student_checker_list(text,text,text,integer,text,text) to anon,authenticated;
create or replace function public.startoday_student_checker_set(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_assignment text,p_student text,p_completed boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb; cid uuid; sid text; checklist jsonb; a jsonb; old_state jsonb; old_record jsonb; state_key text; rid text; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD'); owner uuid; rev bigint; stamp text; v jsonb;
begin
 -- Authentication locks the class before checking assignment/target permissions or writing.
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' or p_completed is null then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 checklist:=public.startoday_checker_payload(cid,sid,p_assignment);
 if checklist is null or not exists(select 1 from jsonb_array_elements(checklist->'students') s where s->>'id'=p_student and s->>'excluded'='false') then return null;end if;
 select data into a from public.startoday_assignments where class_id=cid and id=p_assignment;
 select owner_id into owner from public.startoday_classes where id=cid;
 state_key:=p_assignment||':'||day||':'||p_student;
 select data into old_state from public."startoday_assignmentStates" where class_id=cid and id=state_key;
 select data into old_record from public.startoday_records where class_id=cid and data->>'autoRef'=state_key;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 v:=coalesce(old_state,'{}'::jsonb)||jsonb_build_object('id',state_key,'assignmentId',p_assignment,'date',day,'studentId',p_student,'status',case when p_completed then '완료' else '진행중' end,'updatedAt',stamp);
 insert into public."startoday_assignmentStates"(class_id,owner_id,id,data) values(cid,owner,state_key,v) on conflict(class_id,id) do update set data=excluded.data,updated_at=now();
 if p_completed and coalesce(a->>'noStar','false')<>'true' then
 rid:=coalesce(old_record->>'id','auto:'||state_key);
 v:=jsonb_build_object('id',rid,'date',day,'period','','studentIds',jsonb_build_array(p_student),'areas',case when nullif(a->>'statArea','') is null then '[]'::jsonb else jsonb_build_array(a->>'statArea') end,'area',a->'statArea','kind','칭찬','text',concat(a->>'title',' 완료'),'action','','autoRef',state_key,'printIncluded',true,'extraType',null,'incidentId',null,'createdAt',coalesce(old_record->>'createdAt',stamp),'updatedAt',stamp);
 insert into public.startoday_records(class_id,owner_id,id,data) values(cid,owner,rid,v) on conflict(class_id,id) do update set data=excluded.data,updated_at=now();
 else delete from public.startoday_records where class_id=cid and data->>'autoRef'=state_key;
 end if;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(owner,cid,rev,'assignmentStates',state_key,'peer_check');
 return public.startoday_checker_payload(cid,sid,p_assignment)||jsonb_build_object('snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_student_checker_set(text,text,text,integer,text,text,text,boolean) from public;
grant execute on function public.startoday_student_checker_set(text,text,text,integer,text,text,text,boolean) to anon,authenticated;

-- A student can toggle only their own assigned, non-exempt routine for today.
create or replace function public.startoday_student_routine_set(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_routine text,p_completed boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb; cid uuid; sid text; routine jsonb; old_state jsonb; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD'); state_key text; v jsonb; stamp text; owner uuid; rev bigint;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' or p_completed is null then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 select data into routine from public.startoday_routines where class_id=cid and id=p_routine and data->>'deletedAt' is null;
 if routine is null or not coalesce(routine->'target'='"all"'::jsonb or routine->'target'->'studentIds' ? sid,false) or routine->'exceptions'->day->>'exempt'='true' then return null;end if;
 if exists(select 1 from public.startoday_attendance where class_id=cid and data->>'studentId'=sid and data->>'date'=day and data->>'excluded'='true') then return null;end if;
 state_key:=p_routine||':'||day||':'||sid;
 select data into old_state from public."startoday_routineStates" where class_id=cid and id=state_key;
 if old_state->>'status'='면제' then return null;end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 v:=coalesce(old_state,'{}'::jsonb)||jsonb_build_object('id',state_key,'routineId',p_routine,'date',day,'studentId',sid,'status',case when p_completed then '완료' else '진행중' end,'updatedAt',stamp);
 select owner_id into owner from public.startoday_classes where id=cid;
 insert into public."startoday_routineStates"(class_id,owner_id,id,data) values(cid,owner,state_key,v) on conflict(class_id,id) do update set data=excluded.data,updated_at=now();
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(owner,cid,rev,'routineStates',state_key,'student_routine_check');
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_student_routine_set(text,text,text,integer,text,text,boolean) from public;
grant execute on function public.startoday_student_routine_set(text,text,text,integer,text,text,boolean) to anon,authenticated;

-- Students may equip only their own earned title, never arbitrary profile fields.
create or replace function public.startoday_student_title_set(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_title text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb; cid uuid; sid text; counts jsonb; title_id text:=nullif(p_title,''); domain text; level integer; goal integer; owner uuid; rev bigint;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 perform 1 from public.startoday_classes where id=cid for update;
 counts:=public.startoday_kingdom_counts(cid,sid);
 if title_id is not null then
  if exists(select 1 from public.startoday_students s cross join lateral jsonb_array_elements(coalesce(s.data->'rewardTitles','[]'::jsonb)) t where s.class_id=cid and s.id=sid and t->>'id'=title_id and title_id like 'quest:%') then null;
  else
   if title_id !~ '^(learning|tasks|relationships|challenge|life|jobs):[1-3]$' then return null;end if;
   domain:=split_part(title_id,':',1);level:=split_part(title_id,':',2)::integer;goal:=(public.startoday_title_config(cid)->>'goal')::integer;
   if coalesce((counts->>domain)::integer,0)<(case level when 1 then goal when 2 then goal * 2 else goal * 3 end) then return null;end if;
  end if;
 end if;
 update public.startoday_students set data=data||jsonb_build_object('equippedTitle',title_id,'updatedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now() where class_id=cid and id=sid and data->>'deletedAt' is null;
 if not found then return null;end if;
 select owner_id into owner from public.startoday_classes where id=cid;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(owner,cid,rev,'students',sid,'student_title_set');
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_student_title_set(text,text,text,integer,text,text) from public;
grant execute on function public.startoday_student_title_set(text,text,text,integer,text,text) to anon,authenticated;

create or replace function public.startoday_student_nickname_set(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;cid uuid;sid text;owner uuid;rev bigint;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 if p_nickname is not null and p_nickname !~ '^[가-힣]{1,8}$' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';perform 1 from public.startoday_classes where id=cid for update;
 update public.startoday_students set data=data||jsonb_build_object('nickname',p_nickname,'updatedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now() where class_id=cid and id=sid and data->>'deletedAt' is null;
 if not found then return null;end if;select owner_id into owner from public.startoday_classes where id=cid;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(owner,cid,rev,'students',sid,'student_nickname_set');
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_student_nickname_set(text,text,text,integer,text,text) from public;
grant execute on function public.startoday_student_nickname_set(text,text,text,integer,text,text) to anon,authenticated;
-- All writers lock the class first, then the item. Contributions and the debit share one transaction.
create or replace function public.startoday_group_buy_mutate(cid uuid,sid text,target uuid,requested integer,use_reward boolean default false) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;item public.startoday_shop_items;prior public.startoday_group_buy_contribs;paid integer;total integer;rev bigint;txid uuid:=gen_random_uuid();stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 select * into c from public.startoday_classes where id=cid for update;
 if c.id is null then raise exception 'FORBIDDEN';end if;
 perform public.startoday_finance_settle(cid);
 select * into item from public.startoday_shop_items where class_id=cid and id=target and data->>'deletedAt' is null for update;
 if item.id is null or not item.is_group_buy then raise exception 'INVALID_GROUP_BUY';end if;
 if use_reward then
  if auth.uid() is distinct from c.owner_id then raise exception 'FORBIDDEN';end if;
  if not item.is_funded or item.is_used then raise exception 'INVALID_GROUP_USE';end if;
  update public.startoday_shop_items set data=data||jsonb_build_object('isUsed',true),updated_at=now() where id=target;
 else
  if not exists(select 1 from public.startoday_students where class_id=cid and id=sid and data->>'deletedAt' is null) then raise exception 'INVALID_STUDENT';end if;
  if requested is null or requested not between 1 and 1000000000 then raise exception 'INVALID_AMOUNT';end if;
  if item.is_funded or item.is_used or item.group_collected>=item.group_goal then raise exception 'GROUP_BUY_CLOSED';end if;
  paid:=least(requested,item.group_goal-item.group_collected);
  if public.startoday_coin_balance(cid,sid)<paid then raise exception 'INSUFFICIENT_BALANCE';end if;
  total:=item.group_collected+paid;
  select * into prior from public.startoday_group_buy_contribs where class_id=cid and item_id=target and student_id=sid;
  insert into public.startoday_group_buy_contribs(class_id,owner_id,id,data) values(cid,c.owner_id,target::text||':'||sid,jsonb_build_object('id',target::text||':'||sid,'itemId',target,'studentId',sid,'amount',coalesce(prior.amount,0)+paid,'createdAt',coalesce(prior.data->>'createdAt',stamp),'updatedAt',stamp)) on conflict(class_id,id) do update set data=excluded.data;
  update public.startoday_shop_items set data=data||jsonb_build_object('groupCollected',total,'isFunded',total>=item.group_goal),updated_at=now() where id=target;
  insert into public.startoday_economy_tx(id,owner_id,class_id,student_id,data) values(txid,c.owner_id,cid,sid,jsonb_build_object('id',txid,'studentId',sid,'type','차감','amount',-paid,'itemId',target,'itemName',item.data->>'name','itemCategory',coalesce(item.data->>'category','기타'),'groupBuy',true,'status',null,'memo','학급 공동구매 기여','createdAt',stamp));
 end if;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'shop_items',target::text,case when use_reward then 'group_use' else 'fund' end);
 return rev;
end $$;
revoke all on function public.startoday_group_buy_mutate(uuid,text,uuid,integer,boolean) from public,anon,authenticated;
create or replace function public.startoday_shop_fund_group_buy(p_student_id text,p_item_id uuid,p_amount integer,p_school text default null,p_grade text default null,p_class text default null,p_no integer default null,p_password text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;cid uuid;sid text;rev bigint;
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then raise exception 'AUTH_REQUIRED';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 if sid is distinct from p_student_id then raise exception 'FORBIDDEN';end if;
 rev:=public.startoday_group_buy_mutate(cid,sid,p_item_id,p_amount);
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_shop_fund_group_buy(text,uuid,integer,text,text,text,integer,text) from public;
grant execute on function public.startoday_shop_fund_group_buy(text,uuid,integer,text,text,text,integer,text) to anon,authenticated;
create or replace function public.startoday_shop_use_group_buy(p_teacher_id uuid,p_item_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_teacher_id then raise exception 'FORBIDDEN';end if;
 select class_id into cid from public.startoday_shop_items where id=p_item_id and owner_id=auth.uid();
 if cid is null then raise exception 'FORBIDDEN';end if;
 perform public.startoday_group_buy_mutate(cid,null,p_item_id,0,true);
 return public.startoday_snapshot();
end $$;
revoke all on function public.startoday_shop_use_group_buy(uuid,uuid) from public,anon;
grant execute on function public.startoday_shop_use_group_buy(uuid,uuid) to authenticated;
-- A single class-row lock serializes all balance/stock decisions with teacher commits.
create or replace function public.startoday_economy_mutate(cid uuid,sid text,action text,target uuid,amount integer default 0,memo text default '') returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;item public.startoday_shop_items;holding public.startoday_economy_tx;v jsonb;txid uuid:=gen_random_uuid();stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');rev bigint;price integer;kind text;
begin
 if action in ('fund','group_use') then return public.startoday_group_buy_mutate(cid,sid,target,amount,action='group_use');end if;
 select * into c from public.startoday_classes where id=cid for update;
 if c.id is null or not exists(select 1 from public.startoday_students where class_id=cid and id=sid and data->>'deletedAt' is null) then raise exception 'INVALID_STUDENT';end if;
 perform public.startoday_finance_settle(cid);
 if action in ('buy','gift') then
  select * into item from public.startoday_shop_items where class_id=cid and id=target and data->>'deletedAt' is null for update;
  if item.id is null then raise exception 'ITEM_UNAVAILABLE';end if;
  if item.is_group_buy then raise exception 'INVALID_GROUP_BUY';end if;
  price:=(item.data->>'price')::integer;
  if item.data->'stock'<>'null'::jsonb and (item.data->>'stock')::integer<=0 then raise exception 'SOLD_OUT';end if;
  if action='buy' and public.startoday_coin_balance(cid,sid)<price then raise exception 'INSUFFICIENT_BALANCE';end if;
  if item.data->'stock'<>'null'::jsonb then update public.startoday_shop_items set data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::integer-1)),updated_at=now() where id=item.id;end if;
  kind:=case when action='buy' then '구매' else '선물' end;
  v:=jsonb_build_object('id',txid,'studentId',sid,'type',kind,'itemId',item.id,'itemName',item.data->>'name','itemCategory',coalesce(item.data->>'category','기타'),'amount',case when action='buy' then -price else 0 end,'status','보유','memo','','createdAt',stamp);
 elsif action in ('refund','use') then
  select * into holding from public.startoday_economy_tx where class_id=cid and id=target and student_id=sid and data->>'status'='보유' and data->>'type' in ('구매','선물') for update;
  if holding.id is null then raise exception 'INVALID_HOLDING';end if;
  if action='refund' then
   if coalesce((select data->>'allowRefund' from public.startoday_settings where class_id=cid and id='main'),'true')='false' and auth.uid() is distinct from c.owner_id then raise exception 'REFUNDS_DISABLED';end if;
   if holding.data->>'type'<>'구매' then raise exception 'INVALID_HOLDING';end if;
   update public.startoday_shop_items set data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::integer+1)),updated_at=now() where class_id=cid and id=(holding.data->>'itemId')::uuid and data->'stock'<>'null'::jsonb;
   update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"환불됨"'),updated_at=now() where id=holding.id;
   v:=jsonb_build_object('id',txid,'studentId',sid,'type','환불','itemId',holding.data->>'itemId','itemName',holding.data->>'itemName','itemCategory',coalesce(holding.data->>'itemCategory',(select i.data->>'category' from public.startoday_shop_items i where i.class_id=cid and i.id::text=holding.data->>'itemId'),'기타'),'amount',-(holding.data->>'amount')::integer,'originalTxId',holding.id,'status',null,'memo','','createdAt',stamp);
  else
   update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"사용완료"'),updated_at=now() where id=holding.id;
   v:=jsonb_build_object('id',txid,'studentId',sid,'type','사용','amount',0,'itemId',holding.data->>'itemId','itemName',holding.data->>'itemName','itemCategory',coalesce(holding.data->>'itemCategory','기타'),'originalTxId',holding.id,'status',null,'memo','','createdAt',stamp);
  end if;
 elsif action='undo_gift' then
  if auth.uid() is distinct from c.owner_id then raise exception 'FORBIDDEN';end if;
  select * into holding from public.startoday_economy_tx where class_id=cid and id=target and student_id=sid and data->>'status'='보유' and data->>'type'='선물' for update;
  if holding.id is null then raise exception 'INVALID_HOLDING';end if;
  if clock_timestamp()>=holding.created_at+interval '5 seconds' or clock_timestamp()<holding.created_at then raise exception 'GIFT_UNDO_EXPIRED';end if;
  select * into item from public.startoday_shop_items where class_id=cid and id=(holding.data->>'itemId')::uuid for update;
  if item.data->'stock'<>'null'::jsonb then
   if (item.data->>'stock')::integer>=1000000000 then raise exception 'STOCK_LIMIT';end if;
   update public.startoday_shop_items set data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::integer+1)),updated_at=now() where id=item.id;
  end if;
  update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"취소됨"'),updated_at=now() where id=holding.id;
  v:=jsonb_build_object('id',txid,'studentId',sid,'type','선물취소','amount',0,'itemId',holding.data->>'itemId','itemName',holding.data->>'itemName','itemCategory',coalesce(holding.data->>'itemCategory','기타'),'originalTxId',holding.id,'status',null,'memo','5초 내 선물 취소','createdAt',stamp);
 elsif action='reclaim' then
  if auth.uid() is distinct from c.owner_id then raise exception 'FORBIDDEN';end if;
  if amount not in (0,1) or amount is null then raise exception 'INVALID_AMOUNT';end if;
  select * into holding from public.startoday_economy_tx where class_id=cid and id=target and student_id=sid and data->>'status'='보유' and data->>'type' in ('구매','선물') for update;
  if holding.id is null then raise exception 'INVALID_HOLDING';end if;
  if amount=1 then
   select * into item from public.startoday_shop_items where class_id=cid and id=(holding.data->>'itemId')::uuid for update;
   if item.data->'stock'<>'null'::jsonb then
    if (item.data->>'stock')::integer>=1000000000 then raise exception 'STOCK_LIMIT';end if;
    update public.startoday_shop_items set data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::integer+1)),updated_at=now() where id=item.id;
   end if;
  end if;
  update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"회수됨"'),updated_at=now() where id=holding.id;
  v:=jsonb_build_object('id',txid,'studentId',sid,'type','회수','amount',0,'itemId',holding.data->>'itemId','itemName',holding.data->>'itemName','itemCategory',coalesce(holding.data->>'itemCategory','기타'),'originalTxId',holding.id,'restoreStock',amount=1,'status',null,'memo','교사 물품 회수','createdAt',stamp);
 elsif action='adjust' then
  if amount is null or amount=0 or abs(amount::bigint)>1000000000 then raise exception 'INVALID_AMOUNT';end if;
  v:=jsonb_build_object('id',txid,'studentId',sid,'type',case when amount>0 then '지급' else '차감' end,'amount',amount,'status',null,'memo',left(coalesce(memo,''),2000),'createdAt',stamp);
 else raise exception 'INVALID_ACTION';end if;
 if v is not null then insert into public.startoday_economy_tx(id,owner_id,class_id,student_id,data,created_at) values(txid,c.owner_id,cid,sid,v,clock_timestamp());end if;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'economy_tx',txid::text,action);
 if item.id is not null then insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'shop_items',item.id::text,'stock_'||action);end if;
 if action='use' then insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'economy_tx',holding.id::text,'used');end if;
 if action='refund' then
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'economy_tx',holding.id::text,'refunded');
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'shop_items',holding.data->>'itemId','stock_refund');
 end if;
 return rev;
end $$;
revoke all on function public.startoday_economy_mutate(uuid,text,text,uuid,integer,text) from public,anon,authenticated;
create or replace function public.startoday_economy_action(p_class_id uuid,p_student text,p_action text,p_target uuid default null,p_amount integer default 0,p_memo text default '') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.startoday_classes where id=p_class_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN';end if;
 rev:=public.startoday_economy_mutate(p_class_id,p_student,p_action,p_target,p_amount,p_memo);
 return public.startoday_snapshot()||jsonb_build_object('transactionId',(select row_id from public.startoday_audit where class_id=p_class_id and revision=rev and table_name='economy_tx' and operation=p_action order by id desc limit 1));
end $$;
revoke all on function public.startoday_economy_action(uuid,text,text,uuid,integer,text) from public,anon;
grant execute on function public.startoday_economy_action(uuid,text,text,uuid,integer,text) to authenticated;

create or replace function public.startoday_shop_buy(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_item_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare verified jsonb;cid uuid;sid text;rev bigint;
 begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 rev:=public.startoday_economy_mutate(cid,sid,'buy',p_item_id);
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
 end $$;
 revoke all on function public.startoday_shop_buy(text,text,text,integer,text,uuid) from public;
 grant execute on function public.startoday_shop_buy(text,text,text,integer,text,uuid) to anon,authenticated;

create or replace function public.startoday_shop_refund(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_tx_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare verified jsonb;cid uuid;sid text;rev bigint;
 begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 rev:=public.startoday_economy_mutate(cid,sid,'refund',p_tx_id);
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
 end $$;
 revoke all on function public.startoday_shop_refund(text,text,text,integer,text,uuid) from public;
 grant execute on function public.startoday_shop_refund(text,text,text,integer,text,uuid) to anon,authenticated;

create or replace function public.startoday_shop_use(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_tx_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare verified jsonb;cid uuid;sid text;rev bigint;
 begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 rev:=public.startoday_economy_mutate(cid,sid,'use',p_tx_id);
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
 end $$;
 revoke all on function public.startoday_shop_use(text,text,text,integer,text,uuid) from public;
 grant execute on function public.startoday_shop_use(text,text,text,integer,text,uuid) to anon,authenticated;

commit;


begin;
create unique index if not exists startoday_one_use on public.startoday_economy_tx(class_id,(data->>'originalTxId')) where data->>'type'='사용';
create or replace function public.startoday_avatar_mutate(cid uuid,sid text,item_id text,action text) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.startoday_classes;student jsonb;item jsonb;owned jsonb;equipped jsonb;rev bigint;txid uuid:=gen_random_uuid();v jsonb;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 select * into c from public.startoday_classes where id=cid for update;
 select data into student from public.startoday_students where class_id=cid and id=sid and data->>'deletedAt' is null for update;
 if c.id is null or student is null then raise exception 'INVALID_STUDENT';end if;
 perform public.startoday_finance_settle(cid);
 select value into item from jsonb_array_elements(public.startoday_avatar_catalog()) where value->>'id'=item_id;
 if item is null or action not in ('buy','equip') then raise exception 'INVALID_AVATAR_ITEM';end if;
 owned:=case when jsonb_typeof(student->'avatarOwned')='array' then student->'avatarOwned' else '[]'::jsonb end;equipped:=case when jsonb_typeof(student->'avatarEquipped')='object' then student->'avatarEquipped' else '{}'::jsonb end;
 if action='buy' then
  if owned ? item_id then raise exception 'AVATAR_ALREADY_OWNED';end if;
  if public.startoday_coin_balance(cid,sid)<(item->>'price')::integer then raise exception 'INSUFFICIENT_BALANCE';end if;
  owned:=owned||jsonb_build_array(item_id);
  v:=jsonb_build_object('id',txid,'studentId',sid,'type','아바타구매','amount',-(item->>'price')::integer,'itemId',item_id,'itemName',item->>'name','itemCategory',item->>'category','status',null,'memo','','createdAt',stamp);
  insert into public.startoday_economy_tx(id,owner_id,class_id,student_id,data) values(txid,c.owner_id,cid,sid,v);
  insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,c.revision+1,'economy_tx',txid::text,'avatar_buy');
 else
  if not(owned ? item_id) then raise exception 'AVATAR_NOT_OWNED';end if;
  if equipped->>(item->>'category')=item_id then equipped:=equipped-(item->>'category');else equipped:=equipped||jsonb_build_object(item->>'category',item_id);end if;
 end if;
 update public.startoday_students set data=data||jsonb_build_object('avatarOwned',owned,'avatarEquipped',equipped),updated_at=now() where class_id=cid and id=sid;
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 insert into public.startoday_audit(owner_id,class_id,revision,table_name,row_id,operation) values(c.owner_id,cid,rev,'students',sid,'avatar_'||action);
 return rev;
end $$;
revoke all on function public.startoday_avatar_mutate(uuid,text,text,text) from public,anon,authenticated;
create or replace function public.startoday_avatar_buy(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_item_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare verified jsonb;cid uuid;sid text;rev bigint;
 begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 rev:=public.startoday_avatar_mutate(cid,sid,p_item_id,'buy');
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
 end $$;
 revoke all on function public.startoday_avatar_buy(text,text,text,integer,text,text) from public;
 grant execute on function public.startoday_avatar_buy(text,text,text,integer,text,text) to anon,authenticated;
create or replace function public.startoday_avatar_equip(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_item_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare verified jsonb;cid uuid;sid text;rev bigint;
 begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then return null;end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 rev:=public.startoday_avatar_mutate(cid,sid,p_item_id,'equip');
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
 end $$;
 revoke all on function public.startoday_avatar_equip(text,text,text,integer,text,text) from public;
 grant execute on function public.startoday_avatar_equip(text,text,text,integer,text,text) to anon,authenticated;
create or replace function public.startoday_student_survey_submit(p_school text,p_grade text,p_class text,p_no integer,p_password text,p_survey text,p_placements jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare verified jsonb;cid uuid;sid text;owner uuid;s public.startoday_surveys;expected integer;entry jsonb;tag jsonb;allowed_tags jsonb;tag_config jsonb;rev bigint;rid text:=gen_random_uuid()::text;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 verified:=public.startoday_student_authenticate(p_school,p_grade,p_class,p_no,p_password);
 if verified is null or verified->>'mustChangePassword'='true' then raise exception 'STUDENT_AUTH_REQUIRED';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 select owner_id into owner from public.startoday_classes where id=cid for update;
 select * into s from public.startoday_surveys where class_id=cid and id=p_survey for update;
 if s.id is null or s.status<>'open' then raise exception 'SURVEY_CLOSED';end if;
 if exists(select 1 from public.startoday_survey_responses where class_id=cid and survey_id=s.id and student_id=sid) then raise exception 'SURVEY_ALREADY_SUBMITTED';end if;
 tag_config:=public.startoday_survey_reason_tags(s.data->'reasonTags');
 allowed_tags:=(tag_config->'comfortable')||(tag_config->'uncomfortable');
 select count(*) into expected from public.startoday_students where class_id=cid and id<>sid and data->>'deletedAt' is null;
 if jsonb_typeof(p_placements) is distinct from 'array' then raise exception 'INVALID_PLACEMENTS';end if;
 if jsonb_array_length(p_placements)<>expected or (select count(distinct value->>'targetId') from jsonb_array_elements(p_placements))<>expected then raise exception 'INVALID_PLACEMENTS';end if;
 for entry in select * from jsonb_array_elements(p_placements) loop
  if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'x') is distinct from 'number' or jsonb_typeof(entry->'y') is distinct from 'number' or entry ? 'reason' and entry->'reason'<>'null'::jsonb and jsonb_typeof(entry->'reason') is distinct from 'string' or length(entry->>'reason')>300 or not exists(select 1 from public.startoday_students where class_id=cid and id=entry->>'targetId' and id<>sid and data->>'deletedAt' is null) then raise exception 'INVALID_PLACEMENTS';end if;
  if (entry->>'x')::numeric not between 0 and 100 or (entry->>'y')::numeric not between 0 and 100 then raise exception 'INVALID_PLACEMENTS';end if;
  if entry ? 'tags' and entry->'tags'<>'null'::jsonb then
   if jsonb_typeof(entry->'tags') is distinct from 'array' then raise exception 'INVALID_SURVEY_TAGS';end if;
   if jsonb_array_length(entry->'tags')>40 or (select count(distinct value) from jsonb_array_elements(entry->'tags'))<>jsonb_array_length(entry->'tags') then raise exception 'INVALID_SURVEY_TAGS';end if;
   for tag in select * from jsonb_array_elements(entry->'tags') loop
    if jsonb_typeof(tag) is distinct from 'string' or not(allowed_tags ? (tag#>>'{}')) then raise exception 'INVALID_SURVEY_TAGS';end if;
   end loop;
  end if;
 end loop;
 insert into public.startoday_survey_responses(class_id,owner_id,id,data) values(cid,owner,rid,jsonb_build_object('id',rid,'surveyId',s.id,'studentId',sid,'placements',(select coalesce(jsonb_agg(jsonb_build_object('targetId',value->>'targetId','x',value->'x','y',value->'y','reason',coalesce(value->>'reason',''),'tags',case when jsonb_typeof(value->'tags')='array' then value->'tags' else '[]'::jsonb end)),'[]'::jsonb) from jsonb_array_elements(p_placements)),'submittedAt',stamp));
 update public.startoday_classes set revision=revision+1 where id=cid returning revision into rev;
 return jsonb_build_object('classId',cid,'revision',rev,'snapshot',public.startoday_student_payload(cid,sid));
end $$;
revoke all on function public.startoday_student_survey_submit(text,text,text,integer,text,text,jsonb) from public;
grant execute on function public.startoday_student_survey_submit(text,text,text,integer,text,text,jsonb) to anon,authenticated;
-- One-time in-place migration: existing plaintext passwords become hashes the same value still opens.
-- Rows still on the class initial password keep following the current setting instead of being frozen.
do $$ declare r record; initial text; expected text;
begin
 for r in select s.class_id,s.id,s.data,cfg.data as cfg from public.startoday_students s join public.startoday_settings cfg on cfg.class_id=s.class_id and cfg.id='main' where s.data ? 'password' loop
  initial:=nullif(btrim(coalesce(r.cfg->>'defaultStudentPassword','')),'');
  expected:=case when r.data->>'passwordResetRequired'='true' or r.data->>'passwordChanged'='false'
  or (coalesce(r.data->>'passwordChanged','false')<>'true' and (r.data->>'password' is null or r.data->>'password'='12345'))
  then initial else coalesce(r.data->>'password',initial) end;
  if expected is distinct from initial and not exists(select 1 from public.startoday_student_secrets x where x.class_id=r.class_id and x.student_id=r.id) then
   insert into public.startoday_student_secrets(class_id,student_id,password_hash,must_change) values(r.class_id,r.id,public.startoday_password_hash(expected),not public.startoday_password_is_valid(expected)) on conflict(class_id,student_id) do nothing;
  end if;
  update public.startoday_students set data=data-'password' where class_id=r.class_id and id=r.id and data ? 'password';
 end loop;
 -- A class with students but no settings cannot log anyone in; its plaintext is still removed.
 update public.startoday_students set data=data-'password' where data ? 'password';
end $$;
commit;
