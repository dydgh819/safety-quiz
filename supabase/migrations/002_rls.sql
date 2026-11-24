-- 002_rls.sql
-- 모든 테이블에 RLS를 켠다. 테스트 버전은 로그인이 없으므로(D-26)
-- anon·authenticated용 정책을 하나도 만들지 않는다 = 브라우저의 anon 키로는 어떤 테이블도 읽고 쓸 수 없다.
-- 모든 DB 접근은 Next.js 서버의 service role 클라이언트로만 한다(service role은 RLS를 우회).
-- 다시 실행해도 안전하다.

alter table public.shows          enable row level security;
alter table public.questions      enable row level security;
alter table public.rosters        enable row level security;
alter table public.roster_members enable row level security;
alter table public.sessions       enable row level security;
alter table public.participants   enable row level security;
alter table public.answers        enable row level security;

-- 이중 안전장치: anon·authenticated 역할의 테이블 권한 자체도 회수
revoke all on table
  public.shows,
  public.questions,
  public.rosters,
  public.roster_members,
  public.sessions,
  public.participants,
  public.answers
from anon, authenticated;

-- 트리거 함수도 외부 역할이 직접 호출하지 못하게
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.touch_show_from_question() from anon, authenticated, public;
