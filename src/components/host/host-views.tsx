"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { QuestionStage } from "@/components/stage/question-stage";
import { remainingRatio, secondsLeft } from "@/lib/client/use-server-clock";
import type { LeaderboardRow } from "@/lib/game/scoring";
import type { HostView } from "@/lib/game/views";
import { ko } from "@/messages/ko";

/**
 * 발표 화면 단계별 화면(P2~P7). 1920×1080 프로젝터 기준의 큰 글자.
 * 진행 제어(다음·자동 진행)는 host-screen.tsx 가 맡고, 여기는 그리기만 한다.
 */

/** 상단 공통 띠: PIN(지각자용), 진행률 */
export function HostTopBar({ view }: { view: HostView }) {
  const done = view.state === "final" || view.state === "ended" ? view.total : (view.qIndex ?? 0) + (view.state === "countdown" ? 0 : 1);
  return (
    <div className="flex items-center gap-6 px-8 pt-4 text-lg font-semibold text-neutral-600">
      <span className="truncate">{view.eduTitle}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70" aria-label={ko.host.progressLabel(done, view.total)}>
        <div className="h-full bg-brand-500 transition-[width] duration-500" style={{ width: `${(done / Math.max(1, view.total)) * 100}%` }} />
      </div>
      <span className="shrink-0 rounded-full bg-white px-4 py-1 text-xl font-bold tabular-nums">{ko.host.smallPin(view.pin)}</span>
    </div>
  );
}

/** P2 예고(3초) */
export function CountdownView({ view, serverNow }: { view: HostView; serverNow: number }) {
  const left = secondsLeft(view.qEndsAt, serverNow);
  const q = view.question;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center">
      <p className="text-5xl font-extrabold text-brand-700">{ko.host.countdownTitle((view.qIndex ?? 0) + 1, view.total)}</p>
      {q && <p className="max-w-6xl text-6xl leading-tight font-bold break-keep">{q.question_text}</p>}
      <p className="text-[10rem] leading-none font-extrabold text-brand-500 tabular-nums" aria-live="polite">
        {left !== null && left > 0 ? left : ko.host.getReady}
      </p>
    </div>
  );
}

/** P3 문제 */
export function QuestionView({ view, serverNow }: { view: HostView; serverNow: number }) {
  const q = view.question;
  if (!q) return null;
  const left = secondsLeft(view.qEndsAt, serverNow);
  const progress = view.progress;
  return (
    <div className="flex flex-1 items-center justify-center px-8 pb-4">
      <div className="w-full max-w-[min(100%,calc((100dvh-9rem)*16/9))]">
        <QuestionStage
          questionNumber={(view.qIndex ?? 0) + 1}
          totalQuestions={view.total}
          textType={q.text_type}
          questionText={q.question_text}
          imageUrl={q.image_url}
          choices={q.choices.map(({ id, text, image_url }) => ({ id, text, image_url }))}
          timeLimitSec={q.time_limit_sec}
          doubleScore={q.use_score && q.double_score}
          remainingSec={left}
          timeRatio={remainingRatio(view.qStartedAt, view.qEndsAt, serverNow)}
          statusLabel={progress ? ko.host.answered(progress.answered, progress.active) : undefined}
        />
      </div>
    </div>
  );
}

/** P4 결과: 보기별 인원, 정답 ✓, 오답 흐리게 */
export function RevealView({ view }: { view: HostView }) {
  const q = view.question;
  const r = view.result;
  if (!q || !r) return null;
  return (
    <div className="flex flex-1 items-center justify-center px-8 pb-4">
      <div className="w-full max-w-[min(100%,calc((100dvh-9rem)*16/9))]">
        <QuestionStage
          questionNumber={(view.qIndex ?? 0) + 1}
          totalQuestions={view.total}
          textType={q.text_type}
          questionText={q.question_text}
          imageUrl={q.image_url}
          choices={q.choices}
          timeLimitSec={q.time_limit_sec}
          revealCorrect
          counts={r.counts}
          statusLabel={`${ko.host.answeredCount(r.answeredCount)} · ${ko.host.correctRate(r.answeredCount ? r.correctCount / r.answeredCount : 0)}`}
        />
      </div>
    </div>
  );
}

function RankChange({ change }: { change: number }) {
  if (change > 0) return <span className="text-green-600">{ko.host.rankUp(change)}</span>;
  if (change < 0) return <span className="text-red-500">{ko.host.rankDown(-change)}</span>;
  return <span className="text-neutral-400">{ko.host.rankSame}</span>;
}

