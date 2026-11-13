-- 오늘의 별 1단계 / Supabase SQL Editor에서 전체 실행
begin;
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
 foreach t in array array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'] loop
 execute format('create table if not exists public.%I (class_id uuid not null references public.startoday_classes(id),owner_id uuid not null references auth.users(id),id text not null,data jsonb not null check(jsonb_typeof(data)=''object'' and data->>''id''=id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(class_id,id))','startoday_'||t);
 execute format('alter table public.%I enable row level security','startoday_'||t);
 execute format('drop policy if exists own_rows on public.%I','startoday_'||t);
 execute format('create policy own_rows on public.%I for select to authenticated using(owner_id=auth.uid())','startoday_'||t);
 execute format('revoke all on public.%I from anon,authenticated','startoday_'||t);
 execute format('grant select on public.%I to authenticated','startoday_'||t);
 end loop;
end $$;
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
 data jsonb not null check(data ?& array['id','studentId','type','amount','createdAt'] and jsonb_typeof(data)='object' and data->>'id'=id::text and data->>'studentId'=student_id and data->>'type' in ('구매','환불','선물','지급','차감','회수','선물취소') and jsonb_typeof(data->'amount')='number' and abs((data->>'amount')::numeric)<=1000000000 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric)),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(class_id,id)
);
-- Extend the existing ledger without rewriting historical transactions.
alter table public.startoday_economy_tx drop constraint if exists startoday_economy_tx_data_check;
alter table public.startoday_economy_tx add constraint startoday_economy_tx_data_check check(data ?& array['id','studentId','type','amount','createdAt'] and jsonb_typeof(data)='object' and data->>'id'=id::text and data->>'studentId'=student_id and data->>'type' in ('구매','환불','선물','지급','차감','회수','선물취소') and jsonb_typeof(data->'amount')='number' and abs((data->>'amount')::numeric)<=1000000000 and (data->>'amount')::numeric=trunc((data->>'amount')::numeric));
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
create or replace function public.startoday_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; result jsonb:='{}'; t text; rows jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.startoday_classes(owner_id) values(auth.uid()) on conflict(owner_id) do nothing;
 select * into c from public.startoday_classes where owner_id=auth.uid();
 -- 공유 잠금으로 여러 테이블 읽기 도중 다른 기기가 수정하지 못하게 합니다.
 perform 1 from public.startoday_classes where id=c.id for share;
 foreach t in array array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas','shop_items','economy_tx','group_buy_contribs'] loop
 execute format('select coalesce(jsonb_agg(data),''[]''::jsonb) from public.%I where class_id=$1 and owner_id=$2','startoday_'||t) into rows using c.id,auth.uid();
 result:=result||jsonb_build_object(t,rows);
 end loop;
 select * into c from public.startoday_classes where id=c.id;
 return jsonb_build_object('class_id',c.id,'revision',c.revision,'data',result);
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
 if not(t=any(array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas','shop_items','economy_tx','group_buy_contribs'])) or coalesce(op->>'id','')='' then raise exception 'INVALID_TABLE_OR_ID'; end if;
 if coalesce((op->>'remove')::boolean,false) then
 execute format('delete from public.%I where class_id=$1 and id::text=$2','startoday_'||t) using c.id,op->>'id';
 else
 v:=op->'data';
 if jsonb_typeof(v)<>'object' or v->>'id' is distinct from op->>'id' then raise exception 'INVALID_DATA'; end if;
 if t='settings' and v ? 'allowRefund' and jsonb_typeof(v->'allowRefund')<>'boolean' then raise exception 'INVALID_REFUND_SETTING';end if;
 if t='settings' and v ? 'studentPraisePeriod' and (jsonb_typeof(v->'studentPraisePeriod') is distinct from 'string' or v->>'studentPraisePeriod' not in ('all','30d','7d','month','recent3')) then raise exception 'INVALID_STUDENT_PRAISE_PERIOD';end if;
 if t='settings' and v ? 'titleGoal' and (jsonb_typeof(v->'titleGoal')<>'number' or (v->>'titleGoal')::numeric<>trunc((v->>'titleGoal')::numeric) or (v->>'titleGoal')::numeric not between 3 and 9999) then raise exception 'INVALID_TITLE_GOAL';end if;
 if t='students' then
  if v->>'nickname' is not null and v->>'nickname' !~ '^[가-힣]{1,8}$' then raise exception 'INVALID_NICKNAME';end if;
  select data into old from public.startoday_students where class_id=c.id and id=op->>'id';
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
create or replace function public.startoday_coin_balance(cid uuid,sid text) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select sum(case when r.data->>'autoRef' is not null then case when a.data->>'noStar'='true' then 0 when ast.data->>'status'='완료' then 1 when ast.data->>'status'='안함' then -1 else 0 end else case r.data->>'kind' when '칭찬' then 1 when '지도' then -1 else 0 end end)*10 from public.startoday_records r left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId' where r.class_id=cid and r.data->'studentIds' ? sid and r.data->>'date'<=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')),0)+coalesce((select sum((data->>'amount')::bigint) from public.startoday_economy_tx where class_id=cid and student_id=sid),0)
$$;
create or replace function public.startoday_economy_payload(cid uuid,sid text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('studentId',sid,'balance',public.startoday_coin_balance(cid,sid),'allowRefund',coalesce((select data->>'allowRefund' from public.startoday_settings where class_id=cid and id='main'),'true')<>'false',
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'category',i.data->>'category','name',i.data->>'name','description',coalesce(i.data->>'description',''),'price',i.data->'price','stock',i.data->'stock','isGroupBuy',i.is_group_buy,'groupGoal',i.group_goal,'groupCollected',i.group_collected,'isFunded',i.is_funded,'isUsed',i.is_used,
 'contributors',case when i.is_group_buy then coalesce((select jsonb_agg(jsonb_build_object('studentId',gc.student_id,'name',case when st.data->>'deletedAt' is null then coalesce(st.data->>'name','전출 학생') else '전출 학생' end,'amount',gc.amount,'isMe',gc.student_id=sid) order by gc.amount desc,gc.student_id) from public.startoday_group_buy_contribs gc left join public.startoday_students st on st.class_id=gc.class_id and st.id=gc.student_id where gc.class_id=cid and gc.item_id=i.id),'[]'::jsonb) else '[]'::jsonb end) order by i.created_at,i.id) from public.startoday_shop_items i where i.class_id=cid and i.data->>'deletedAt' is null),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',data->>'type','itemId',data->>'itemId','itemName',data->>'itemName','itemCategory',coalesce(nullif(data->>'itemCategory',''),(select i.data->>'category' from public.startoday_shop_items i where i.class_id=cid and i.id::text=etx.data->>'itemId'),'기타'),'amount',data->'amount','status',data->>'status','createdAt',data->>'createdAt') order by created_at,id) from public.startoday_economy_tx etx where class_id=cid and student_id=sid),'[]'::jsonb))
