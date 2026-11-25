import { ko } from "@/messages/ko";
import type { Choice, TextType } from "@/types/db";

import { choiceStyle } from "./choice-style";

export type StageChoice = Pick<Choice, "id" | "text" | "image_url"> & { is_correct?: boolean };

type Props = {
  questionNumber: number;
  totalQuestions: number;
  textType: TextType;
  questionText: string;
  imageUrl: string | null;
  choices: StageChoice[];
  timeLimitSec: number;
  doubleScore?: boolean;
  /** true 면 정답 ✓ 강조·오답 흐리게(결과 화면 P4, 미리보기의 '정답 보기') */
  revealCorrect?: boolean;
  /** 진행 중 남은 초(있으면 원 안에 제한시간 대신 표시) */
  remainingSec?: number | null;
  /** 남은 시간 막대 비율 1 → 0 (있으면 상단에 막대 표시, P3) */
  timeRatio?: number;
  /** 결과 화면: 보기별 선택 인원(P4) */
  counts?: Record<number, number>;
  /** 상단 오른쪽 보조 표시(예: 응답 n/N) */
  statusLabel?: string;
};

/**
 * 발표 화면의 문제 무대(16:9). 편집 미리보기(QZ-07)·미리보기(SH-05)·5단계 발표 화면(P3·P4)이 함께 쓴다.
 * 글자 크기는 컨테이너 폭 기준(cqw)이라 작은 미리보기와 1920×1080 프로젝터에서 같은 비율로 보인다.
 * 훅이 없어 서버·클라이언트 컴포넌트 어디서나 쓸 수 있다.
 */
export function QuestionStage({
  questionNumber,
  totalQuestions,
  textType,
  questionText,
  imageUrl,
  choices,
  timeLimitSec,
  doubleScore,
  revealCorrect,
  remainingSec,
  timeRatio,
  counts,
  statusLabel,
}: Props) {
  const hasImage = !!imageUrl && textType === "short";
  const text = questionText.trim();
  const maxCount = counts ? Math.max(1, ...Object.values(counts)) : 1;

  return (
    <div className="@container w-full">
      <div className="relative flex aspect-video w-full flex-col gap-[1.6cqw] overflow-hidden rounded-[1cqw] bg-gradient-to-br from-brand-50 to-brand-100 p-[2.2cqw] text-neutral-900">
        {timeRatio !== undefined && (
          <div className="absolute inset-x-0 top-0 h-[0.8cqw] bg-white/60" aria-hidden>
            <div
              className={`h-full transition-[width] duration-200 ease-linear ${timeRatio < 0.25 ? "bg-red-500" : "bg-brand-500"}`}
              style={{ width: `${timeRatio * 100}%` }}
            />
          </div>
        )}
        {/* 상단: 문제 번호 · 응답 현황 · 점수 2배 · 제한시간 */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/90 px-[1.4cqw] py-[0.4cqw] text-[1.8cqw] font-bold text-brand-700">
            {ko.stage.questionOf(questionNumber, totalQuestions)}
          </span>
          <div className="flex items-center gap-[1cqw]">
            {statusLabel && (
              <span className="rounded-full bg-white/90 px-[1.4cqw] py-[0.4cqw] text-[1.8cqw] font-bold text-neutral-700" aria-live="polite">
                {statusLabel}
              </span>
            )}
            {doubleScore && (
              <span className="rounded-full bg-brand-600 px-[1.2cqw] py-[0.4cqw] text-[1.6cqw] font-bold text-white">
                {ko.stage.doubleScore}
              </span>
            )}
            <span className="flex size-[6cqw] items-center justify-center rounded-full bg-white text-[2.2cqw] font-extrabold text-brand-700 shadow-sm">
              {remainingSec ?? timeLimitSec}
            </span>
          </div>
        </div>

        {/* 문제 */}
        <div className="flex min-h-0 flex-1 gap-[2cqw]">
          <div
            className={`flex min-w-0 flex-1 items-center justify-center rounded-[0.8cqw] bg-white px-[2.5cqw] py-[1.5cqw] text-center font-bold break-keep shadow-sm ${
              textType === "long" ? "text-[2.4cqw] leading-snug" : "text-[3.4cqw] leading-tight"
            } ${text ? "" : "text-neutral-300"}`}
          >
            {text || ko.stage.emptyQuestion}
          </div>
          {hasImage && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL, 업로드 시 이미 축소됨
            <img src={imageUrl} alt="" className="h-full max-w-[38%] rounded-[0.8cqw] bg-white object-contain shadow-sm" />
          )}
        </div>

        {/* 보기 블록 */}
        <div className={`grid gap-[1.2cqw] ${choices.length <= 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`}>
          {choices.map((choice) => {
            const style = choiceStyle(choice.id);
            const dimmed = revealCorrect && !choice.is_correct;
            const count = counts?.[choice.id];
            return (
              <div
                key={choice.id}
                aria-label={ko.stage.choiceAria(choice.id)}
                className={`relative flex h-[8.5cqw] items-center gap-[1.2cqw] overflow-hidden rounded-[0.8cqw] px-[1.5cqw] text-white shadow-sm transition-opacity ${style.bg} ${
                  dimmed ? "opacity-30" : ""
                }`}
              >
                {count !== undefined && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-black/20 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                )}
                <span className="relative flex shrink-0 items-center gap-[0.6cqw] text-[2.6cqw] font-extrabold">
                  <span aria-hidden>{style.shape}</span>
                  {choice.id}
                </span>
                {choice.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase 공개 URL
                  <img src={choice.image_url} alt="" className="relative h-[7cqw] rounded-[0.4cqw] bg-white object-contain" />
                ) : (
                  <span className="relative min-w-0 flex-1 truncate text-[2.2cqw] font-bold">{choice.text}</span>
                )}
                {count !== undefined && (
                  <span className="relative ml-auto shrink-0 text-[2.6cqw] font-extrabold tabular-nums">{ko.stage.peopleCount(count)}</span>
                )}
                {revealCorrect && choice.is_correct && (
                  <span className={`relative text-[3cqw] font-extrabold ${count === undefined ? "ml-auto" : ""}`} aria-label={ko.preview.showAnswer}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
