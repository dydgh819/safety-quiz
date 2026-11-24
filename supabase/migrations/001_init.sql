-- 001_init.sql
-- 안전교육 실시간 퀴즈: 기본 테이블 7개, 제약, 인덱스, updated_at 트리거
-- Supabase SQL Editor에서 실행. 다시 실행해도 안전하도록 if not exists / or replace 사용.
--
-- 테스트 버전 결정 사항(docs/PLAN.md):
--   D-26 교육자 로그인 없음 → hosts 테이블, owner_id/host_id 없음
--   D-07 피교육자는 닉네임으로 입장 → participants.nickname, emp_no/dept는 nullable(추후)
--   D-16 Show를 지워도 회차·리포트 유지 → sessions.show_id on delete set null
--   D-27 회차별 진행 키 → sessions.host_key_hash
--   D-10 입장 마감 토글 → sessions.entry_closed
--   D-17 방치 회차 자동 종료 → sessions.last_activity_at

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- shows: 퀴즈 세트
-- ---------------------------------------------------------------------------
create table if not exists public.shows (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 50),
  description   text not null default '',
  thumbnail_url text,
  is_complete   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz            -- 값이 있으면 휴지통
);

create index if not exists shows_updated_at_idx on public.shows (updated_at desc) where deleted_at is null;
create index if not exists shows_deleted_at_idx on public.shows (deleted_at) where deleted_at is not null;

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions: 문제 (1차는 선택형만)
--   choices = [{ "id": 1, "text": "...", "image_url": null, "is_correct": true }, ...] 2~4개
--   choice id는 문항 안에서 1~4 정수(answers.choice_ids와 같은 값)
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references public.shows (id) on delete cascade,
  order_index    integer not null check (order_index >= 0),
  type           text not null default 'choice' check (type in ('choice')),
  text_type      text not null default 'short' check (text_type in ('short', 'long')),
  question_text  text not null default '' check (char_length(question_text) <= 300),
  image_url      text,
  choices        jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) <= 4),
  memo           text not null default '',
  time_limit_sec integer not null default 20 check (time_limit_sec in (5, 10, 20, 30, 60, 90, 120)),
  use_score      boolean not null default true,
  double_score   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 단문형 120자, 장문형 300자 / 장문형은 이미지 불가
  constraint questions_text_length_by_type check (text_type = 'long' or char_length(question_text) <= 120),
  constraint questions_long_no_image check (text_type = 'short' or image_url is null)
);

-- 순서 변경을 여러 요청으로 나눠 하므로 order_index는 유일 제약 없이 인덱스만 둔다.
create index if not exists questions_show_order_idx on public.questions (show_id, order_index);

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- 문제가 바뀌면 Show의 수정일(updated_at)도 갱신 (SH-02 목록의 수정일)
create or replace function public.touch_show_from_question()
returns trigger
language plpgsql
as $$
begin
  update public.shows
     set updated_at = now()
   where id = coalesce(new.show_id, old.show_id);
  return null;
end;
$$;

drop trigger if exists questions_touch_show on public.questions;
create trigger questions_touch_show
  after insert or update or delete on public.questions
  for each row execute function public.touch_show_from_question();

-- ---------------------------------------------------------------------------
-- rosters / roster_members: 대상자 명단 (화면은 추후 구현, 테이블만 준비)
-- ---------------------------------------------------------------------------
create table if not exists public.rosters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists rosters_set_updated_at on public.rosters;
create trigger rosters_set_updated_at
  before update on public.rosters
  for each row execute function public.set_updated_at();

create table if not exists public.roster_members (
  roster_id uuid not null references public.rosters (id) on delete cascade,
  emp_no    text not null check (char_length(emp_no) >= 1),
  name      text not null,
  dept      text not null default '',
  plant     text not null default '',
  primary key (roster_id, emp_no)
);

-- ---------------------------------------------------------------------------
-- sessions: 회차(Play 한 번)
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id                 uuid primary key default gen_random_uuid(),
  show_id            uuid references public.shows (id) on delete set null,
  pin                text not null check (pin ~ '^[0-9]{6}$'),
  mode               text not null default 'choice_individual' check (mode in ('choice_individual')),
  play_type          text not null default 'onsite' check (play_type in ('onsite', 'remote')),
  options            jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  roster_id          uuid references public.rosters (id) on delete set null,
  edu_title          text not null check (char_length(edu_title) between 1 and 100),
  edu_date           date not null default current_date,
  questions_snapshot jsonb not null check (jsonb_typeof(questions_snapshot) = 'array'),
  state              text not null default 'lobby'
                       check (state in ('lobby', 'countdown', 'question', 'reveal', 'leaderboard', 'final', 'ended')),
  current_q_index    integer check (current_q_index >= 0),  -- lobby에서는 null
  q_started_at       timestamptz,
  q_ends_at          timestamptz,
  host_key_hash      text not null,                        -- 진행 키 해시(D-27)
  entry_closed       boolean not null default false,       -- 입장 마감(D-10)
  last_activity_at   timestamptz not null default now(),   -- 방치 회차 정리용(D-17)
  created_at         timestamptz not null default now(),
  ended_at           timestamptz
);

-- PIN은 종료되지 않은 회차 사이에서만 유일(JN-01)
create unique index if not exists sessions_active_pin_uniq on public.sessions (pin) where state <> 'ended';
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists sessions_show_id_idx on public.sessions (show_id);

-- ---------------------------------------------------------------------------
-- participants: 회차 참가자(피교육자)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  nickname          text not null check (char_length(nickname) between 1 and 20 and nickname = btrim(nickname)),
  emp_no            text,                -- 추후 사번 인증용(D-07)
  dept              text,                -- 추후(D-07)
  device_id         text not null,
  rejoin_token_hash text not null,
  joined_at         timestamptz not null default now(),   -- = 출석 시각(JN-10)
  last_seen_at      timestamptz not null default now(),
  kicked            boolean not null default false
);

-- 한 회차에서 같은 닉네임 1명(대소문자 무시), 한 기기 1명(JN-06, JN-07)
create unique index if not exists participants_session_nickname_uniq on public.participants (session_id, lower(nickname));
create unique index if not exists participants_session_device_uniq on public.participants (session_id, device_id);
create index if not exists participants_session_joined_idx on public.participants (session_id, joined_at);

-- ---------------------------------------------------------------------------
-- answers: 답안
--   question_id는 questions_snapshot 안의 문제 id(원본 문제가 지워져도 남도록 FK 없음)
-- ---------------------------------------------------------------------------
create table if not exists public.answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions (id) on delete cascade,
  question_id    uuid not null,
  participant_id uuid not null references public.participants (id) on delete cascade,
  choice_ids     integer[] not null check (cardinality(choice_ids) between 1 and 4),
  is_correct     boolean not null,
  elapsed_ms     integer not null check (elapsed_ms >= 0),
  score          integer not null default 0 check (score >= 0),
  submitted_at   timestamptz not null default now(),
  unique (session_id, question_id, participant_id)
);

create index if not exists answers_session_question_idx on public.answers (session_id, question_id);
create index if not exists answers_participant_idx on public.answers (participant_id);
