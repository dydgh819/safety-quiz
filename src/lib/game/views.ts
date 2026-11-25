import type { QuestionSnapshot, SessionOptions, SessionRow, SessionState } from "@/types/db";

import { toPhoneQuestion, type PhoneQuestion } from "./phone-view";
import { computeQuestionResult, type QuestionResult } from "./results";
import { computeLeaderboard, computeStandings, type LeaderboardRow, type RankAnswer, type RankParticipant } from "./scoring";
import { revealedUpTo, type GamePosition } from "./state-machine";

/**
 * 발표 화면·폰에 보낼 진행 데이터 만들기(순수 함수).
 * - 발표 화면(교육자)은 정답을 포함한 전체 정보.
 * - 폰은 공개된 문제까지만 점수·순위를 계산하고, 현재 문제 정답은 reveal 이후에만(절대 규칙 3).
 */

/** 접속 중으로 보는 시간: 폰은 10초마다 상태를 확인하므로 30초 안에 확인한 참가자(조기 마감 판단, D-11) */
export const ONLINE_WINDOW_MS = 30_000;
/** 랭킹 화면에 보여줄 인원 */
export const LEADERBOARD_SIZE = 10;

export type GameParticipant = { id: string; nickname: string; joined_at: string; last_seen_at: string };
export type GameAnswer = {
  participant_id: string;
  question_id: string;
  choice_ids: number[];
  is_correct: boolean;
  elapsed_ms: number;
  score: number;
};
export type GameSession = Pick<
  SessionRow,
  | "id"
  | "pin"
  | "edu_title"
  | "play_type"
  | "options"
  | "state"
  | "current_q_index"
  | "q_started_at"
  | "q_ends_at"
  | "entry_closed"
  | "questions_snapshot"
>;

/** 강퇴되지 않은 참가자와 그들의 답안 */
export type GameData = { session: GameSession; participants: GameParticipant[]; answers: GameAnswer[] };

function positionOf(session: GameSession): GamePosition {
  return { state: session.state, qIndex: session.current_q_index };
}

function currentQuestion(session: GameSession): QuestionSnapshot | null {
  const q = session.current_q_index;
  return q === null ? null : (session.questions_snapshot[q] ?? null);
}

function rankInputs(data: GameData) {
  const indexById = new Map(data.session.questions_snapshot.map((q, i) => [q.id, i]));
  const members = new Set(data.participants.map((p) => p.id));
  const participants: RankParticipant[] = data.participants.map((p) => ({ id: p.id, nickname: p.nickname, joinedAt: p.joined_at }));
  const answers: RankAnswer[] = data.answers
    .filter((a) => members.has(a.participant_id) && indexById.has(a.question_id))
    .map((a) => ({
      participantId: a.participant_id,
      questionIndex: indexById.get(a.question_id)!,
      isCorrect: a.is_correct,
      elapsedMs: a.elapsed_ms,
      score: a.score,
    }));
  const limits = data.session.questions_snapshot.map((q) => q.time_limit_sec);
  return { participants, answers, limits };
}

function answersFor(data: GameData, questionId: string): GameAnswer[] {
  const members = new Set(data.participants.map((p) => p.id));
  return data.answers.filter((a) => a.question_id === questionId && members.has(a.participant_id));
}

/** 문제 진행 중 응답 현황(PL-04 n/N, PL-05 조기 마감) */
export function questionProgress(data: GameData, now: Date): { answered: number; active: number } {
  const q = currentQuestion(data.session);
  if (!q) return { answered: 0, active: 0 };
  const answeredIds = new Set(answersFor(data, q.id).map((a) => a.participant_id));
  const onlineSince = now.getTime() - ONLINE_WINDOW_MS;
  const active = data.participants.filter((p) => answeredIds.has(p.id) || new Date(p.last_seen_at).getTime() >= onlineSince).length;
  return { answered: answeredIds.size, active };
}

// ---------------------------------------------------------------------------
// 발표 화면
// ---------------------------------------------------------------------------

export type HostView = {
  sessionId: string;
  pin: string;
  eduTitle: string;
  options: SessionOptions;
  state: SessionState;
  qIndex: number | null;
  total: number;
  qStartedAt: string | null;
  qEndsAt: string | null;
  serverTime: string;
  entryClosed: boolean;
  /** 강퇴 제외, 최근 입장 순 */
  participants: { id: string; nickname: string; joinedAt: string }[];
  /** 현재 문제(정답 포함 — 교육자 화면 전용) */
  question: QuestionSnapshot | null;
  progress: { answered: number; active: number } | null;
  result: QuestionResult | null;
  leaderboard: LeaderboardRow[] | null;
  summary: { participantCount: number; averageScore: number; averageCorrectRate: number } | null;
};

