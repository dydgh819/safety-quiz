"use client";

import { useEffect, useRef } from "react";

import { getBrowserClient } from "@/lib/supabase/client";

import { sessionChannel } from "./events";

/**
 * 회차 채널의 방송을 "다시 확인하라"는 신호로 받는다(절대 규칙 6, D-19).
 * - 어떤 이벤트든 오면 onSignal 을 부른다(페이로드는 믿지 않음).
 * - 방송이 막히거나 끊겨도 동작하도록 fallbackMs 마다, 그리고 화면이 다시 보일 때도 부른다.
 */
export function useSessionSignal(sessionId: string | null, onSignal: () => void, fallbackMs: number): void {
  const callback = useRef(onSignal);
  useEffect(() => {
    callback.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!sessionId) return;
    const fire = () => callback.current();

    let removeChannel: (() => void) | null = null;
    try {
      const client = getBrowserClient();
      const channel = client
        .channel(sessionChannel(sessionId))
        .on("broadcast", { event: "*" }, fire)
        .subscribe();
      removeChannel = () => void client.removeChannel(channel);
    } catch (error) {
      console.error("[realtime]", error); // 환경변수 누락 등 → 주기 확인만으로 동작
    }

    const timer = setInterval(fire, fallbackMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      removeChannel?.();
    };
  }, [sessionId, fallbackMs]);
}
