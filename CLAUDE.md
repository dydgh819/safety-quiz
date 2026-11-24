# CLAUDE.md — safety-quiz

사내 정기안전보건 집체교육(20~100명)에서 **휴대폰 입장으로 출석을 기록**하고 **실시간 객관식 퀴즈로 이해도를 평가**하는 웹앱.

- 요구사항 원문: `docs/PRD.md` (요구사항 ID: SH, QZ, RS, JN, PL, MB, RP)
- 단계별 계획·진행 상황: `docs/PLAN.md`
- **PRD와 다른 결정은 `docs/PLAN.md`의 "결정 사항"(D-01 …)에 있으며, PRD보다 우선한다.**
- 작업 전 해당 단계의 PRD 요구사항과 PLAN.md 체크리스트를 먼저 읽는다.

## 1차 범위

- **현재 목표는 테스트 버전**: Show 작성 → 닉네임 입장 → 실시간 진행 → 리포트·엑셀 흐름이 끝까지 동작하는 것. 본인 확인 세부 기능(대상자 명단·대조, 요청 제한 등)은 추후 구현(PLAN.md D-09).
- **교육자 로그인·인증 없음**: 접속한 누구나 교육자 화면을 쓸 수 있고, 모든 Show·회차·리포트를 함께 본다. 소유자 개념(`owner_id`, `hosts` 테이블)도 두지 않는다(D-26). Supabase Auth를 쓰는 코드를 만들지 않는다.
- **피교육자는 사번 대신 닉네임을 자유 입력**한다(형식 검증 없음, 회차 안에서 중복 불가, 기기 교체 없음). 사번 컬럼은 추후 인증용으로 nullable로만 남긴다(D-03, D-07).
- **문제 유형: 선택형만** (`questions.type = 'choice'`)
- **진행 모드: 개인전만** (`sessions.mode = 'choice_individual'`), 진행 방식은 현장 Play / 원격 Play
- 범위 밖(만들지 않음): OX·단답·순서·초성·토론·설문·영상·Word Cloud·설명 유형, 팀전, 골든벨, Mission, 카테고리·태그, 공개 공유, 구글 클래스룸, 유튜브·오디오 첨부, AI 문제 생성, 벤치마킹 서비스의 캐릭터·일러스트·음원
- 확장 대비: `type`, `mode`는 `text + check 제약`으로 두고, 유형별 분기는 한 곳(switch)에 모아 나중에 유형을 추가하기 쉽게 한다. 단, 범위 밖 기능을 미리 구현하지는 않는다.

## 기술 스택

| 구분 | 사용 |
| --- | --- |
| 프레임워크 | Next.js App Router + TypeScript (`strict: true`), `src/` 디렉터리 |
| UI | Tailwind CSS (필요 시 shadcn/ui) |
| 백엔드 | Supabase — Postgres, Realtime Broadcast/Presence, Storage (Auth는 사용 안 함) |
| 엑셀 | SheetJS (`xlsx`) |
| QR | `qrcode.react` |
| 입력 검증 | `zod` (모든 API 입력) |
| 테스트 | Vitest(순수 로직 단위 테스트), Playwright(E2E) |
| 배포 | GitHub → Vercel 자동 배포 |

- 패키지는 해당 단계에 필요한 것만 추가하고, 새 의존성을 넣으면 단계 보고에 이유를 적는다.
- 설치된 Next.js·Tailwind 버전의 공식 규칙을 따른다. 버전 차이로 PRD 지시와 달라지는 부분은 보고에 적는다.
- `@supabase/ssr`는 쓰지 않는다(로그인·쿠키 세션이 없음, D-26). Playwright는 8단계에서 추가한다.

### Next.js 16.4 주의 (학습 데이터와 다름)

