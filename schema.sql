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
 foreach t in array array['students','tags','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'] loop
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
create or replace function public.startoday_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; result jsonb:='{}'; t text; rows jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.startoday_classes(owner_id) values(auth.uid()) on conflict(owner_id) do nothing;
 select * into c from public.startoday_classes where owner_id=auth.uid();
 -- 공유 잠금으로 여러 테이블 읽기 도중 다른 기기가 수정하지 못하게 합니다.
 perform 1 from public.startoday_classes where id=c.id for share;
 foreach t in array array['students','tags','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'] loop
 execute format('select coalesce(jsonb_agg(data),''[]''::jsonb) from public.%I where class_id=$1 and owner_id=$2','startoday_'||t) into rows using c.id,auth.uid();
 result:=result||jsonb_build_object(t,rows);
 end loop;
 select * into c from public.startoday_classes where id=c.id;
 return jsonb_build_object('class_id',c.id,'revision',c.revision,'data',result);
end $$;
create or replace function public.startoday_commit(p_class_id uuid,p_revision bigint,p_ops jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; op jsonb; t text; v jsonb; old jsonb; n bigint; stamp text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into c from public.startoday_classes where id=p_class_id and owner_id=auth.uid() for update;
 if c.id is null then raise exception 'FORBIDDEN'; end if;
 if c.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if jsonb_typeof(p_ops)<>'array' or jsonb_array_length(p_ops)>50000 then raise exception 'INVALID_BATCH'; end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 for op in select * from jsonb_array_elements(p_ops) loop
 t:=op->>'table';
 if not(t=any(array['students','tags','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'])) or coalesce(op->>'id','')='' then raise exception 'INVALID_TABLE_OR_ID'; end if;
 if coalesce((op->>'remove')::boolean,false) then
 execute format('delete from public.%I where class_id=$1 and id=$2','startoday_'||t) using c.id,op->>'id';
 else
 v:=op->'data';
 if jsonb_typeof(v)<>'object' or v->>'id' is distinct from op->>'id' then raise exception 'INVALID_DATA'; end if;
 if t='areas' and (jsonb_typeof(v->'name') is distinct from 'string' or coalesce(btrim(v->>'name'),'')='' or jsonb_typeof(v->'sortOrder') is distinct from 'number' or (v->>'sortOrder')::numeric<0 or (v->>'sortOrder')::numeric<>trunc((v->>'sortOrder')::numeric)) then raise exception 'INVALID_AREA'; end if;
 if t='records' then
 execute 'select data from public.startoday_records where class_id=$1 and id=$2' into old using c.id,op->>'id';
 -- 최초 시각은 덮어쓸 수 없고, 수정 시각은 서버 시각으로 남깁니다.
 if old is not null then v:=jsonb_set(v,'{createdAt}',old->'createdAt'); end if;
 if v->>'createdAt' is null then v:=jsonb_set(v,'{createdAt}',to_jsonb(stamp)); end if;
 v:=jsonb_set(v,'{updatedAt}',to_jsonb(stamp));
 if not(v->>'kind'=any(array['칭찬','지도','관찰','추가기록'])) or jsonb_typeof(v->'studentIds')<>'array' then raise exception 'INVALID_RECORD'; end if;
 end if;
 if t in ('assignmentStates','routineStates') then
 if (v->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v->>'studentId','')='' then raise exception 'INVALID_STATE'; end if;
 if t='assignmentStates' and not(v->>'status'=any(array['진행중','완료','늦게완료','안함','면제'])) then raise exception 'INVALID_STATUS'; end if;
 if t='routineStates' and not(v->>'status'=any(array['진행중','완료','면제'])) then raise exception 'INVALID_STATUS'; end if;
 end if;
 execute format('insert into public.%I(class_id,owner_id,id,data) values($1,$2,$3,$4) on conflict(class_id,id) do update set data=excluded.data,updated_at=now()','startoday_'||t) using c.id,auth.uid(),op->>'id',v;
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
commit;

