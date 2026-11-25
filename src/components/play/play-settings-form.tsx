"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSessionAction } from "@/app/(host)/shows/[id]/play/actions";
import { DEFAULT_SESSION_OPTIONS } from "@/lib/quiz/constants";
import { ko } from "@/messages/ko";
import type { PlayType, SessionOptions } from "@/types/db";

type Props = {
  showId: string;
  showTitle: string;
  questionCount: number;
  defaultDate: string;
};

const OPTION_KEYS: (keyof SessionOptions)[] = [
  "hide_leaderboard",
  "show_choice_text",
  "sound",
  "allow_rejoin",
  "use_submit_button",
  "auto_advance",
  "allow_late_join",
];

/** A5 Play 설정: 교육명·교육일·현장/원격·옵션 7종(D-05) → 시작 */
export function PlaySettingsForm({ showId, showTitle, questionCount, defaultDate }: Props) {
  const router = useRouter();
  const [eduTitle, setEduTitle] = useState(showTitle);
  const [eduDate, setEduDate] = useState(defaultDate);
  const [playType, setPlayType] = useState<PlayType>("onsite");
  const [options, setOptions] = useState<SessionOptions>(DEFAULT_SESSION_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 화면에서 바꿀 수 없는 옵션: 재접속 허용(D-03 항상 On), 원격 Play 의 답변 노출(항상 On) */
  function lockedReason(key: keyof SessionOptions): string | null {
    if (key === "allow_rejoin") return ko.playSettings.alwaysOn;
    if (key === "show_choice_text" && playType === "remote") return ko.playSettings.alwaysOnRemote;
    return null;
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (eduTitle.trim() === "") {
      setError(ko.playSettings.eduTitleRequired);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createSessionAction(showId, {
      edu_title: eduTitle.trim(),
      edu_date: eduDate,
      play_type: playType,
      options: { ...options, allow_rejoin: true, show_choice_text: playType === "remote" ? true : options.show_choice_text },
    });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.push(`/host/${result.data.sessionId}`);
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{ko.playSettings.title}</h1>
        <p className="mt-1 text-neutral-500">
          {showTitle} · {ko.shows.questionCount(questionCount)}
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-[1fr_12rem]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{ko.playSettings.eduTitle}</span>
          <input
            value={eduTitle}
            maxLength={100}
            onChange={(e) => setEduTitle(e.target.value)}
            placeholder={ko.playSettings.eduTitlePlaceholder}
            className="min-h-11 rounded-lg border border-neutral-300 px-3 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{ko.playSettings.eduDate}</span>
          <input
            type="date"
            value={eduDate}
            required
            onChange={(e) => setEduDate(e.target.value)}
            className="min-h-11 rounded-lg border border-neutral-300 px-3 focus:border-brand-500 focus:outline-none"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{ko.playSettings.playType}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["onsite", "remote"] as const).map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 bg-white p-4 ${
                playType === type ? "border-brand-500 ring-2 ring-brand-100" : "border-neutral-200"
              }`}
            >
              <span className="flex items-center gap-2 font-bold">
                <input
                  type="radio"
                  name="play_type"
                  checked={playType === type}
                  onChange={() => setPlayType(type)}
                  className="size-4 accent-brand-500"
                />
                {type === "onsite" ? ko.playSettings.onsite : ko.playSettings.remote}
              </span>
              <span className="text-sm text-neutral-600">
                {type === "onsite" ? ko.playSettings.onsiteDesc : ko.playSettings.remoteDesc}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">{ko.playSettings.options}</legend>
        <p className="mb-2 text-xs text-neutral-500">{ko.playSettings.optionsLater}</p>
        {OPTION_KEYS.map((key) => {
          const locked = lockedReason(key);
          const checked = locked ? true : options[key];
          return (
            <label
              key={key}
              className={`flex min-h-12 items-center justify-between gap-4 border-b border-neutral-100 py-2 last:border-0 ${
                locked ? "opacity-60" : "cursor-pointer"
              }`}
            >
              <span className="flex flex-col">
                <span className="font-medium">{ko.playSettings.optionLabels[key]}</span>
                <span className="text-xs text-neutral-500">{locked ?? ko.playSettings.optionHints[key]}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={checked}
                disabled={!!locked}
                onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full bg-neutral-300 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
              />
            </label>
          );
        })}
      </fieldset>

      <p className="text-sm text-neutral-500">{ko.playSettings.roster}</p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-14 rounded-xl bg-brand-500 text-lg font-bold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy ? ko.playSettings.starting : ko.playSettings.start}
      </button>
    </form>
  );
}