- 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 먼저 확인한다(`AGENTS.md` 참고).
- **`cacheComponents: true`(기본)**: 데이터는 기본적으로 매 요청 조회된다. DB를 읽는 서버 컴포넌트는 `await connection()` 후 조회하고, 반드시 `<Suspense fallback>` 안에 둔다. 그렇지 않으면 빌드가 실패하거나 빌드 시점에 DB를 호출한다. 캐시가 필요할 때만 `'use cache'` + `cacheLife`.
- `GET` Route Handler도 같은 프리렌더 규칙을 따른다. 요청마다 달라지는 API는 `request`/`cookies`/`headers`를 쓰거나 `connection()`을 호출한다.
- `runtime` 라우트 설정(`edge` 등)을 쓰지 않는다(Node.js 런타임만).
- 라우트 보호 등 요청 전처리 파일은 `middleware.ts`가 아니라 `proxy.ts`다(지금은 로그인이 없어 사용하지 않음).
- Tailwind v4: `tailwind.config` 없이 `src/app/globals.css`의 `@theme`에 토큰을 둔다(`brand-*`, `choice-1~4`).

## 절대 규칙 (어기지 말 것)

1. **회차 상태·점수는 서버가 기준이며, 서버 시각으로 계산한다.**
   - 상태 전환, `q_started_at`/`q_ends_at`, `elapsed_ms`, 점수, 순위는 모두 서버(API 또는 DB `now()`)에서 계산한다.
   - 클라이언트 시각은 타이머 **표시용 보정**(서버 시각과의 차이)에만 쓴다. 클라이언트가 보낸 시각·점수·정답 여부는 절대 믿지 않는다.
   - 상태 전환은 진행 API(회차 생성 때 발급한 진행 키 필요, D-27)만 할 수 있고, 허용되지 않은 전환은 서버가 거부한다. `advance` 요청에는 기대 상태를 담아 같은 요청이 두 번 와도 한 번만 반영한다.
2. **피교육자는 DB에 직접 쓰지 않는다. 입장·제출·조회는 Next.js API로만.**
   - 피교육자 API는 서버에서 service role 클라이언트로 처리하고, 재접속 토큰으로 참가자를 확인한다.
   - 로그인이 없으므로 **교육자 화면도 같다**: 모든 DB 읽기·쓰기는 서버 컴포넌트·Server Action·API 라우트에서 admin 클라이언트로 한다. 브라우저에서 Supabase 테이블을 직접 `select/insert/update` 하는 코드를 만들지 않는다(브라우저의 Supabase 클라이언트는 Realtime 구독에만 쓴다).
3. **정답은 reveal 전까지 폰에 보내지 않는다.**
   - `is_correct`, 정답 보기 id, 정답 여부를 `question_open` 방송, 상태 API, 답안 제출 응답에 넣지 않는다. 제출 응답은 '접수됨'만.
   - 현장 Play + 답변 노출 Off면 폰용 페이로드에서 보기 텍스트도 뺀다.
   - 폰으로 가는 데이터는 반드시 전용 직렬화 함수(예: `toPhoneQuestion()`)를 거치게 하고, 정답이 빠지는지 테스트한다.
