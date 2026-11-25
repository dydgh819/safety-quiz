import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { sessionChannel, type SessionEventMap, type SessionEventName } from "./events";

/**
 * 서버 → 발표 화면·폰 방송(REST). 실패해도 예외를 던지지 않는다:
 * 방송은 신호일 뿐이고, 받는 쪽은 주기적으로도 상태를 다시 확인하기 때문이다.
 */
export async function broadcastSessionEvent<E extends SessionEventName>(
  sessionId: string,
  event: E,
  payload: SessionEventMap[E],
): Promise<void> {
  const db = getAdminClient();
  const channel = db.channel(sessionChannel(sessionId));
  try {
    const result = await channel.httpSend(event, payload, { timeout: 3000 });
    if (!result.success) console.error(`[broadcast:${event}]`, result.status, result.error);
  } catch (error) {
    console.error(`[broadcast:${event}]`, error);
  } finally {
    await db.removeChannel(channel);
  }
}
