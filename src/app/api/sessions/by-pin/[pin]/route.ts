import { connection, type NextRequest } from "next/server";

import type { PinLookupResponse } from "@/lib/api/play-api";
import { json, playError } from "@/lib/api/respond";
import { getActiveSessionByPin } from "@/lib/db/sessions";
import { isValidPin } from "@/lib/game/pin";

/** JN-03: PIN 으로 진행 중 회차 찾기 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/sessions/by-pin/[pin]">) {
  await connection(); // 요청마다 조회(프리렌더 제외)
  const { pin } = await ctx.params;
  if (!isValidPin(pin)) return playError("invalidInput");
  try {
    const session = await getActiveSessionByPin(pin);
    if (!session) return playError("notFound");
    const body: PinLookupResponse = {
      ok: true,
      sessionId: session.id,
      eduTitle: session.edu_title,
      state: session.state,
      entryClosed: session.entry_closed,
    };
    return json(body);
  } catch (error) {
    console.error("[api:by-pin]", error);
    return playError("serverError");
  }
}