4. **service role 키는 서버 코드에서만.**
   - `SUPABASE_SERVICE_ROLE_KEY`는 `src/lib/supabase/admin.ts`에서만 읽고, 그 파일은 `import 'server-only'`로 시작한다.
   - `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 클라이언트 컴포넌트(`'use client'`)에서 admin 클라이언트를 import 하지 않는다.
5. **모든 테이블에 RLS를 켠다.**
   - 새 테이블을 만드는 마이그레이션에는 반드시 `enable row level security`와 정책을 함께 넣는다.
   - `anon`·`authenticated`용 정책은 만들지 않는다(= 브라우저에서 anon 키로는 아무 테이블도 읽고 쓰지 못함). 접근은 서버의 service role로만 한다.

6. **실시간 방송은 신호로만 쓴다.** Supabase 공개 채널은 누구나 메시지를 보낼 수 있으므로, 방송을 받으면 상태·정답·순위는 API로 다시 받아 화면을 맞춘다(D-19).

그 밖의 보안 규칙(PRD 6.1): 재접속 토큰은 해시로만 저장, 개인정보는 닉네임·입장 시각으로 최소 수집. 요청 제한은 추후 구현이며, 구현할 때는 클라이언트 검사만으로 끝내지 말고 서버 쪽에서 막는다.

## 폴더 구조

```
src/
  app/
    (host)/                    교육자 PC 화면(공개, 공통 내비)
      shows/                   A2 My Show
      shows/[id]/edit/         A4 Show 편집
      shows/[id]/play/         A5 Play 설정
      rosters/                 A6 대상자 명단(추후)
      reports/                 A7 리포트 목록
      reports/[sessionId]/     A7 리포트 상세
    host/[sessionId]/          P1~P7 발표 화면(진행 키 필요, 내비 없음)
    join/                      M1 PIN 입력(공개)
    play/[pin]/                M2~M8 피교육자 화면(공개, M2는 닉네임 입력)
    api/                       Route Handlers (route.ts)
  components/
    ui/                        버튼·모달 등 범용 컴포넌트
    stage/                     발표 화면 컴포넌트(편집 미리보기와 발표 화면이 공유)
    editor/                    문제 편집기
    mobile/                    피교육자 화면 컴포넌트
  lib/
    env.ts                     공개 환경변수 읽기
    supabase/                  client.ts(브라우저 anon, Realtime 구독 전용) · admin.ts(service role, server-only)
    db/                        서버 전용 DB 조회·저장 함수(server-only, admin 클라이언트 사용)
    quiz/                      문항 검증(validate.ts) 등 문제 관련 순수 로직
    game/                      state-machine.ts · scoring.ts 등 진행 엔진 순수 로직
    realtime/                  채널 이름, 이벤트 타입, 서버 방송 함수
    excel/                     템플릿 생성·업로드 파싱
    report/                    리포트 집계
    validation/                API 입력 zod 스키마
  messages/ko.ts               모든 화면 문구
  types/db.ts                  DB 테이블 타입