$$;
revoke all on function public.startoday_coin_balance(uuid,text),public.startoday_economy_payload(uuid,text) from public,anon,authenticated;
create or replace function public.startoday_student_payload(cid uuid,sid text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student jsonb; config jsonb; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
 result jsonb; totals jsonb; letters jsonb; tasks jsonb; routines jsonb; timetable jsonb; calendar jsonb; praise_from text;
begin
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
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title','memo',coalesce(a.data->>'memo',''),'checkerName',coalesce((select concat(s.data->>'no','. ',s.data->>'name') from public.startoday_students s where s.class_id=cid and s.id=a.data->>'checkerStudentId' and s.data->>'deletedAt' is null),''),'date',due.date,'isQuest',coalesce(a.data->>'isQuest','false')='true','goal',coalesce((a.data->>'questGoal')::integer,10),'stamps',coalesce((st.data->>'stamps')::integer,0),'startDate',a.data->>'date','endDate',a.data->>'endDate','questSubtasks',coalesce(a.data->'questSubtasks','[]'::jsonb),'completedSubtasks',coalesce(st.data->'completedSubtasks',(select coalesce(jsonb_agg(x.value order by x.n),'[]'::jsonb) from jsonb_array_elements(coalesce(a.data->'questSubtasks','[]'::jsonb)) with ordinality x(value,n) where x.n<=coalesce((st.data->>'stamps')::integer,0))),'overdue',due.date<day,'status',case when coalesce(a.data->>'isQuest','false')<>'true' and exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=due.date and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by due.date,a.data->>'title'),'[]'::jsonb) into tasks
 from public.startoday_assignments a
 cross join lateral (select day as date where a.data->>'isQuest'='true' union all select to_char(value,'YYYY-MM-DD') as date from generate_series((a.data->>'date')::date,day::date,interval '1 day') value where coalesce(a.data->>'isQuest','false')<>'true') due
 left join public."startoday_assignmentStates" st on st.class_id=cid and st.id=a.id||':'||case when a.data->>'isQuest'='true' then a.data->>'date' else due.date end||':'||sid
 where a.class_id=cid and public.startoday_assignment_occurs(a.data,due.date) and (coalesce(a.data->>'isQuest','false')<>'true' or due.date=day)
 and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)
 and (due.date=day or (coalesce(st.data->>'status','진행중')='진행중' and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=due.date and atd.data->>'excluded'='true')));
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.data->>'title','status',case when r.data->'exceptions'->day->>'exempt'='true' or exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=day and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by coalesce((r.data->>'sortOrder')::numeric,0)),'[]'::jsonb) into routines
 from public.startoday_routines r left join public."startoday_routineStates" st on st.class_id=cid and st.id=r.id||':'||day||':'||sid
 where r.class_id=cid and r.data->>'deletedAt' is null and (r.data->'target'='"all"'::jsonb or r.data->'target'->'studentIds' ? sid);
 select coalesce(jsonb_agg(jsonb_build_object('period',t.data->'period','periodTime',config->'periodTimes'->>((t.data->>'period')::integer-1),'subject',t.data->>'subjectCode','publicMemo',coalesce(t.data->>'publicMemo',t.data->>'memo',''),'privateMemo',case when t.data->>'date'=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') then coalesce(t.data->>'privateMemo','') else '' end,'color',rules.data->>'color','accentColor',rules.data->>'accentColor','colorSource',rules.data->>'colorSource','defaultColorValue',rules.data->>'defaultColorValue','location',coalesce(nullif(t.data->>'locationOverride',''),rules.data->>'location','')) order by (t.data->>'period')::integer),'[]'::jsonb) into timetable
 from public.startoday_timetables t left join public.startoday_subject_rules rules on rules.class_id=cid and rules.data->>'code'=t.data->>'subjectCode'
 where t.class_id=cid and t.data->>'date'=day and (t.data->>'period')::integer between 1 and 6;
 select jsonb_build_object(
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title','date',a.data->>'date','endDate',a.data->>'endDate','repeat',a.data->'repeat','isQuest',coalesce(a.data->>'isQuest','false')='true','questGoal',coalesce((a.data->>'questGoal')::integer,10),'memo',coalesce(a.data->>'memo',''),'checkerName',coalesce((select concat(s.data->>'no','. ',s.data->>'name') from public.startoday_students s where s.class_id=cid and s.id=a.data->>'checkerStudentId' and s.data->>'deletedAt' is null),''))) from public.startoday_assignments a where a.class_id=cid and coalesce(a.data->>'isQuest','false')<>'true' and a.data->>'deletedAt' is null and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)),'[]'::jsonb),
 'states',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',st.data->>'assignmentId','date',st.data->>'date','status',st.data->>'status','stamps',st.data->'stamps')) from public."startoday_assignmentStates" st where st.class_id=cid and st.data->>'studentId'=sid),'[]'::jsonb),
 'excludedDates',coalesce((select jsonb_agg(atd.data->>'date') from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'excluded'='true'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('date',e.date,'title',e.title,'description',e.description,'period',e.period,'timeOfDay',e.time_of_day,'isDday',e.is_dday,'isImportant',e.is_important)) from (
   select ev.data->>'date' as date,ev.data->>'title' as title,coalesce(ev.data->>'description','') as description,ev.data->'period' as period,ev.data->>'timeOfDay' as time_of_day, coalesce(ev.data->>'isDday','false')='true' as is_dday,coalesce(ev.data->>'isImportant','true')<>'false' as is_important from public.startoday_events ev where ev.class_id=cid
   union all select config->'academicCalendar'->>dates.key,dates.title,'학사일정 · 설정에서 관리','null'::jsonb,null::text,false,true from (values ('term1Start','개학식'),('summerEnd','여름방학식'),('term2Start','개학식'),('winterEnd','겨울방학식'),('winterReturn','개학식'),('springEnd','종업식')) dates(key,title) where config->'academicCalendar'->>dates.key ~ '^\d{4}-\d{2}-\d{2}$' and (dates.key not in ('winterReturn','springEnd') or config->'academicCalendar'->>'springBreak'='true')
   union all select distinct holiday.value,'자율휴업일','학사일정 · 재량휴업일','null'::jsonb,null::text,false,true from jsonb_array_elements_text(case when jsonb_typeof(config->'academicCalendar'->'holidays')='array' then config->'academicCalendar'->'holidays' else '[]'::jsonb end) holiday(value)
 ) e),'[]'::jsonb)) into calendar;
 result:=jsonb_build_object('economy',public.startoday_economy_payload(cid,sid),'student',jsonb_build_object('id',sid,'no',student->'no','name',student->>'name','equippedTitle',student->>'equippedTitle','nickname',student->>'nickname','rewardTitles',coalesce((select jsonb_agg(jsonb_build_object('id',t->>'id','name',t->>'name')) from jsonb_array_elements(coalesce(student->'rewardTitles','[]'::jsonb)) t),'[]'::jsonb)),'titleCounts',public.startoday_kingdom_counts(cid,sid),'titleConfig',public.startoday_title_config(cid),'className',coalesce(config->>'className','우리반'),'date',day,'lunchAfterPeriod',case when config->>'lunchAfterPeriod' in ('3','4','5') then (config->>'lunchAfterPeriod')::integer else 4 end,'score',totals,'praise',letters,'tasks',tasks,'routines',routines,'timetable',timetable,'calendar',calendar,'checkingAssignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title')) from public.startoday_assignments a where a.class_id=cid and a.data->>'checkerStudentId'=sid and coalesce(a.data->>'isQuest','false')<>'true' and public.startoday_assignment_occurs(a.data,day)),'[]'::jsonb));
 return result;
