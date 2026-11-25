import type { NextRequest } from "next/server";

import type { AnswerResponse } from "@/lib/api/play-api";
import { authenticateRequest } from "@/lib/api/participant-auth";
import { json, playError } from "@/lib/api/respond";
import { submitAnswer } from "@/lib/db/game";
import { getSession } from "@/lib/db/sessions";
import { calculateScore, correctChoiceIds, isAnswerCorrect } from "@/lib/game/scoring";
import { ANSWER_GRACE_MS } from "@/lib/game/state-machine";
import { answerRequestSchema } from "@/lib/validation/session";

/**
 * 답안 제출(PRD 5.4). 점수·정답 여부·경과 시간은 모두 서버가 계산한다(절대 규칙 1).
 * - 문제 진행 중이고, 서버 시각이 마감 + 0.5초 이내일 때만 접수
 * - 처음 낸 답이 최종(유일 제약). 다시 보내도 '접수됨'(재시도 안전)
 * - 응답에는 정답 여부를 넣지 않는다(절대 규칙 3)
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/answer">) {
  const receivedAt = Date.now();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return playError("invalidInput");
  }
  const parsed = answerRequestSchema.safeParse(body);
  if (!parsed.success) return playError("invalidInput");

  try {
    const auth = await authenticateRequest(request, id);
    if (!auth.ok) return playError(auth.error);

    const session = await getSession(id);
    if (!session) return playError("notFound");
    if (session.state !== "question" || session.current_q_index !== parsed.data.questionIndex) return playError("closed");
    if (!session.q_started_at || !session.q_ends_at) return playError("closed");
    if (receivedAt > new Date(session.q_ends_at).getTime() + ANSWER_GRACE_MS) return playError("late");

    const question = session.questions_snapshot[parsed.data.questionIndex];
    if (!question) return playError("invalidInput");
    const validIds = new Set(question.choices.map((c) => c.id));
    const chosen = [...new Set(parsed.data.choiceIds)].sort((a, b) => a - b);
    const correctIds = correctChoiceIds(question.choices);
    if (chosen.some((c) => !validIds.has(c))) return playError("invalidInput");
    if (correctIds.length <= 1 && chosen.length !== 1) return playError("invalidInput"); // 단일 정답 문항은 1개만

    const elapsedMs = Math.max(0, receivedAt - new Date(session.q_started_at).getTime());
    const isCorrect = isAnswerCorrect(chosen, correctIds);
    const score = calculateScore({
      correct: isCorrect,
      elapsedMs,
      timeLimitSec: question.time_limit_sec,
      useScore: question.use_score,
      doubleScore: question.double_score,
    });

    const status = await submitAnswer({
      sessionId: id,
      participantId: auth.participant.id,
      questionIndex: parsed.data.questionIndex,
      questionId: question.id,
      choiceIds: chosen,
      isCorrect,
      elapsedMs,
      score,
    });
    if (status === "closed" || status === "not_found") return playError("closed");

    const response: AnswerResponse = { ok: true, received: true };
    return json(response);
  } catch (error) {
    console.error("[api:answer]", error);
    return playError("serverError");
  }
}
