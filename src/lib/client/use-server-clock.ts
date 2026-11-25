"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 서버 시각 보정(절대 규칙 1: 클라이언트 시각은 표시용 보정에만 쓴다).
 * 화면은 서버 응답의 serverTime 으로 "서버 − 내 기기" 차이(offset)를 기억해 두고,
 * 남은 시간을 그릴 때 Date.now() + offset 을 서버 시각으로 쓴다.
 */

/** 서버 응답으로 시각 차이 계산. 요청에 걸린 시간의 절반을 보정한다 */
export function offsetFrom(serverTimeIso: string, requestStartedAt: number, receivedAt: number = Date.now()): number {
  const rtt = Math.max(0, receivedAt - requestStartedAt);
  return new Date(serverTimeIso).getTime() + rtt / 2 - receivedAt;
}

/** tickMs 마다 다시 그리기 위한 현재 기기 시각(서버 렌더 때는 0 = 아직 모름) */
export function useTick(tickMs: number): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, tickMs);
      return () => clearInterval(timer);
    },
    [tickMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / tickMs) * tickMs,
    () => 0,
  );
}

/** 마감까지 남은 초(올림, 0 이상). 시각을 모르면 null */
export function secondsLeft(endsAtIso: string | null, serverNowMs: number): number | null {
  if (!endsAtIso || serverNowMs === 0) return null;
  return Math.max(0, Math.ceil((new Date(endsAtIso).getTime() - serverNowMs) / 1000));
}

/** 시작~마감 중 남은 비율(1 → 0) */
export function remainingRatio(startIso: string | null, endIso: string | null, serverNowMs: number): number {
  if (!startIso || !endIso || serverNowMs === 0) return 1;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (end - serverNowMs) / (end - start)));
}
