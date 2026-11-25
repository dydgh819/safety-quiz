"use client";

import { useState } from "react";

import { choiceStyle } from "@/components/stage/choice-style";
import type { PhoneStateResponse } from "@/lib/api/play-api";
import { loadCredentials } from "@/lib/client/participant-storage";
import { submitAnswer, type ClientErrorCode } from "@/lib/client/play-client";
import { secondsLeft, useTick } from "@/lib/client/use-server-clock";
import type { PhoneChoice, PhoneQuestion } from "@/lib/game/phone-view";
import { ko } from "@/messages/ko";

export type PhoneState = Extract<PhoneStateResponse, { ok: true }>;

type Props = {
  sessionId: string;
  data: PhoneState;
  /** 서버 − 기기 시각 차이(표시용) */
  offset: number;
  onRefresh: () => void;
};

/** 피교육자 진행 화면(MB-01): 서버 상태에 따라 M3 대기 → M4 예고 → M5 답 선택 → M6 제출 완료 → M7 결과 → M8 최종 */
export function GameView({ sessionId, data, offset, onRefresh }: Props) {
  const g = data.game;
  const tick = useTick(250);
  const serverNow = tick === 0 ? 0 : tick + offset;
  const inQuiz = g.state === "countdown" || g.state === "question" || g.state === "reveal" || g.state === "leaderboard";

  return (
    <div className="flex flex-1 flex-col">
      {inQuiz && (
        <div className="flex items-center justify-between bg-white/80 px-4 py-2 text-sm font-bold">
          <span className="tabular-nums">{ko.play.topQuestion((g.qIndex ?? 0) + 1, g.total)}</span>
          <span className="truncate px-2 text-neutral-500">{data.me.nickname}</span>
          <span className="tabular-nums text-brand-700">{ko.play.topScore(g.me.totalScore)}</span>
        </div>
      )}
      {g.state === "lobby" && <Waiting data={data} />}
      {g.state === "countdown" && <Countdown qNumber={(g.qIndex ?? 0) + 1} left={secondsLeft(g.qEndsAt, serverNow)} />}
      {g.state === "question" && g.question && (
        <QuestionPhase
          key={g.qIndex}
          sessionId={sessionId}
          question={g.question}
          myAnswer={g.myAnswer?.choiceIds ?? null}
          useSubmitButton={g.useSubmitButton}
          left={secondsLeft(g.qEndsAt, serverNow)}
          onRefresh={onRefresh}
        />
      )}
      {(g.state === "reveal" || g.state === "leaderboard") && <Result data={data} />}
      {(g.state === "final" || g.state === "ended") && <Final data={data} />}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-8">
      <div className={`flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-sm ${className}`}>
        {children}
      </div>
    </div>
  );
}

/** M3 대기 */
function Waiting({ data }: { data: PhoneState }) {
  return (
    <Panel>
      <p className="text-sm font-semibold break-keep text-neutral-500">{data.session.eduTitle}</p>
      <span className="flex size-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700" aria-hidden>
        ✓
      </span>
      <p className="text-lg font-bold text-green-700">{ko.play.joined}</p>
      <p className="text-3xl font-extrabold break-all">{data.me.nickname}</p>
      <p className="text-neutral-600" aria-live="polite">
        {ko.play.participantCount(data.session.participantCount)}
      </p>
      <p className="font-medium break-keep">{ko.play.waiting}</p>
    </Panel>
  );
}

/** M4 예고 */
function Countdown({ qNumber, left }: { qNumber: number; left: number | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-4xl font-extrabold text-brand-700">{ko.play.countdownTitle(qNumber)}</p>
      <p className="text-8xl font-extrabold text-brand-500 tabular-nums" aria-live="polite">
        {left !== null && left > 0 ? left : ko.play.getReady}
      </p>
    </div>
  );
}

function ChoiceMark({ id, large }: { id: number; large?: boolean }) {
  const style = choiceStyle(id);
  return (
    <span className={`flex items-center gap-1 font-extrabold ${large ? "text-4xl" : "text-xl"}`}>
      <span aria-hidden>{style.shape}</span>
      {id}
    </span>
  );
}

