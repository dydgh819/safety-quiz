import type { NextRequest } from "next/server";

import type { PhoneStateResponse } from "@/lib/api/play-api";
import { authenticateRequest } from "@/lib/api/participant-auth";
import { json, playError } from "@/lib/api/respond";
import { loadGameData } from "@/lib/db/game";
import { markParticipantSeen } from "@/lib/db/sessions";
import { buildPhoneGame } from "@/lib/game/views";

/**
 * 폰의 현재 상태(PRD 5.3 재접속, MB-01). 연결될 때마다·방송 신호를 받을 때마다·주기적으로 부른다.
 * 정답·현재 문제 점수는 reveal 이후에만 들어간다(buildPhoneGame, 절대 규칙 3).
 * 부를 때마다 last_seen_at 을 갱신한다(조기 마감의 '접속 중' 판단, D-11).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/state">) {
  const { id } = await ctx.params;
  try {
    const auth = await authenticateRequest(request, id);
    if (!auth.ok) return playError(auth.error);
    const me = auth.participant;

    const [data] = await Promise.all([loadGameData(id), markParticipantSeen(me.id)]);
    if (!data) return playError("notFound");

    const body: PhoneStateResponse = {
      ok: true,
      serverTime: new Date().toISOString(),
      session: {
        id: data.session.id,
        eduTitle: data.session.edu_title,
        state: data.session.state,
        playType: data.session.play_type,
        totalQuestions: data.session.questions_snapshot.length,
        participantCount: data.participants.length,
      },
      me: { id: me.id, nickname: me.nickname, joinedAt: me.joined_at },
      game: buildPhoneGame(data, me.id),
    };
    return json(body);
  } catch (error) {
    console.error("[api:state]", error);
    return playError("serverError");
  }
}
