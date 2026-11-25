import type { NextRequest } from "next/server";

import type { PhoneStateResponse } from "@/lib/api/play-api";
import { json, playError } from "@/lib/api/respond";
import { authenticateParticipant, countParticipants, getSession, markParticipantSeen } from "@/lib/db/sessions";
import { uuidSchema } from "@/lib/validation/show";
import {
  PARTICIPANT_ID_HEADER,
  PARTICIPANT_TOKEN_HEADER,
  participantCredentialsSchema,
} from "@/lib/validation/session";

/**
 * 폰의 현재 상태 조회(PRD 5.3 재접속). 연결될 때마다·방송 신호를 받을 때마다 부른다.
 * 4단계: 대기실 정보까지. 5단계에서 문제·결과 정보를 더한다(정답은 reveal 전 절대 포함 금지).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/state">) {
  const { id } = await ctx.params;
  const credentials = participantCredentialsSchema.safeParse({
    participantId: request.headers.get(PARTICIPANT_ID_HEADER),
    token: request.headers.get(PARTICIPANT_TOKEN_HEADER),
  });
  if (!uuidSchema.safeParse(id).success || !credentials.success) return playError("unauthorized");

  try {
    const [session, me] = await Promise.all([
      getSession(id),
      authenticateParticipant(id, credentials.data.participantId, credentials.data.token),
    ]);
    if (!session) return playError("notFound");
    if (!me) return playError("unauthorized");
    if (me.kicked) return playError("kicked");

    const [participantCount] = await Promise.all([countParticipants(id), markParticipantSeen(me.id)]);
    const body: PhoneStateResponse = {
      ok: true,
      serverTime: new Date().toISOString(),
      session: {
        id: session.id,
        eduTitle: session.edu_title,
        state: session.state,
        playType: session.play_type,
        totalQuestions: session.questions_snapshot.length,
        participantCount,
      },
      me: { id: me.id, nickname: me.nickname, joinedAt: me.joined_at },
    };
    return json(body);
  } catch (error) {
    console.error("[api:state]", error);
    return playError("serverError");
  }
}
