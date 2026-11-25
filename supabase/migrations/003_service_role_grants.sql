-- 003_service_role_grants.sql
-- 서버(Secret key = DB 역할 service_role)가 테이블을 읽고 쓸 수 있도록 권한을 명시적으로 준다.
--
-- 배경: 최근 Supabase 프로젝트는 SQL로 만든 테이블에 API 역할 권한을 자동으로 주지 않을 수 있다.
--       그러면 Secret key로 조회해도 "permission denied for table shows"(42501)가 난다.
-- anon·authenticated(Publishable key)에는 여전히 아무 권한도 주지 않는다(002_rls.sql 유지).
-- 다시 실행해도 안전하다.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.shows,
  public.questions,
  public.rosters,
  public.roster_members,
  public.sessions,
  public.participants,
  public.answers
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- 앞으로 이 스키마에 만드는 테이블·시퀀스도 service_role 에 자동 권한
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- 확인용: 아래 결과에 service_role 이 7개 테이블 모두 'DELETE, INSERT, SELECT, UPDATE' 로 나와야 하고,
--         anon·authenticated 는 나오지 않아야 한다.
select table_name,
       grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('service_role', 'anon', 'authenticated')
 group by table_name, grantee
 order by table_name, grantee;
