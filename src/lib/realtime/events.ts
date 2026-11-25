/**
 * 실시간 채널·이벤트(PRD 5.3). 회차마다 채널 하나: session:{sessionId}
 *
 * 절대 규칙 6(D-19): Supabase 공개 채널은 누구나 보낼 수 있으므로 방송은 "다시 확인하라"는 신호로만 쓴다.
 * 받는 쪽은 페이로드를 믿지 말고 API 로 상태를 다시 받는다. 그래서 페이로드에는 식별용 최소 정보만 넣는다.
 */

export function sessionChannel(sessionId: string): string {
  return `session:${sessionId}`;
}

export type SessionEventMap = {
  participant_joined: { participantId: string };
  participant_kicked: { participantId: string };
  lobby_changed: Record<string, never>;
};

export type SessionEventName = keyof SessionEventMap;