end $$;
revoke all on function public.startoday_student_payload(uuid,text) from public,anon,authenticated;
-- Remove the code-based public API so it cannot bypass mandatory password changes.
drop function if exists public.startoday_student_login(text,text);
create or replace function public.startoday_student_authenticate(p_school text,p_grade text,p_class text,p_no integer,p_password text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare matches jsonb; cid uuid; sid text; student jsonb; config jsonb; initial text; expected text;
 v_failures integer; started timestamptz; must_change boolean;
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
 initial:=coalesce(nullif(config->>'defaultStudentPassword',''),'바람123');
 expected:=case when student->>'passwordResetRequired'='true' or student->>'passwordChanged'='false'
 or (coalesce(student->>'passwordChanged','false')<>'true' and (student->>'password' is null or student->>'password'='12345'))
 then initial else coalesce(student->>'password',initial) end;
 insert into public.startoday_student_login_attempts(class_id,student_id) values(cid,sid) on conflict do nothing;
 select a.failures,a.window_start into v_failures,started from public.startoday_student_login_attempts a where a.class_id=cid and a.student_id=sid for update;
 if started<now()-interval '15 minutes' then v_failures:=0;started:=now();end if;
 if v_failures>=10 then return null;end if;
 if p_password is distinct from expected then
 update public.startoday_student_login_attempts a set failures=v_failures+1,window_start=started where a.class_id=cid and a.student_id=sid;
 return null;
 end if;
 update public.startoday_student_login_attempts a set failures=0,window_start=now() where a.class_id=cid and a.student_id=sid;
 must_change:=coalesce(student->>'passwordChanged','false')<>'true' or student->>'passwordResetRequired'='true' or expected=initial or char_length(expected)<5 or expected !~ '[가-힣]' or expected ~ '[^가-힣0-9]';
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
 initial:=coalesce(nullif(verified->'config'->>'defaultStudentPassword',''),'바람123');
 if p_new_password is null or char_length(p_new_password)<5 or char_length(p_new_password)>200 or p_new_password !~ '[가-힣]' or p_new_password ~ '[^가-힣0-9]' or p_new_password=initial or p_new_password=p_old_password then raise exception 'INVALID_STUDENT_PASSWORD';end if;
 cid:=(verified->>'cid')::uuid;sid:=verified->>'sid';
 update public.startoday_students set data=data||jsonb_build_object('password',p_new_password,'passwordChanged',true,'passwordResetRequired',false,'passwordChangedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now() where class_id=cid and id=sid;
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
   if coalesce((select data->>'allowRefund' from public.startoday_settings where class_id=cid and id='main'),'true')='false' then raise exception 'REFUNDS_DISABLED';end if;
   if holding.data->>'type'<>'구매' then raise exception 'INVALID_HOLDING';end if;
   update public.startoday_shop_items set data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::integer+1)),updated_at=now() where class_id=cid and id=(holding.data->>'itemId')::uuid and data->'stock'<>'null'::jsonb;
   update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"환불됨"'),updated_at=now() where id=holding.id;
   v:=jsonb_build_object('id',txid,'studentId',sid,'type','환불','itemId',holding.data->>'itemId','itemName',holding.data->>'itemName','itemCategory',coalesce(holding.data->>'itemCategory',(select i.data->>'category' from public.startoday_shop_items i where i.class_id=cid and i.id::text=holding.data->>'itemId'),'기타'),'amount',-(holding.data->>'amount')::integer,'originalTxId',holding.id,'status',null,'memo','','createdAt',stamp);
  else
   update public.startoday_economy_tx set data=jsonb_set(data,'{status}','"사용완료"'),updated_at=now() where id=holding.id;
   txid:=holding.id;
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
