"use client";

import { useState } from "react";

import { choiceStyle } from "@/components/stage/choice-style";
import { ImageUploadButton } from "@/components/ui/image-upload-button";
import { addChoice, removeChoice, updateChoice } from "@/lib/quiz/choices";
import { CHOICE_TEXT_MAX, MAX_CHOICES, MIN_CHOICES, SHORT_QUESTION_MAX, TIME_LIMIT_OPTIONS } from "@/lib/quiz/constants";
import { questionTextLimit } from "@/lib/quiz/validate";
import { ko } from "@/messages/ko";
import type { QuestionRow } from "@/types/db";

export type QuestionPatch = Partial<
  Pick<
    QuestionRow,
    "text_type" | "question_text" | "image_url" | "choices" | "memo" | "time_limit_sec" | "use_score" | "double_score"
  >
>;

type Props = {
  question: QuestionRow;
  disabled: boolean;
  onChange: (patch: QuestionPatch) => void;
};

/** A4 우측: 문제·보기·정답·제한시간·점수·메모 입력(QZ-02~06) */
export function QuestionForm({ question: q, disabled, onChange }: Props) {
  const [typeError, setTypeError] = useState<string | null>(null);
  const limit = questionTextLimit(q.text_type);

  function switchType(next: "short" | "long") {
    setTypeError(null);
    if (next === q.text_type) return;
    if (next === "short" && q.question_text.length > SHORT_QUESTION_MAX) {
      setTypeError(ko.editor.cannotSwitchToShort);
      return;
    }
    if (next === "long" && q.image_url) {
      if (!window.confirm(ko.editor.confirmSwitchToLong)) return;
      onChange({ text_type: "long", image_url: null });
      return;
    }
    onChange({ text_type: next });
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6 p-5 disabled:opacity-70">
      {/* 문제 유형 */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{ko.editor.textType}</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={ko.editor.textType}>
          {(["short", "long"] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={q.text_type === type}
              onClick={() => switchType(type)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg border-2 px-2 ${
                q.text_type === type ? "border-brand-500 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600"
              }`}
            >
              <span className="font-semibold">{type === "short" ? ko.editor.textTypeShort : ko.editor.textTypeLong}</span>
              <span className="text-xs text-neutral-500">
                {type === "short" ? ko.editor.textTypeShortHint : ko.editor.textTypeLongHint}
              </span>
            </button>
          ))}
        </div>
        {typeError && <p className="text-sm text-red-600">{typeError}</p>}
      </div>

      {/* 문제 */}
      <label className="flex flex-col gap-2">
        <span className="flex justify-between text-sm font-semibold">
          {ko.editor.questionLabel}
          <span className="font-normal text-neutral-400">{ko.common.charCount(q.question_text.length, limit)}</span>
        </span>
        <textarea
          value={q.question_text}
          maxLength={limit}
          rows={q.text_type === "long" ? 6 : 3}
          placeholder={ko.editor.questionPlaceholder}
          onChange={(e) => onChange({ question_text: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
        />
      </label>

      {/* 문제 이미지(단문형만) */}
      {q.text_type === "short" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{ko.editor.questionImage}</span>
          {q.image_url ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL */}
              <img src={q.image_url} alt="" className="h-20 w-32 rounded-lg border border-neutral-200 object-contain" />
              <div className="flex gap-2">
                <ImageUploadButton kind="questions" label={ko.upload.replace} onUploaded={(url) => onChange({ image_url: url })} />
                <button
                  type="button"
                  onClick={() => onChange({ image_url: null })}
                  className="min-h-10 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50"
                >
                  {ko.upload.remove}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <ImageUploadButton kind="questions" onUploaded={(url) => onChange({ image_url: url })} />
            </div>
          )}
        </div>
      )}

      {/* 보기 */}
      <div className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">{ko.editor.choicesLabel}</span>
          <span className="text-xs text-neutral-500">{ko.editor.choicesHint}</span>
        </span>
        <ul className="flex flex-col gap-2">
          {q.choices.map((choice) => {
            const style = choiceStyle(choice.id);
            return (
              <li key={choice.id} className="flex items-center gap-2">
                <span
                  className={`flex h-11 w-12 shrink-0 items-center justify-center gap-0.5 rounded-lg text-sm font-extrabold text-white ${style.bg}`}
                  aria-hidden
                >
                  {style.shape}
                  {choice.id}
                </span>
                {choice.image_url ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL */}
                    <img src={choice.image_url} alt="" className="h-11 w-20 rounded border border-neutral-200 object-contain" />
                    <button
                      type="button"
                      onClick={() => onChange({ choices: updateChoice(q.choices, choice.id, { image_url: null }) })}
                      className="min-h-10 rounded px-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      {ko.upload.remove}
                    </button>
                  </div>
                ) : (
                  <input
                    value={choice.text}
                    maxLength={CHOICE_TEXT_MAX}
                    placeholder={ko.editor.choicePlaceholder(choice.id)}
                    aria-label={ko.editor.choicePlaceholder(choice.id)}
                    onChange={(e) => onChange({ choices: updateChoice(q.choices, choice.id, { text: e.target.value }) })}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 focus:border-brand-500 focus:outline-none"
                  />
                )}
                <label
                  className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 text-xs font-semibold ${
                    choice.is_correct ? "border-green-600 bg-green-50 text-green-700" : "border-neutral-300 text-neutral-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={choice.is_correct}
                    aria-label={ko.editor.correctFor(choice.id)}
                    onChange={(e) =>
                      onChange({ choices: updateChoice(q.choices, choice.id, { is_correct: e.target.checked }) })
                    }
                    className="size-4 accent-green-600"
                  />
                  {ko.editor.correct}
                </label>
                {!choice.image_url && (
                  <ImageUploadButton
                    kind="choices"
                    label={ko.editor.choiceImageIcon}
                    ariaLabel={ko.editor.choiceImage(choice.id)}
                    className="flex min-h-11 w-10 items-center justify-center rounded-lg border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                    onUploaded={(url) =>
                      onChange({ choices: updateChoice(q.choices, choice.id, { image_url: url, text: "" }) })
                    }
                  />
                )}
                {q.choices.length > MIN_CHOICES && (
                  <button
                    type="button"
                    onClick={() => onChange({ choices: removeChoice(q.choices, choice.id) })}
                    aria-label={ko.editor.removeChoice(choice.id)}
                    title={ko.editor.removeChoice(choice.id)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {q.choices.length < MAX_CHOICES && (
          <button
            type="button"
            onClick={() => onChange({ choices: addChoice(q.choices) })}
            className="min-h-10 self-start rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {ko.editor.addChoice}
          </button>
        )}
      </div>

      {/* 제한시간 */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{ko.editor.timeLimit}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ko.editor.timeLimit}>
          {TIME_LIMIT_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              role="radio"
              aria-checked={q.time_limit_sec === sec}
              onClick={() => onChange({ time_limit_sec: sec })}
              className={`min-h-10 min-w-14 rounded-lg border px-2 text-sm font-semibold ${
                q.time_limit_sec === sec ? "border-brand-500 bg-brand-500 text-white" : "border-neutral-300 text-neutral-600"
              }`}
            >
              {ko.editor.seconds(sec)}
            </button>
          ))}
        </div>
      </div>

      {/* 점수 */}
      <div className="flex flex-col gap-3">
        <Toggle
          label={ko.editor.useScore}
          hint={ko.editor.useScoreHint}
          checked={q.use_score}
          onChange={(v) => onChange(v ? { use_score: true } : { use_score: false, double_score: false })}
        />
        <Toggle
          label={ko.editor.doubleScore}
          checked={q.double_score}
          disabled={!q.use_score}
          onChange={(v) => onChange({ double_score: v })}
        />
      </div>

      {/* 메모 */}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          {ko.editor.memo} <span className="font-normal text-neutral-500">— {ko.editor.memoHint}</span>
        </span>
        <textarea
          value={q.memo}
          maxLength={1000}
          rows={3}
          placeholder={ko.editor.memoPlaceholder}
          onChange={(e) => onChange({ memo: e.target.value })}
          className="rounded-lg border border-neutral-300 bg-amber-50/40 px-3 py-2 focus:border-brand-500 focus:outline-none"
        />
      </label>
    </fieldset>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex min-h-11 items-center justify-between gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-neutral-300 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