/** P5 문제별 랭킹: 누적 Top 10, 이번 문제 점수, 순위 변동 */
export function LeaderboardView({ view }: { view: HostView }) {
  const rows = view.leaderboard ?? [];
  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-12 py-6">
      <h2 className="text-4xl font-extrabold text-brand-700">{ko.host.leaderboardTitle((view.qIndex ?? 0) + 1, view.total)}</h2>
      {rows.length === 0 ? (
        <p className="text-3xl text-neutral-500">{ko.host.noRanking}</p>
      ) : (
        <ol className="flex w-full max-w-5xl flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.participantId}
              className="flex items-center gap-6 rounded-2xl bg-white px-8 py-3 text-3xl shadow-sm motion-safe:animate-[fadeIn_0.4s_ease-out]"
            >
              <span className="w-20 font-extrabold text-brand-700 tabular-nums">{ko.host.rankLabel(row.rank)}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{row.nickname}</span>
              <span className="w-24 text-right text-2xl font-bold tabular-nums">
                <RankChange change={row.change} />
              </span>
              <span className="w-32 text-right text-2xl font-semibold text-green-700 tabular-nums">
                {row.gained > 0 ? ko.host.gained(row.gained) : ""}
              </span>
              <span className="w-48 text-right font-extrabold tabular-nums">{ko.host.points(row.totalScore)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** 시상대 공개 단계: 0 없음 → 1 3위 → 2 2위 → 3 1위 → 4 4~10위 */
function usePodiumStep(): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = reduced
      ? [setTimeout(() => setStep(4), 0)]
      : [1, 2, 3, 4].map((s) => setTimeout(() => setStep(s), s * 1500));
    return () => timers.forEach(clearTimeout);
  }, []);
  return step;
}

function PodiumColumn({ row, place, visible }: { row: LeaderboardRow | undefined; place: 1 | 2 | 3; visible: boolean }) {
  const height = place === 1 ? "h-80" : place === 2 ? "h-60" : "h-44";
  const color = place === 1 ? "bg-amber-400" : place === 2 ? "bg-neutral-300" : "bg-orange-300";
  return (
    <div className="flex w-72 flex-col items-center gap-3">
      <div className={`flex flex-col items-center gap-1 transition-all duration-700 ${visible && row ? "opacity-100" : "translate-y-4 opacity-0"}`}>
        <span className="max-w-72 truncate text-4xl font-extrabold">{row?.nickname}</span>
        <span className="text-2xl font-bold text-neutral-600 tabular-nums">{row ? ko.host.points(row.totalScore) : ""}</span>
      </div>
      <div className={`flex w-full items-start justify-center rounded-t-2xl pt-4 text-6xl font-extrabold text-white ${height} ${color}`}>
        {place}
      </div>
    </div>
  );
}

/** P6 최종 랭킹: 3위 → 2위 → 1위 시상대 공개 후 4~10위 */
export function FinalView({ view }: { view: HostView }) {
  const rows = view.leaderboard ?? [];
  const step = usePodiumStep();
  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-12 py-6">
      <h2 className="text-5xl font-extrabold text-brand-700">{ko.host.finalTitle}</h2>
      {rows.length === 0 ? (
        <p className="text-3xl text-neutral-500">{ko.host.noRanking}</p>
      ) : (
        <>
          <div className="flex items-end gap-6">
            <PodiumColumn row={rows[1]} place={2} visible={step >= 2} />
            <PodiumColumn row={rows[0]} place={1} visible={step >= 3} />
            <PodiumColumn row={rows[2]} place={3} visible={step >= 1} />
          </div>
          {rows.length > 3 && (
            <ol className={`grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-2 transition-opacity duration-700 ${step >= 4 ? "opacity-100" : "opacity-0"}`}>
              {rows.slice(3).map((row) => (
                <li key={row.participantId} className="flex items-center gap-4 rounded-xl bg-white px-6 py-2 text-2xl shadow-sm">
                  <span className="w-16 font-extrabold text-brand-700">{ko.host.rankLabel(row.rank)}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{row.nickname}</span>
                  <span className="font-bold tabular-nums">{ko.host.points(row.totalScore)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/** P7 종료 */
export function EndedView({ view }: { view: HostView }) {
  const s = view.summary;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <p className="text-7xl font-extrabold text-brand-700">{ko.host.endedTitle}</p>
      {s && (
        <div className="flex gap-10 text-3xl font-bold text-neutral-700">
          <span>{ko.host.endedParticipants(s.participantCount)}</span>
          <span>{ko.host.endedAverage(s.averageScore)}</span>
          <span>{ko.host.endedCorrectRate(s.averageCorrectRate)}</span>
        </div>
      )}
      <Link
        href="/reports"
        title={ko.host.reportLater}
        className="min-h-14 rounded-2xl bg-brand-500 px-10 py-4 text-2xl font-bold text-white hover:bg-brand-600"
      >
        {ko.host.seeReport}
      </Link>
    </div>
  );
}
