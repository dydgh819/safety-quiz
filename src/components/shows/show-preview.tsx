"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnswerBlocks } from "@/components/mobile/answer-blocks";
import { QuestionStage } from "@/components/stage/question-stage";
import { isQuestionComplete } from "@/lib/quiz/validate";
import { ko } from "@/messages/ko";
import type { QuestionRow, ShowRow } from "@/types/db";

/** SH-05 미리보기: 발표 화면 + 휴대폰(현장 Play 블록형) 나란히, 이전/다음 */
export function ShowPreview({ show, questions }: { show: ShowRow; questions: QuestionRow[] }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showChoiceText, setShowChoiceText] = useState(false);

  const total = questions.length;
  const q = questions[Math.min(index, total - 1)];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (!q) return null;

  const texts = Object.fromEntries(q.choices.map((c) => [c.id, c.text]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          {ko.preview.title} · {show.title}
        </h1>
        <Link
          href={`/shows/${show.id}/edit`}
          className="ml-auto min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          {ko.preview.edit}
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-500">{ko.preview.presenter}</h2>
          <QuestionStage
            questionNumber={index + 1}
            totalQuestions={total}
            textType={q.text_type}
            questionText={q.question_text}
            imageUrl={q.image_url}
            choices={q.choices}
            timeLimitSec={q.time_limit_sec}
            doubleScore={q.use_score && q.double_score}
            revealCorrect={showAnswer}
          />
        </section>

        <section className="flex shrink-0 flex-col items-center gap-2">
          <h2 className="self-start text-sm font-semibold text-neutral-500">{ko.preview.phone}</h2>
          {/* 360×640 비율의 폰 틀 */}
          <div className="flex h-[34rem] w-[19rem] flex-col gap-3 rounded-[2rem] border-8 border-neutral-800 bg-white p-3 shadow-lg">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
              <span>{ko.stage.questionOf(index + 1, total)}</span>
              <span>{ko.stage.seconds(q.time_limit_sec)}</span>
            </div>
            <div className="min-h-0 flex-1">
              <AnswerBlocks choiceIds={q.choices.map((c) => c.id)} texts={showChoiceText ? texts : undefined} />
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="min-h-11 rounded-lg border border-neutral-300 px-4 font-semibold disabled:opacity-40"
        >
          {ko.preview.prev}
        </button>
        <span className="min-w-24 text-center font-semibold">{ko.preview.position(index + 1, total)}</span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
          disabled={index >= total - 1}
          className="min-h-11 rounded-lg border border-neutral-300 px-4 font-semibold disabled:opacity-40"
        >
          {ko.preview.next}
        </button>
        {!isQuestionComplete(q) && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
            ⚠ {ko.preview.incompleteBadge}
          </span>
        )}
        <span className="text-xs text-neutral-400">{ko.preview.keyboardHint}</span>
        <div className="ml-auto flex flex-wrap gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} className="size-4" />
            {ko.preview.showAnswer}
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showChoiceText}
              onChange={(e) => setShowChoiceText(e.target.checked)}
              className="size-4"
            />
            {ko.preview.showChoiceText}
          </label>
        </div>
      </div>
    </div>
  );
}