supabase/migrations/           001_init.sql, 002_rls.sql …
tests/e2e/                     Playwright 테스트
scripts/                       부하 테스트 등 스크립트
docs/                          PRD.md, PLAN.md, KNOWN_ISSUES.md
```

- 비즈니스 로직(상태 전환, 점수, 순위, 검증, 엑셀 파싱, 리포트 집계)은 `src/lib/`에 **React·Supabase에 의존하지 않는 순수 함수**로 두고 단위 테스트를 붙인다. API 라우트와 컴포넌트는 이 함수를 호출만 한다.
- 단위 테스트는 대상 파일 옆에 `*.test.ts`, E2E는 `tests/e2e/*.spec.ts`.
- 페이지는 기본적으로 서버 컴포넌트, 상호작용이 필요한 부분만 `'use client'`로 분리한다.

## 네이밍 규칙

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 파일·폴더 | kebab-case | `state-machine.ts`, `answer-blocks.tsx` |
| React 컴포넌트 | PascalCase | `QuestionStage`, `AnswerBlocks` |
| 함수·변수 | camelCase, 동사로 시작 | `calculateScore`, `toPhoneQuestion` |
| 타입·인터페이스 | PascalCase | `SessionState`, `ChoiceQuestion` |
| zod 스키마 | camelCase + `Schema` | `joinRequestSchema` |
| 상수 | UPPER_SNAKE_CASE | `TIME_LIMIT_OPTIONS`, `MAX_CHOICES` |
| DB 테이블·컬럼 | snake_case, 테이블은 복수형 | `roster_members.emp_no` |
| 실시간 이벤트 | snake_case (PRD 5.3 이름 그대로) | `state_changed`, `question_open` |
| 실시간 채널 | `session:{sessionId}` | |
| API 경로 | 리소스 중심, kebab-case | `/api/sessions/[id]/advance`, `/api/sessions/by-pin/[pin]` |

- 용어는 PRD를 따른다: Show(퀴즈 세트), 회차(session), 참가자(participant), 교육자(host), 닉네임(`nickname`), 사번(`emp_no`, 추후), 명단(roster, 추후).
- DB의 snake_case는 `src/types/db.ts`에서 그대로 쓰고, 화면용으로 바꿀 때만 camelCase 타입을 따로 둔다.

## 화면 문구

- **모든 사용자 노출 문구는 `src/messages/ko.ts`에 모은다.** 컴포넌트·API 에러 메시지에 한국어 문자열을 직접 쓰지 않는다.
- 화면 단위로 묶는다(예: `ko.join.empNoLabel`, `ko.errors.pinNotFound`). 변수가 들어가는 문구는 함수로 둔다(예: `ko.stage.questionOf(n, m)`).
- 한국어 전용. i18n 라이브러리는 쓰지 않는다.

## UI 기준

- 발표 화면: 1920×1080 프로젝터, 강당 뒷자리에서 읽히는 큰 글자. 모바일: 360px 폭부터.
- 보기는 **색 + 도형(▲◆●■) + 번호** 3중 구분, 터치 버튼은 최소 48px.
- 색상은 Tailwind 토큰(`brand`, 보기 4색)으로만 쓴다. 지금은 임시 주황 계열이며 회사 CI로 교체한다.
- 애니메이션은 CSS transition 위주로 가볍게, `prefers-reduced-motion` 존중.

## DB 변경 (마이그레이션)

- 모든 DB 변경은 `supabase/migrations/번호_설명.sql` 파일로 만든다. 번호는 3자리 순번: `001_init.sql`, `002_rls.sql`, `003_storage.sql` …
- **SQL은 사용자가 Supabase SQL Editor에서 직접 실행한다.** Claude는 DB에 직접 접속하거나 마이그레이션을 실행하지 않는다.
- 한 번 안내한(실행됐을 수 있는) 마이그레이션 파일은 고치지 않는다. 변경이 필요하면 새 번호 파일을 만든다.
- 가능한 범위에서 다시 실행해도 안전하게 쓴다(`if not exists`, `create or replace`, `drop policy if exists` 등).
- 마이그레이션을 추가하면 `src/types/db.ts`도 함께 갱신하고, 단계 보고에 **실행할 파일과 순서**를 적는다.

## 환경변수

`.env.example`에 이름만 둔다. 실제 값은 커밋하지 않는다.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 브라우저 공개 가능
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용(절대 규칙 4)

## 명령어

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드(타입 검사 포함)
npm test           # Vitest 단위 테스트(src/**/*.test.ts)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test:e2e   # Playwright E2E (8단계에서 추가)
```

## 단계 완료 절차

각 단계(docs/PLAN.md의 1~8단계)가 끝날 때마다 아래를 모두 한다.

1. `npm run build` 통과, `npm test` 통과(E2E가 있는 단계는 `npm run test:e2e`도). 실패하면 고친 뒤 보고하고, 못 고친 것은 숨기지 말고 그대로 알린다.
2. `docs/PLAN.md`에서 완료한 항목을 `[x]`로 체크하고, 미룬 항목은 이유를 적는다.
3. 사용자에게 **한국어로** 보고한다:
   - **변경 요약**: 만든·바꾼 파일과 기능, PRD와 다르게 구현한 부분과 이유
   - **제가 직접 할 일**: 실행할 SQL 파일과 순서, 추가할 환경변수, Supabase·Vercel 설정, 확인해 볼 화면·시나리오(폰 몇 대로 무엇을 해 볼지)
   - 다음 단계 전에 결정이 필요한 질문이 있으면 함께

## 작업 원칙

- 한 번에 한 단계만 구현한다. 다음 단계 기능을 미리 만들지 않는다(단, 재사용을 위한 구조는 미리 고려).
- PRD가 모호하거나 충돌하면 임의로 정하지 말고 질문하거나, 진행이 필요하면 가정을 명시하고 보고에 적는다.
- 커밋 메시지·주석은 한국어 또는 영어 모두 가능하되, 사용자에게 하는 보고는 한국어로.
