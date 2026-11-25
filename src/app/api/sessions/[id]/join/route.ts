import type { NextRequest } from "next/server";

import type { JoinResponse } from "@/lib/api/play-api";
import { json, playError } from "@/lib/api/respond";
import { joinSession } from "@/lib/db/sessions";
import { checkNickname, normalizeNickname } from "@/lib/game/nickname";
import { broadcastSessionEvent } from "@/lib/realtime/broadcast";
import { uuidSchema } from "@/lib/validation/show";
import { joinRequestSchema } from "@/lib/validation/session";

/**
 * JN-04·06·07·10: 닉네임으로 입장. 성공하면 참가자 id 와 재접속 토큰(원문)을 돌려주고, DB 에는 해시만 저장한다.
 * 입장 시각(joined_at)이 출석 시각이다.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/join">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return playError("invalidInput");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return playError("invalidInput");
  }
  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) return playError("invalidInput");

  const nickname = normalizeNickname(parsed.data.nickname);
  const problem = checkNickname(nickname);
  if (problem === "empty") return playError("nicknameEmpty");
  if (problem === "tooLong") return playError("nicknameTooLong");

  try {
    const result = await joinSession(id, nickname, parsed.data.deviceId);
    if (!result.ok) return playError(result.reason, { currentNickname: result.currentNickname });

    if (!result.rejoined) {
      await broadcastSessionEvent(id, "participant_joined", { participantId: result.participant.id });
    }
    const response: JoinResponse = {
      ok: true,
      participantId: result.participant.id,
      nickname: result.participant.nickname,
      token: result.token,
      rejoined: result.rejoined,
    };
    return json(response);
  } catch (error) {
    console.error("[api:join]", error);
    return playError("serverError");
  }
}