export function buildHostView(data: GameData, now: Date): HostView {
  const { session } = data;
  const total = session.questions_snapshot.length;
  const question = currentQuestion(session);
  const state = session.state;
  const { participants, answers, limits } = rankInputs(data);
  const upTo = revealedUpTo(positionOf(session), total);

  const showResult = (state === "reveal" || state === "leaderboard") && question;
  const showBoard = state === "leaderboard" || state === "final" || state === "ended";
  const board = showBoard ? computeLeaderboard(participants, answers, limits, upTo) : null;

  let summary: HostView["summary"] = null;
  if (state === "final" || state === "ended") {
    const standings = computeStandings(participants, answers, limits, total - 1);
    const n = standings.length;
    summary = {
      participantCount: n,
      averageScore: n ? Math.round(standings.reduce((s, x) => s + x.totalScore, 0) / n) : 0,
      averageCorrectRate: n && total ? standings.reduce((s, x) => s + x.correctCount, 0) / (n * total) : 0,
    };
  }

  return {
    sessionId: session.id,
    pin: session.pin,
    eduTitle: session.edu_title,
    options: session.options,
    state,
    qIndex: session.current_q_index,
    total,
    qStartedAt: session.q_started_at,
    qEndsAt: session.q_ends_at,
    serverTime: now.toISOString(),
    entryClosed: session.entry_closed,
    participants: [...data.participants]
      .sort((a, b) => b.joined_at.localeCompare(a.joined_at))
      .map((p) => ({ id: p.id, nickname: p.nickname, joinedAt: p.joined_at })),
    question,
    progress: state === "question" ? questionProgress(data, now) : null,
    result: showResult ? computeQuestionResult(question, answersFor(data, question.id).map((a) => ({ choiceIds: a.choice_ids, isCorrect: a.is_correct }))) : null,
    leaderboard: board ? board.slice(0, LEADERBOARD_SIZE) : null,
    summary,
  };
}

// ---------------------------------------------------------------------------
// 폰
// ---------------------------------------------------------------------------

export type PhoneGame = {
  state: SessionState;
  qIndex: number | null;
  total: number;
  qStartedAt: string | null;
  qEndsAt: string | null;
  /** 문제 진행·결과 화면용(정답 없음) */
  question: PhoneQuestion | null;
  /** 이 문제에 내가 낸 답 */
  myAnswer: { choiceIds: number[] } | null;
  /** reveal·leaderboard 에서만: 정답 보기, 내 정답 여부(null = 미응답), 이번 문제 점수 */
  result: { correctIds: number[]; isCorrect: boolean | null; gained: number } | null;
  /** 공개된 문제까지의 내 누적 */
  me: { totalScore: number; correctCount: number; rank: number; participantCount: number };
  /** 제출 버튼 사용 옵션(6단계에서 동작) */
  useSubmitButton: boolean;
};

export function buildPhoneGame(data: GameData, participantId: string): PhoneGame {
  const { session } = data;
  const total = session.questions_snapshot.length;
  const state = session.state;
  const question = currentQuestion(session);
  const { participants, answers, limits } = rankInputs(data);
  const upTo = revealedUpTo(positionOf(session), total);

  const standings = computeStandings(participants, answers, limits, upTo);
  const mine = standings.find((s) => s.participantId === participantId);
  const myAnswer = question
    ? (data.answers.find((a) => a.question_id === question.id && a.participant_id === participantId) ?? null)
    : null;

  const inQuestionFlow = state === "question" || state === "reveal" || state === "leaderboard";
  const revealed = (state === "reveal" || state === "leaderboard") && question;

  return {
    state,
    qIndex: session.current_q_index,
    total,
    qStartedAt: session.q_started_at,
    qEndsAt: session.q_ends_at,
    question:
      inQuestionFlow && question && session.current_q_index !== null
        ? toPhoneQuestion(question, session.current_q_index, total, {
            playType: session.play_type,
            showChoiceText: session.options?.show_choice_text ?? false,
          })
        : null,
    myAnswer: myAnswer && state !== "countdown" ? { choiceIds: myAnswer.choice_ids } : null,
    result: revealed
      ? {
          correctIds: computeQuestionResult(question, []).correctIds,
          isCorrect: myAnswer ? myAnswer.is_correct : null,
          gained: myAnswer?.score ?? 0,
        }
      : null,
    me: {
      totalScore: mine?.totalScore ?? 0,
      correctCount: mine?.correctCount ?? 0,
      rank: mine?.rank ?? standings.length + 1,
      participantCount: standings.length,
    },
    useSubmitButton: session.options?.use_submit_button ?? false,
  };
}
