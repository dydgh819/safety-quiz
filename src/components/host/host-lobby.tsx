"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useRef, useState, useSyncExternalStore, useTransition } from "react";

import {
  getLobbyAction,
  kickParticipantAction,
  setEntryClosedAction,
  type LobbySnapshot,
} from "@/app/host/[sessionId]/actions";
import { useSessionSignal } from "@/lib/realtime/use-session-signal";
import { ko } from "@/messages/ko";

type Props = {
  sessionId: string;
  pin: string;
  eduTitle: string;
  totalQuestions: number;
  initial: LobbySnapshot;
};

/** 대기실 다시 읽기 간격(방송이 안 될 때의 보조) */
const LOBBY_POLL_MS = 5000;

const noop = () => () => {};
/** 접속 주소의 기준(현재 사이트 주소). 서버 렌더 때는 빈 문자열 */
function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

/** P1 대기실: PIN·QR·접속 주소, 입장 인원·닉네임(최근 입장 순), 강퇴, 입장 마감 */
export function HostLobby({ sessionId, pin, eduTitle, totalQuestions, initial }: Props) {
  const origin = useOrigin();
  const [lobby, setLobby] = useState<LobbySnapshot>(initial);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const qrRef = useRef<HTMLCanvasElement>(null);

  const playUrl = origin ? `${origin}/play/${pin}` : "";
  const joinUrl = origin ? `${origin}/join` : "";

  const reload = useCallback(async () => {
    const result = await getLobbyAction(sessionId);
    if (result.ok) setLobby(result.data);
  }, [sessionId]);

  useSessionSignal(sessionId, () => void reload(), LOBBY_POLL_MS);

  function kick(participantId: string, nickname: string) {
    if (!window.confirm(ko.host.confirmKick(nickname))) return;
    setError(null);
    // 화면에서 먼저 빼고, 실패하면 다시 읽는다
    setLobby((l) => ({ ...l, participants: l.participants.filter((p) => p.id !== participantId) }));
    startTransition(async () => {
      const result = await kickParticipantAction(sessionId, participantId);
      if (!result.ok) setError(result.error);
      await reload();
    });
  }

  function toggleEntry() {
    const next = !lobby.entryClosed;
    setLobby((l) => ({ ...l, entryClosed: next }));
    startTransition(async () => {
      const result = await setEntryClosedAction(sessionId, next);
      if (!result.ok) setError(result.error);
      await reload();
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 무시(주소는 화면에 보임)
    }
  }

  function downloadQr() {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = ko.host.qrFileName(pin);
    link.click();
  }

  const count = lobby.participants.length;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-brand-50 to-brand-100 text-neutral-900">
      {/* 상단: 교육명 · 입장 상태 · 시작 */}
      <header className="flex flex-wrap items-center gap-4 px-8 py-4">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{eduTitle}</h1>
        <span className="text-lg font-semibold text-neutral-500">{ko.shows.questionCount(totalQuestions)}</span>
        <button
          type="button"
          onClick={toggleEntry}
          disabled={pending}
          className={`min-h-12 rounded-xl px-5 font-bold ${
            lobby.entryClosed ? "bg-neutral-700 text-white" : "border-2 border-neutral-400 bg-white text-neutral-700"
          }`}
        >
          {lobby.entryClosed ? `${ko.host.entryClosedBadge} · ${ko.host.reopenEntry}` : ko.host.closeEntry}
        </button>
        <button
          type="button"
          disabled
          title={ko.host.startLater}
          className="min-h-12 rounded-xl bg-brand-500 px-8 text-lg font-bold text-white opacity-50"
        >
          {ko.host.start}
        </button>
      </header>

      {error && (
        <p role="alert" className="mx-8 rounded-lg bg-red-50 px-4 py-2 text-red-700">
          {error}
        </p>
      )}
      {lobby.state !== "lobby" && (
        <p className="mx-8 rounded-lg bg-white/80 px-4 py-2 font-semibold">
          {lobby.state === "ended" ? ko.host.ended : ko.host.inProgress}
        </p>
      )}

      <main className="grid flex-1 gap-8 px-8 pb-8 lg:grid-cols-[minmax(22rem,36%)_1fr]">
        {/* 입장 안내 */}
        <section className="flex flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-neutral-600 break-keep">{ko.host.howToJoin}</p>
          <div className="w-full max-w-[26rem]">
            {playUrl && (
              <QRCodeCanvas
                ref={qrRef}
                value={playUrl}
                size={640}
                marginSize={2}
                className="h-auto w-full"
                aria-label={playUrl}
              />
            )}
          </div>
          <p className="text-3xl font-bold break-all text-brand-700">{joinUrl.replace(/^https?:\/\//, "")}</p>
          <div>
            <p className="text-xl font-semibold text-neutral-500">{ko.host.pinLabel}</p>
            <p className="text-7xl font-extrabold tracking-[0.15em] tabular-nums">{pin}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="min-h-11 rounded-lg border border-neutral-300 px-4 font-medium hover:bg-neutral-50"
            >
              {copied ? ko.host.copied : ko.host.copyUrl}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className="min-h-11 rounded-lg border border-neutral-300 px-4 font-medium hover:bg-neutral-50"
            >
              {ko.host.downloadQr}
            </button>
          </div>
        </section>

        {/* 입장한 참가자 */}
        <section className="flex min-h-0 flex-col gap-4">
          <div className="flex items-baseline gap-4">
            <p className="text-5xl font-extrabold text-brand-700" aria-live="polite">
              {ko.host.participants(count)}
            </p>
            {count > 0 && <p className="text-neutral-500">{ko.host.kickHint}</p>}
          </div>
          {count === 0 ? (
            <p className="mt-8 text-center text-2xl text-neutral-500">{ko.host.noParticipants}</p>
          ) : (
            <ul className="flex flex-wrap content-start gap-3">
              {lobby.participants.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => kick(p.id, p.nickname)}
                    className="min-h-14 rounded-2xl bg-white px-6 text-2xl font-bold shadow-sm transition hover:bg-red-50 hover:text-red-700 motion-safe:animate-[fadeIn_0.3s_ease-out]"
                  >
                    {p.nickname}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
