"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";

import { kickParticipantAction, setEntryClosedAction } from "@/app/host/[sessionId]/actions";
import type { HostView } from "@/lib/game/views";
import { ko } from "@/messages/ko";

type Props = {
  view: HostView;
  starting: boolean;
  onStart: () => void;
  /** 강퇴·입장 마감 후 화면 데이터 다시 읽기 */
  onChanged: () => Promise<void>;
};

const noop = () => () => {};
/** 접속 주소의 기준(현재 사이트 주소). 서버 렌더 때는 빈 문자열 */
function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

/** P1 대기실: PIN·QR·접속 주소, 입장 인원·닉네임(최근 입장 순), 강퇴, 입장 마감, 퀴즈 시작 */
export function HostLobby({ view, starting, onStart, onChanged }: Props) {
  const origin = useOrigin();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [entryClosed, setEntryClosed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const qrRef = useRef<HTMLCanvasElement>(null);

  const playUrl = origin ? `${origin}/play/${view.pin}` : "";
  const joinUrl = origin ? `${origin}/join` : "";
  const participants = view.participants.filter((p) => !hidden.has(p.id));
  const closed = entryClosed ?? view.entryClosed;

  function kick(participantId: string, nickname: string) {
    if (!window.confirm(ko.host.confirmKick(nickname))) return;
    setError(null);
    setHidden((h) => new Set(h).add(participantId)); // 화면에서 먼저 빼고
    startTransition(async () => {
      const result = await kickParticipantAction(view.sessionId, participantId);
      if (!result.ok) {
        setError(result.error);
        setHidden((h) => {
          const next = new Set(h);
          next.delete(participantId);
          return next;
        });
      }
      await onChanged();
    });
  }

  function toggleEntry() {
    const next = !closed;
    setEntryClosed(next);
    startTransition(async () => {
      const result = await setEntryClosedAction(view.sessionId, next);
      if (!result.ok) setError(result.error);
      await onChanged();
      setEntryClosed(null);
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
    link.download = ko.host.qrFileName(view.pin);
    link.click();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-brand-50 to-brand-100 text-neutral-900">
      <header className="flex flex-wrap items-center gap-4 px-8 py-4">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{view.eduTitle}</h1>
        <span className="text-lg font-semibold text-neutral-500">{ko.shows.questionCount(view.total)}</span>
        <button
          type="button"
          onClick={toggleEntry}
          disabled={pending}
          className={`min-h-12 rounded-xl px-5 font-bold ${
            closed ? "bg-neutral-700 text-white" : "border-2 border-neutral-400 bg-white text-neutral-700"
          }`}
        >
          {closed ? `${ko.host.entryClosedBadge} · ${ko.host.reopenEntry}` : ko.host.closeEntry}
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={starting || view.total === 0}
          title={ko.host.keyboardHint}
          className="min-h-12 rounded-xl bg-brand-500 px-8 text-lg font-bold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {starting ? ko.host.starting : ko.host.start}
        </button>
      </header>

      {error && (
        <p role="alert" className="mx-8 rounded-lg bg-red-50 px-4 py-2 text-red-700">
          {error}
        </p>
      )}

      <main className="grid flex-1 gap-8 px-8 pb-8 lg:grid-cols-[minmax(22rem,36%)_1fr]">
        <section className="flex flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold break-keep text-neutral-600">{ko.host.howToJoin}</p>
          <div className="w-full max-w-[26rem]">
            {playUrl && (
              <QRCodeCanvas ref={qrRef} value={playUrl} size={640} marginSize={2} className="h-auto w-full" aria-label={playUrl} />
            )}
          </div>
          <p className="text-3xl font-bold break-all text-brand-700">{joinUrl.replace(/^https?:\/\//, "")}</p>
          <div>
            <p className="text-xl font-semibold text-neutral-500">{ko.host.pinLabel}</p>
            <p className="text-7xl font-extrabold tracking-[0.15em] tabular-nums">{view.pin}</p>
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

        <section className="flex min-h-0 flex-col gap-4">
          <div className="flex items-baseline gap-4">
            <p className="text-5xl font-extrabold text-brand-700" aria-live="polite">
              {ko.host.participants(participants.length)}
            </p>
            {participants.length > 0 && <p className="text-neutral-500">{ko.host.kickHint}</p>}
          </div>
          {participants.length === 0 ? (
            <p className="mt-8 text-center text-2xl text-neutral-500">{ko.host.noParticipants}</p>
          ) : (
            <ul className="flex flex-wrap content-start gap-3">
              {participants.map((p) => (
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
