"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { advanceAction, getHostViewAction, getProgressAction } from "@/app/host/[sessionId]/actions";
import { HostLobby } from "@/components/host/host-lobby";
import {
  CountdownView,
  EndedView,
  FinalView,
  HostTopBar,
  LeaderboardView,
  QuestionView,
  RevealView,
} from "@/components/host/host-views";
import { offsetFrom, useTick } from "@/lib/client/use-server-clock";
import { ANSWER_GRACE_MS, type GamePosition } from "@/lib/game/state-machine";
import type { HostView } from "@/lib/game/views";
import { useSessionSignal } from "@/lib/realtime/use-session-signal";
import { ko } from "@/messages/ko";

/** 방송이 안 될 때 발표 화면이 상태를 다시 확인하는 간격 */
const HOST_POLL_MS = 3000;
/** 문제 진행 중 응답 현황 확인 간격(D-20) */
const PROGRESS_POLL_MS = 500;

function positionOf(view: HostView): GamePosition {
  return { state: view.state, qIndex: view.qIndex };
}

/** 지금 단계의 '다음' 버튼 문구(예고 중·종료 후에는 없음) */
function primaryLabel(state: HostView["state"]): string | null {
  switch (state) {
    case "lobby":
      return ko.host.start;
    case "question":
      return ko.host.close;
    case "reveal":
    case "leaderboard":
      return ko.host.next;
    case "final":
      return ko.host.end;
    default:
      return null;
  }
}

/**
 * 발표 화면 루트(P1~P7, PL-02·03·05·10).
 * - 상태는 항상 서버 기준: 처음엔 서버 렌더 데이터, 이후 방송 신호·주기 확인·진행 응답으로 갱신
 * - 예고 3초·제한시간이 끝나면, 또는 접속 중 전원이 응답하면 이 화면이 '다음'을 요청한다
 *   (같은 요청이 두 번 가도 서버가 한 번만 반영)
 * - 스페이스바·→·PageDown(프레젠터 리모컨) = 다음
 */
export function HostScreen({ initial }: { initial: HostView }) {
  const [view, setView] = useState(initial);
  const [offset, setOffset] = useState(() =>
    typeof window === "undefined" ? 0 : new Date(initial.serverTime).getTime() - Date.now(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const sessionId = initial.sessionId;

  const tick = useTick(250);
  const serverNow = tick === 0 ? 0 : tick + offset;

  const apply = useCallback((next: HostView, startedAt: number) => {
    setView(next);
    setOffset(offsetFrom(next.serverTime, startedAt));
  }, []);

  const reload = useCallback(async () => {
    const startedAt = Date.now();
    const result = await getHostViewAction(sessionId);
    if (result.ok) apply(result.data, startedAt);
  }, [sessionId, apply]);

  const advance = useCallback(
    async (expected: GamePosition) => {
      if (inflight.current) return;
      inflight.current = true;
      setBusy(true);
      setError(null);
      const startedAt = Date.now();
      const result = await advanceAction(sessionId, expected);
      inflight.current = false;
      setBusy(false);
      if (result.ok) apply(result.data, startedAt);
      else setError(result.error);
    },
    [sessionId, apply],
  );

  useSessionSignal(sessionId, () => void reload(), HOST_POLL_MS);

  // 예고·문제 시간이 끝나면 자동으로 다음(문제는 제출 유예 0.5초 뒤)
  useEffect(() => {
    if ((view.state !== "countdown" && view.state !== "question") || !view.qEndsAt) return;
    const grace = view.state === "question" ? ANSWER_GRACE_MS : 0;
    const delay = new Date(view.qEndsAt).getTime() + grace - (Date.now() + offset);
    const expected = { state: view.state, qIndex: view.qIndex };
    const timer = setTimeout(() => void advance(expected), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [view.state, view.qIndex, view.qEndsAt, offset, advance]);

  // 문제 진행 중 응답 현황(0.5초마다)
  useEffect(() => {
    if (view.state !== "question") return;
    const qIndex = view.qIndex;
    const timer = setInterval(async () => {
      const result = await getProgressAction(sessionId);
      if (!result.ok) return;
      setView((v) => (v.state === "question" && v.qIndex === qIndex ? { ...v, progress: result.data } : v));
    }, PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [view.state, view.qIndex, sessionId]);

  // 접속 중 전원이 응답하면 조기 마감(PL-05)
  const progress = view.state === "question" ? view.progress : null;
  const allAnswered = !!progress && progress.active > 0 && progress.answered >= progress.active;
  useEffect(() => {
    if (!allAnswered) return;
    const expected = { state: "question" as const, qIndex: view.qIndex };
    const timer = setTimeout(() => void advance(expected), 300);
    return () => clearTimeout(timer);
  }, [allAnswered, view.qIndex, advance]);

  const primary = primaryLabel(view.state);
  const goNext = useCallback(() => {
    if (primaryLabel(view.state)) void advance(positionOf(view));
  }, [advance, view]);

  // 키보드·프레젠터 리모컨
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext]);

  if (view.state === "lobby") {
    return <HostLobby view={view} starting={busy} onStart={goNext} onChanged={reload} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-brand-50 to-brand-100 text-neutral-900">
      <HostTopBar view={view} />
      {error && (
        <p role="alert" className="mx-8 mt-2 rounded-lg bg-red-50 px-4 py-2 text-red-700">
          {error}
        </p>
      )}

      {view.state === "countdown" && <CountdownView view={view} serverNow={serverNow} />}
      {view.state === "question" && <QuestionView view={view} serverNow={serverNow} />}
      {view.state === "reveal" && <RevealView view={view} />}
      {view.state === "leaderboard" && <LeaderboardView view={view} />}
      {view.state === "final" && <FinalView view={view} />}
      {view.state === "ended" && <EndedView view={view} />}

      {primary && (
        <div className="flex items-center justify-between px-8 pb-6">
          <span className="text-sm text-neutral-500">{ko.host.keyboardHint}</span>
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="min-h-14 min-w-40 rounded-2xl bg-brand-500 px-10 text-2xl font-bold text-white shadow hover:bg-brand-600 disabled:opacity-50"
          >
            {primary}
          </button>
        </div>
      )}
    </div>
  );
}
