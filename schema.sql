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
create or replace function public.startoday_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.startoday_classes; result jsonb:='{}'; t text; rows jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.startoday_classes(owner_id) values(auth.uid()) on conflict(owner_id) do nothing;
 select * into c from public.startoday_classes where owner_id=auth.uid();
 -- 공유 잠금으로 여러 테이블 읽기 도중 다른 기기가 수정하지 못하게 합니다.
 perform 1 from public.startoday_classes where id=c.id for share;
 foreach t in array array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'] loop
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
 if not(t=any(array['students','incidents','records','assignments','assignmentStates','events','routines','routineStates','subject_rules','timetables','quests','settings','attendance','areas'])) or coalesce(op->>'id','')='' then raise exception 'INVALID_TABLE_OR_ID'; end if;
 if coalesce((op->>'remove')::boolean,false) then
 execute format('delete from public.%I where class_id=$1 and id=$2','startoday_'||t) using c.id,op->>'id';
 else
 v:=op->'data';
 if jsonb_typeof(v)<>'object' or v->>'id' is distinct from op->>'id' then raise exception 'INVALID_DATA'; end if;
 if t='settings' and v ? 'defaultStudentPassword' then
 select data into old from public.startoday_settings where class_id=c.id and id=op->>'id';
 if v->>'defaultStudentPassword' is distinct from old->>'defaultStudentPassword' then
 if coalesce(char_length(v->>'defaultStudentPassword'),0)<5 or char_length(v->>'defaultStudentPassword')>200 or v->>'defaultStudentPassword' !~ '[가-힣]' or v->>'defaultStudentPassword' ~ '[^가-힣0-9]' then raise exception 'INVALID_INITIAL_STUDENT_PASSWORD';end if;
 end if;
 end if;
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
-- Existing tag rows are retained as inaccessible legacy data; no current API uses them.
do $$ begin if to_regclass('public.startoday_tags') is not null then execute 'revoke all on public.startoday_tags from public,anon,authenticated';end if;end $$;
-- Student reads are an explicit allow-list, independent of teacher snapshots.
-- No anonymous SELECT policy is added to any existing class table.
create table if not exists public.startoday_student_login_attempts (
 class_id uuid not null references public.startoday_classes(id) on delete cascade,
 student_id text not null, failures integer not null default 0,
 window_start timestamptz not null default now(), primary key(class_id,student_id)
);
alter table public.startoday_student_login_attempts enable row level security;
revoke all on public.startoday_student_login_attempts from public,anon,authenticated;
-- Payload helper is private: initial-password users never receive a snapshot.
create or replace function public.startoday_student_payload(cid uuid,sid text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student jsonb; config jsonb; day text:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
 result jsonb; totals jsonb; letters jsonb; tasks jsonb; routines jsonb; timetable jsonb; calendar jsonb;
begin
 select data into student from public.startoday_students where class_id=cid and id=sid;
 select data into config from public.startoday_settings where class_id=cid and id='main';
 -- Only numbers are aggregated from advice; its text is never returned.
 with scored as (
 select r.data,case r.data->>'kind' when '칭찬' then 1 when '지도' then -1 else 0 end as delta
 from public.startoday_records r where r.class_id=cid and r.data->'studentIds' ? sid and r.data->>'date'<=day
 and not exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=r.data->>'date' and atd.data->>'excluded'='true')
 ) select jsonb_build_object('total',coalesce((select sum(delta) from scored),0),'areas',coalesce((select jsonb_object_agg(ar.data->>'name',coalesce((select sum(delta) from scored r where coalesce(r.data->'areas',jsonb_build_array(r.data->>'area')) ? (ar.data->>'name')),0)) from public.startoday_areas ar where ar.class_id=cid),'{}'::jsonb)) into totals;
 select coalesce(jsonb_agg(x.data order by x.date desc,x.created desc),'[]'::jsonb) into letters from (
 select jsonb_build_object('kind','칭찬','date',r.data->>'date','period',case when r.data->>'period'='기타' then '' else coalesce(r.data->>'period','') end,'text',case when r.data->>'autoRef' is not null then concat(a.data->>'title',case when ast.data->>'status'='늦게완료' then ' 늦게 완료' else ' 완료' end) else r.data->>'text' end,'areas',coalesce(r.data->'areas','[]'::jsonb)) as data,r.data->>'date' as date,r.data->>'createdAt' as created
 from public.startoday_records r
 left join public."startoday_assignmentStates" ast on ast.class_id=cid and ast.id=r.data->>'autoRef' and ast.data->>'studentId'=sid
 left join public.startoday_assignments a on a.class_id=cid and a.id=ast.data->>'assignmentId'
 where (r.data->>'autoRef' is null or (a.id is not null and ast.data->>'status' in ('완료','늦게완료'))) and r.class_id=cid and r.data->>'kind'='칭찬' and r.data->'studentIds' ? sid and r.data->>'date'<=day
 order by r.data->>'date' desc,r.data->>'createdAt' desc limit 50) x;
 select coalesce(jsonb_agg(jsonb_build_object('title',a.data->>'title','date',day,'status',case when exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=day and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by a.data->>'title'),'[]'::jsonb) into tasks
 from public.startoday_assignments a left join public."startoday_assignmentStates" st on st.class_id=cid and st.id=a.id||':'||day||':'||sid
 where a.class_id=cid and a.data->>'deletedAt' is null and a.data->>'date'<=day and (a.data->>'endDate' is null or a.data->>'endDate'>=day)
 and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)
 and ((a.data->'repeat'->>'type'='none' and a.data->>'date'=day) or a.data->'repeat'->>'type'='daily' or (a.data->'repeat'->'weekdays') @> jsonb_build_array(extract(dow from day::date)::integer));
 select coalesce(jsonb_agg(jsonb_build_object('title',r.data->>'title','status',case when r.data->'exceptions'->day->>'exempt'='true' or exists(select 1 from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'date'=day and atd.data->>'excluded'='true') then '면제' else coalesce(st.data->>'status','진행중') end) order by coalesce((r.data->>'sortOrder')::numeric,0)),'[]'::jsonb) into routines
 from public.startoday_routines r left join public."startoday_routineStates" st on st.class_id=cid and st.id=r.id||':'||day||':'||sid
 where r.class_id=cid and r.data->>'deletedAt' is null and (r.data->'target'='"all"'::jsonb or r.data->'target'->'studentIds' ? sid);
 select coalesce(jsonb_agg(jsonb_build_object('period',t.data->'period','subject',t.data->>'subjectCode','publicMemo',coalesce(t.data->>'publicMemo',t.data->>'memo',''),'color',rules.data->>'color','accentColor',rules.data->>'accentColor','colorSource',rules.data->>'colorSource','defaultColorValue',rules.data->>'defaultColorValue','location',coalesce(nullif(t.data->>'locationOverride',''),rules.data->>'location','')) order by (t.data->>'period')::integer),'[]'::jsonb) into timetable
 from public.startoday_timetables t left join public.startoday_subject_rules rules on rules.class_id=cid and rules.data->>'code'=t.data->>'subjectCode'
 where t.class_id=cid and t.data->>'date'=day and (t.data->>'period')::integer between 1 and 6;
 select jsonb_build_object(
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.data->>'title','date',a.data->>'date','endDate',a.data->>'endDate','repeat',a.data->'repeat')) from public.startoday_assignments a where a.class_id=cid and a.data->>'deletedAt' is null and (a.data->'target'='"all"'::jsonb or a.data->'target'->'studentIds' ? sid)),'[]'::jsonb),
 'states',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',st.data->>'assignmentId','date',st.data->>'date','status',st.data->>'status')) from public."startoday_assignmentStates" st where st.class_id=cid and st.data->>'studentId'=sid),'[]'::jsonb),
 'excludedDates',coalesce((select jsonb_agg(atd.data->>'date') from public.startoday_attendance atd where atd.class_id=cid and atd.data->>'studentId'=sid and atd.data->>'excluded'='true'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('date',e.date,'title',e.title,'description',e.description,'period',e.period)) from (
   select ev.data->>'date' as date,ev.data->>'title' as title,coalesce(ev.data->>'description','') as description,ev.data->'period' as period from public.startoday_events ev where ev.class_id=cid
   union all select config->'academicCalendar'->>dates.key,dates.title,'학사일정 · 설정에서 관리','null'::jsonb from (values ('term1Start','개학식'),('summerEnd','여름방학식'),('term2Start','개학식'),('winterEnd','겨울방학식'),('winterReturn','개학식'),('springEnd','종업식')) dates(key,title) where config->'academicCalendar'->>dates.key ~ '^\d{4}-\d{2}-\d{2}$' and (dates.key not in ('winterReturn','springEnd') or config->'academicCalendar'->>'springBreak'='true')
   union all select distinct holiday.value,'자율휴업일','학사일정 · 재량휴업일','null'::jsonb from jsonb_array_elements_text(case when jsonb_typeof(config->'academicCalendar'->'holidays')='array' then config->'academicCalendar'->'holidays' else '[]'::jsonb end) holiday(value)
 ) e),'[]'::jsonb)) into calendar;
 result:=jsonb_build_object('student',jsonb_build_object('id',sid,'no',student->'no','name',student->>'name'),'className',coalesce(config->>'className','우리반'),'date',day,'score',totals,'praise',letters,'tasks',tasks,'routines',routines,'timetable',timetable,'calendar',calendar);
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
commit;
