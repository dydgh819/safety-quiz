"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { PhoneStateResponse } from "@/lib/api/play-api";
import {
  clearCredentials,
  getOrCreateDeviceId,
  loadCredentials,
  saveCredentials,
} from "@/lib/client/participant-storage";
import { fetchPhoneState, joinSession, lookupPin, type ClientErrorCode } from "@/lib/client/play-client";
import { offsetFrom } from "@/lib/client/use-server-clock";
import { checkNickname, normalizeNickname } from "@/lib/game/nickname";
import { NICKNAME_MAX } from "@/lib/quiz/constants";
import { useSessionSignal } from "@/lib/realtime/use-session-signal";
import { ko } from "@/messages/ko";

import { GameView, type PhoneState } from "./game-view";

type SessionInfo = { sessionId: string; eduTitle: string };
type StateResult = PhoneStateResponse | { ok: false; error: "network" };

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "storageBlocked" }
  | { kind: "form"; session: SessionInfo }
  | { kind: "joined"; session: SessionInfo; state: PhoneState; offset: number }
  | { kind: "kicked" }
  | { kind: "ended" };

/** 방송이 안 될 때 상태를 다시 확인하는 간격: 대기실 10초, 퀴즈 진행 중 5초 */
const LOBBY_POLL_MS = 10000;
const GAME_POLL_MS = 5000;

function errorMessage(code: ClientErrorCode): string {
  return ko.play.errors[code];
}

