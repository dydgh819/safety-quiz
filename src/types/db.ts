/**
 * DB 테이블 타입. supabase/migrations/001_init.sql 과 일치해야 한다.
 * 마이그레이션을 바꾸면 이 파일도 함께 고친다.
 *
 * supabase-js 의 제네릭(Database)이 요구하는 형태라서 interface 대신 type 으로 쓴다.
 */

// ---------------------------------------------------------------------------
// 열거형 값(DB check 제약과 같은 값)
// ---------------------------------------------------------------------------

/** 문제 유형. 1차는 선택형만. */
export type QuestionType = "choice";
/** 단문형(120자, 이미지 가능) / 장문형(300자, 이미지 불가) */
export type TextType = "short" | "long";
/** 진행 모드. 1차는 선택형 개인전만. */
export type SessionMode = "choice_individual";
/** 현장 Play / 원격 Play */
export type PlayType = "onsite" | "remote";
/** 회차 상태(PRD 5.2) */
export type SessionState =
  | "lobby"
  | "countdown"
  | "question"
  | "reveal"
  | "leaderboard"
  | "final"
  | "ended";

// ---------------------------------------------------------------------------
// jsonb 컬럼 구조
// ---------------------------------------------------------------------------

/** questions.choices 의 원소. id 는 문항 안에서 1~4. */
export type Choice = {
  id: number;
  text: string;
  image_url: string | null;
  is_correct: boolean;
};

/** sessions.options — 진행 옵션 7종(PRD 3.5 + 지각 입장, D-05) */
export type SessionOptions = {
  /** 랭킹 화면 비노출 (기본 Off) */
  hide_leaderboard: boolean;
  /** 답변 노출: 현장 Play 폰 블록에 보기 텍스트 (기본 Off, 원격은 항상 On) */
  show_choice_text: boolean;
  /** 효과음·배경음악 (기본 On) */
  sound: boolean;
  /** 재접속 허용: 같은 기기 자동 복귀 (항상 On 고정, D-03) */
  allow_rejoin: boolean;
  /** 제출하기 버튼 사용 (기본 Off) */
  use_submit_button: boolean;
  /** 다음 화면 자동 이동 (기본 Off) */
  auto_advance: boolean;
  /** 지각 입장 허용 (기본 On, JN-09) */
  allow_late_join: boolean;
};

/** sessions.questions_snapshot 의 원소 — 회차 시작 시점의 문제 사본 */
export type QuestionSnapshot = {
  id: string;
  order_index: number;
  type: QuestionType;
  text_type: TextType;
  question_text: string;
  image_url: string | null;
  choices: Choice[];
  time_limit_sec: number;
  use_score: boolean;
  double_score: boolean;
};

// ---------------------------------------------------------------------------
// 테이블 Row
// ---------------------------------------------------------------------------

export type ShowRow = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type QuestionRow = {
  id: string;
  show_id: string;
  order_index: number;
  type: QuestionType;
  text_type: TextType;
  question_text: string;
  image_url: string | null;
  choices: Choice[];
  memo: string;
  time_limit_sec: number;
  use_score: boolean;
  double_score: boolean;
  created_at: string;
  updated_at: string;
};

export type RosterRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RosterMemberRow = {
  roster_id: string;
  emp_no: string;
  name: string;
  dept: string;
  plant: string;
};

export type SessionRow = {
  id: string;
  show_id: string | null;
  pin: string;
  mode: SessionMode;
  play_type: PlayType;
  options: SessionOptions;
  roster_id: string | null;
  edu_title: string;
  edu_date: string;
  questions_snapshot: QuestionSnapshot[];
  state: SessionState;
  current_q_index: number | null;
  q_started_at: string | null;
  q_ends_at: string | null;
  host_key_hash: string;
  entry_closed: boolean;
  last_activity_at: string;
  created_at: string;
  ended_at: string | null;
};

export type ParticipantRow = {
  id: string;
  session_id: string;
  nickname: string;
  emp_no: string | null;
  dept: string | null;
  device_id: string;
  rejoin_token_hash: string;
  joined_at: string;
  last_seen_at: string;
  kicked: boolean;
};

export type AnswerRow = {
  id: string;
  session_id: string;
  question_id: string;
  participant_id: string;
  choice_ids: number[];
  is_correct: boolean;
  elapsed_ms: number;
  score: number;
  submitted_at: string;
};

// ---------------------------------------------------------------------------
// supabase-js 용 Database 타입
// ---------------------------------------------------------------------------

/** 기본값이 있는 컬럼은 Insert 에서 생략 가능 */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>;

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: InsertOf<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rels;
};

/** 외래키 관계(임베드 조회 타입용). 001_init.sql 의 references 와 같게 유지. */
type FK<Name extends string, Column extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      shows: Table<ShowRow, "title">;
      questions: Table<
        QuestionRow,
        "show_id" | "order_index",
        [FK<"questions_show_id_fkey", "show_id", "shows">]
      >;
      rosters: Table<RosterRow, "name">;
      roster_members: Table<
        RosterMemberRow,
        "roster_id" | "emp_no" | "name",
        [FK<"roster_members_roster_id_fkey", "roster_id", "rosters">]
      >;
      sessions: Table<
        SessionRow,
        "pin" | "edu_title" | "questions_snapshot" | "host_key_hash",
        [
          FK<"sessions_show_id_fkey", "show_id", "shows">,
          FK<"sessions_roster_id_fkey", "roster_id", "rosters">,
        ]
      >;
      participants: Table<
        ParticipantRow,
        "session_id" | "nickname" | "device_id" | "rejoin_token_hash",
        [FK<"participants_session_id_fkey", "session_id", "sessions">]
      >;
      answers: Table<
        AnswerRow,
        | "session_id"
        | "question_id"
        | "participant_id"
        | "choice_ids"
        | "is_correct"
        | "elapsed_ms",
        [
          FK<"answers_session_id_fkey", "session_id", "sessions">,
          FK<"answers_participant_id_fkey", "participant_id", "participants">,
        ]
      >;
    };
    Views: Record<never, never>;
    Functions: {
      /** 005_submit_answer.sql: 문제 진행 중일 때만 답안 저장 */
      submit_answer: {
        Args: {
          p_session_id: string;
          p_participant_id: string;
          p_question_index: number;
          p_question_id: string;
          p_choice_ids: number[];
          p_is_correct: boolean;
          p_elapsed_ms: number;
          p_score: number;
        };
        Returns: "accepted" | "duplicate" | "closed" | "not_found";
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
