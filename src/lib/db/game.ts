import "server-only";

import { DbError } from "@/lib/db/errors";
import { isSamePosition, nextPosition, timingFor, type GamePosition } from "@/lib/game/state-machine";
import type { GameData } from "@/lib/game/views";
import { getAdminClient } from "@/lib/supabase/admin";
import type { SessionRow } from "@/types/db";

/**
 * 진행 엔진 DB 함수(서버 전용): 상태 전환, 진행 데이터 조회, 답안 저장.
 */

function fail(error: { code?: string; message: string }): never {
  throw new DbError({ code: error.code ?? "", message: error.message });
}

const SESSION_COLUMNS =
  "id, pin, edu_title, play_type, options, state, current_q_index, q_started_at, q_ends_at, entry_closed, questions_snapshot";

/** 회차 + 강퇴되지 않은 참가자 + 답안 전체 */
export async function loadGameData(sessionId: string): Promise<GameData | null> {
  const db = getAdminClient();
  const [session, participants, answers] = await Promise.all([
    db.from("sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle(),
    db
      .from("participants")
      .select("id, nickname, joined_at, last_seen_at")
      .eq("session_id", sessionId)
      .eq("kicked", false),
    db
      .from("answers")
      .select("participant_id, question_id, choice_ids, is_correct, elapsed_ms, score")
      .eq("session_id", sessionId),
  ]);
  if (session.error) fail(session.error);
  if (participants.error) fail(participants.error);
  if (answers.error) fail(answers.error);
  if (!session.data) return null;
  return { session: session.data, participants: participants.data ?? [], answers: answers.data ?? [] };
}

export type AdvanceResult = { applied: boolean; session: SessionRow | null };

/**
 * 다음 단계로(PL-02, PL-03). 기대 위치(expected)가 지금 위치와 같을 때만 바꾼다.
 * 같은 요청이 두 번 와도(더블클릭·자동 진행·발표 화면 2개) 한 번만 반영된다(절대 규칙 1).
 * 조건부 update 는 답안 저장 함수(submit_answer)의 잠금이 끝날 때까지 기다린다.
 */
export async function advanceSession(sessionId: string, expected: GamePosition): Promise<AdvanceResult> {
  const db = getAdminClient();
  const { data: session, error } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) fail(error);
  if (!session) return { applied: false, session: null };

  const current: GamePosition = { state: session.state, qIndex: session.current_q_index };
  if (!isSamePosition(current, expected)) return { applied: false, session };

  const total = session.questions_snapshot.length;
  const next = nextPosition(current, total, { hideLeaderboard: session.options?.hide_leaderboard ?? false });
  if (!next) return { applied: false, session };

  const now = new Date();
  const timeLimit = next.qIndex !== null ? (session.questions_snapshot[next.qIndex]?.time_limit_sec ?? null) : null;

  let query = db
    .from("sessions")
    .update({
      state: next.state,
      current_q_index: next.qIndex,
      last_activity_at: now.toISOString(),
      ...timingFor(next, now, timeLimit),
    })
    .eq("id", sessionId)
    .eq("state", expected.state);
  query = expected.qIndex === null ? query.is("current_q_index", null) : query.eq("current_q_index", expected.qIndex);

  const { data: updated, error: uError } = await query.select("*");
  if (uError) fail(uError);
  if (updated.length === 0) {
    // 그 사이 다른 요청이 먼저 바꿈
    const { data: latest } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    return { applied: false, session: latest };
  }
  return { applied: true, session: updated[0] };
}

export type SubmitStatus = "accepted" | "duplicate" | "closed" | "not_found";

/** 답안 저장(005_submit_answer.sql). 문제 진행 중이 아니면 'closed' */
export async function submitAnswer(args: {
  sessionId: string;
  participantId: string;
  questionIndex: number;
  questionId: string;
  choiceIds: number[];
  isCorrect: boolean;
  elapsedMs: number;
  score: number;
}): Promise<SubmitStatus> {
  const { data, error } = await getAdminClient().rpc("submit_answer", {
    p_session_id: args.sessionId,
    p_participant_id: args.participantId,
    p_question_index: args.questionIndex,
    p_question_id: args.questionId,
    p_choice_ids: args.choiceIds,
    p_is_correct: args.isCorrect,
    p_elapsed_ms: args.elapsedMs,
    p_score: args.score,
  });
  if (error) fail(error);
  return data as SubmitStatus;
}