/** M5 답 선택 → M6 제출 완료 */
function QuestionPhase({
  sessionId,
  question,
  myAnswer,
  useSubmitButton,
  left,
  onRefresh,
}: {
  sessionId: string;
  question: PhoneQuestion;
  myAnswer: number[] | null;
  useSubmitButton: boolean;
  left: number | null;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [sent, setSent] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 복수정답 문항은 항상 제출 버튼(PRD 3.5). 제출 버튼 옵션이 켜져 있으면 단일 정답도 제출 버튼
  const needsSubmit = question.multiple || useSubmitButton;
  const submitted = myAnswer ?? sent;
  const timeUp = left === 0;

  async function send(choiceIds: number[]) {
    const credentials = loadCredentials(sessionId);
    if (!credentials || busy) return;
    setBusy(true);
    setError(null);
    const result = await submitAnswer(sessionId, credentials, { questionIndex: question.index, choiceIds });
    setBusy(false);
    if (result.ok) {
      setSent(choiceIds);
      onRefresh();
      return;
    }
    setError(ko.play.errors[result.error as ClientErrorCode]);
    if (result.error === "closed" || result.error === "late") onRefresh();
  }

  function tap(id: number) {
    if (submitted || busy || timeUp) return;
    if (!needsSubmit) {
      void send([id]);
      return;
    }
    if (question.multiple) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].sort((a, b) => a - b)));
    } else {
      setSelected([id]);
    }
  }

  if (submitted) {
    return (
      <Panel>
        <p className="text-2xl font-extrabold text-green-700">{ko.play.submitted}</p>
        <p className="text-sm font-semibold text-neutral-500">{ko.play.myChoice}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {submitted.map((id) => (
            <span key={id} className={`rounded-2xl px-6 py-4 text-white ${choiceStyle(id).bg}`}>
              <ChoiceMark id={id} large />
            </span>
          ))}
        </div>
        <p className="text-neutral-600">{ko.play.waitingOthers}</p>
      </Panel>
    );
  }

  const remote = question.questionText !== null;
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex items-center justify-between px-1 text-sm font-semibold text-neutral-600">
        <span>{question.multiple ? ko.play.multipleHint : needsSubmit ? ko.play.selectThenSubmit : remote ? "" : ko.play.lookAtScreen}</span>
        <span className={`text-lg font-extrabold tabular-nums ${left !== null && left <= 5 ? "text-red-600" : "text-brand-700"}`}>
          {left !== null ? ko.play.secondsLeft(left) : ""}
        </span>
      </div>

      {remote && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className={`font-bold break-keep ${question.textType === "long" ? "text-base" : "text-lg"}`}>{question.questionText}</p>
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL
            <img src={question.imageUrl} alt="" className="mt-3 max-h-48 w-full rounded-lg object-contain" />
          )}
        </div>
      )}

      {timeUp ? (
        <Panel>
          <p className="text-xl font-bold text-neutral-600">{ko.play.timeUp}</p>
        </Panel>
      ) : (
        <div
          className={`grid flex-1 gap-3 ${
            remote ? "grid-cols-1 content-start" : question.choices.length <= 2 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {question.choices.map((choice) => (
            <ChoiceButton
              key={choice.id}
              choice={choice}
              remote={remote}
              selected={selected.includes(choice.id)}
              disabled={busy}
              onTap={() => tap(choice.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {needsSubmit && !timeUp && (
        <button
          type="button"
          disabled={selected.length === 0 || busy}
          onClick={() => void send(selected)}
          className="min-h-14 rounded-2xl bg-neutral-900 text-xl font-bold text-white disabled:opacity-30"
        >
          {busy ? ko.play.submitting : ko.play.submit}
        </button>
      )}
    </div>
  );
}

/** 보기 버튼: 현장 Play 는 화면을 채우는 색 블록(MB-02), 원격 Play 는 텍스트 목록 */
function ChoiceButton({
  choice,
  remote,
  selected,
  disabled,
  onTap,
}: {
  choice: PhoneChoice;
  remote: boolean;
  selected: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  const style = choiceStyle(choice.id);
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ko.stage.choiceAria(choice.id)}
      className={`flex rounded-2xl text-white shadow-sm transition active:scale-[0.98] ${style.bg} ${
        remote ? "min-h-16 items-center gap-3 px-4 py-3 text-left" : "min-h-24 flex-col items-center justify-center gap-2 p-3"
      } ${selected ? "ring-4 ring-neutral-900 ring-offset-2" : ""}`}
    >
      <ChoiceMark id={choice.id} large={!remote} />
      {choice.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL
        <img src={choice.imageUrl} alt="" className="max-h-20 rounded bg-white object-contain" />
      ) : (
        choice.text && <span className={`font-semibold break-keep ${remote ? "text-base" : "line-clamp-3 text-center text-sm"}`}>{choice.text}</span>
      )}
      {selected && <span className="ml-auto text-2xl font-extrabold">✓</span>}
    </button>
  );
}

/** M7 정답/오답(+ 랭킹 발표 중) */
function Result({ data }: { data: PhoneState }) {
  const g = data.game;
  const r = g.result;
  const tone =
    r?.isCorrect === true ? "bg-green-600" : r?.isCorrect === false ? "bg-red-600" : "bg-neutral-500";
  const label = r?.isCorrect === true ? ko.play.correct : r?.isCorrect === false ? ko.play.wrong : ko.play.noAnswer;
  return (
    <div className="flex flex-1 flex-col">
      <div className={`flex flex-col items-center gap-2 px-5 py-8 text-white ${tone}`}>
        <p className="text-5xl font-extrabold">{label}</p>
        {r && r.gained > 0 && <p className="text-3xl font-bold tabular-nums">{ko.play.gained(r.gained)}</p>}
        {r && (
          <p className="mt-2 flex items-center gap-2 text-base font-semibold opacity-90">
            {r.correctIds.map((id) => (
              <ChoiceMark key={id} id={id} />
            ))}
          </p>
        )}
      </div>
      <Panel>
        <p className="text-4xl font-extrabold text-brand-700 tabular-nums">{ko.play.rank(g.me.rank, g.me.participantCount)}</p>
        <p className="text-xl font-bold tabular-nums">{ko.play.totalScore(g.me.totalScore)}</p>
        <p className="text-neutral-500">{ko.play.nextSoon}</p>
      </Panel>
    </div>
  );
}

/** M8 최종 */
function Final({ data }: { data: PhoneState }) {
  const g = data.game;
  return (
    <Panel>
      <p className="text-lg font-bold text-neutral-500">{ko.play.finalTitle}</p>
      <p className="text-2xl font-extrabold break-all">{data.me.nickname}</p>
      <div>
        <p className="text-sm text-neutral-500">{ko.play.finalOf(g.me.participantCount)}</p>
        <p className="text-6xl font-extrabold text-brand-700 tabular-nums">{ko.play.finalRank(g.me.rank)}</p>
      </div>
      <div className="flex gap-6 text-xl font-bold tabular-nums">
        <span>{ko.play.finalScore(g.me.totalScore)}</span>
        <span>{ko.play.finalCorrect(g.me.correctCount, g.total)}</span>
      </div>
      <p className="font-medium break-keep text-green-700">{ko.play.thanks}</p>
    </Panel>
  );
}