/** 피교육자 화면: PIN 확인 → (저장된 입장 정보로 자동 복귀 | M2 닉네임 입력) → 진행 화면(M3~M8) */
export function PlayApp({ pin }: { pin: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  /** 상태 API 결과로 화면을 맞춘다. 입장 정보가 무효면 지우고 입력 화면으로 */
  const applyState = useCallback((session: SessionInfo, result: StateResult, requestStartedAt: number) => {
    if (result.ok) {
      setPhase({ kind: "joined", session, state: result, offset: offsetFrom(result.serverTime, requestStartedAt) });
      return;
    }
    if (result.error === "kicked") {
      setPhase({ kind: "kicked" });
    } else if (result.error === "unauthorized" || result.error === "notFound") {
      clearCredentials(session.sessionId);
      setPhase({ kind: "form", session });
    }
    // network 등 일시 오류: 현재 화면 유지(다음 확인 때 다시 시도)
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const lookup = await lookupPin(pin);
      if (cancelled) return;
      if (!lookup.ok) {
        setPhase(lookup.error === "ended" ? { kind: "ended" } : { kind: "error", message: errorMessage(lookup.error) });
        return;
      }
      if (!getOrCreateDeviceId()) {
        setPhase({ kind: "storageBlocked" });
        return;
      }
      const session = { sessionId: lookup.sessionId, eduTitle: lookup.eduTitle };
      const credentials = loadCredentials(session.sessionId);
      if (!credentials) {
        setPhase({ kind: "form", session });
        return;
      }
      // 같은 기기 자동 복귀(JN-07, D-03), 진행 중이면 현재 단계로(PL-10, MB-01)
      const startedAt = Date.now();
      const state = await fetchPhoneState(session.sessionId, credentials);
      if (cancelled) return;
      if (!state.ok && state.error === "network") {
        setPhase({ kind: "error", message: errorMessage("network") });
        return;
      }
      applyState(session, state, startedAt);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [pin, applyState]);

  const joinedSession = phase.kind === "joined" ? phase.session : null;
  const refresh = useCallback(async () => {
    if (!joinedSession) return;
    const credentials = loadCredentials(joinedSession.sessionId);
    if (!credentials) return;
    const startedAt = Date.now();
    applyState(joinedSession, await fetchPhoneState(joinedSession.sessionId, credentials), startedAt);
  }, [joinedSession, applyState]);

  const game = phase.kind === "joined" ? phase.state.game : null;
  useSessionSignal(
    joinedSession?.sessionId ?? null,
    () => void refresh(),
    !game || game.state === "lobby" || game.state === "ended" ? LOBBY_POLL_MS : GAME_POLL_MS,
  );

  // 예고·문제 시간이 끝날 즈음 한 번 더 확인(방송이 늦거나 막혀도 다음 단계로 빨리 넘어가게)
  const stageEnd = game && (game.state === "countdown" || game.state === "question") ? game.qEndsAt : null;
  const offset = phase.kind === "joined" ? phase.offset : 0;
  const stageState = game?.state;
  useEffect(() => {
    if (!stageEnd) return;
    const extra = stageState === "countdown" ? 300 : 1200;
    const delay = new Date(stageEnd).getTime() - (Date.now() + offset) + extra;
    const timer = setTimeout(() => void refresh(), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [stageEnd, stageState, offset, refresh]);

  switch (phase.kind) {
    case "loading":
      return <Center>{ko.play.loading}</Center>;
    case "error":
      return (
        <Card>
          <p className="text-center text-lg font-semibold text-red-700">{phase.message}</p>
          <OtherPinLink />
        </Card>
      );
    case "storageBlocked":
      return (
        <Card>
          <p className="text-center font-semibold">{ko.play.storageBlocked}</p>
        </Card>
      );
    case "form":
      return <NicknameForm session={phase.session} onJoined={(state, startedAt) => applyState(phase.session, state, startedAt)} />;
    case "joined":
      return (
        <GameView sessionId={phase.session.sessionId} data={phase.state} offset={phase.offset} onRefresh={() => void refresh()} />
      );
    case "kicked":
      return (
        <Card>
          <p className="text-center text-2xl font-bold">{ko.play.kickedTitle}</p>
          <p className="text-center text-neutral-600">{ko.play.kickedBody}</p>
        </Card>
      );
    case "ended":
      return (
        <Card>
          <p className="text-center text-2xl font-bold">{ko.play.endedTitle}</p>
          <p className="text-center text-neutral-600">{ko.play.endedBody}</p>
          <OtherPinLink />
        </Card>
      );
  }
}

/** M2 닉네임 입력 + 개인정보 안내(JN-04, JN-10) */
function NicknameForm({
  session,
  onJoined,
}: {
  session: SessionInfo;
  onJoined: (state: PhoneStateResponse, requestStartedAt: number) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeNickname(nickname);
    const problem = checkNickname(normalized);
    if (problem) {
      setError(errorMessage(problem === "empty" ? "nicknameEmpty" : "nicknameTooLong"));
      return;
    }
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) {
      setError(ko.play.storageBlocked);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await joinSession(session.sessionId, normalized, deviceId);
    if (!result.ok) {
      setError(
        result.error === "deviceUsed" && "currentNickname" in result && result.currentNickname
          ? ko.play.deviceUsedAs(result.currentNickname)
          : errorMessage(result.error),
      );
      setBusy(false);
      return;
    }
    const credentials = { participantId: result.participantId, token: result.token };
    if (!saveCredentials(session.sessionId, credentials)) {
      setError(ko.play.storageBlocked);
      setBusy(false);
      return;
    }
    const startedAt = Date.now();
    const state = await fetchPhoneState(session.sessionId, credentials);
    if (!state.ok && state.error === "network") {
      // 입장은 됐지만 상태를 못 받음 → 다시 누르면 같은 기기·닉네임으로 재입장된다
      setError(errorMessage("network"));
      setBusy(false);
      return;
    }
    onJoined(state, startedAt);
  }

  return (
    <Card>
      <p className="text-center text-lg font-bold break-keep text-brand-700">{session.eduTitle}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-semibold">{ko.play.nicknameLabel}</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX * 2}
            autoFocus
            autoComplete="nickname"
            enterKeyHint="go"
            placeholder={ko.play.nicknamePlaceholder}
            aria-invalid={!!error}
            className="min-h-14 rounded-2xl border-2 border-neutral-300 px-4 text-xl focus:border-brand-500 focus:outline-none"
          />
          <span className="text-sm text-neutral-500">{ko.play.nicknameHint(NICKNAME_MAX)}</span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{ko.play.privacy}</p>
        <button
          type="submit"
          disabled={busy}
          className="min-h-14 rounded-2xl bg-brand-500 text-xl font-bold text-white disabled:opacity-50"
        >
          {busy ? ko.play.entering : ko.play.enter}
        </button>
      </form>
    </Card>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <p className="flex flex-1 items-center justify-center p-8 text-neutral-500">{children}</p>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function OtherPinLink() {
  return (
    <Link href="/join" className="min-h-12 rounded-2xl border-2 border-neutral-300 py-3 text-center font-semibold">
      {ko.play.otherPin}
    </Link>
  );
}
