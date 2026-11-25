import type { QuestionSnapshot } from "@/types/db";

import { correctChoiceIds } from "./scoring";

/** 문제별 결과(P4, PL-06): 보기별 선택 인원, 정답 보기, 응답 인원 */
export type QuestionResult = {
  correctIds: number[];
  /** 보기 id → 고른 사람 수(복수 선택은 고른 보기마다 1명씩) */
  counts: Record<number, number>;
  answeredCount: number;
  correctCount: number;
};

export function computeQuestionResult(
  question: Pick<QuestionSnapshot, "choices">,
  answers: readonly { choiceIds: readonly number[]; isCorrect: boolean }[],
): QuestionResult {
  const counts: Record<number, number> = {};
  for (const c of question.choices) counts[c.id] = 0;
  for (const a of answers) {
    for (const id of new Set(a.choiceIds)) if (id in counts) counts[id] += 1;
  }
  return {
    correctIds: correctChoiceIds(question.choices),
    counts,
    answeredCount: answers.length,
    correctCount: answers.filter((a) => a.isCorrect).length,
  };
}
