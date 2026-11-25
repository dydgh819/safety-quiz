import type { QuestionRow, QuestionSnapshot } from "@/types/db";

/**
 * 회차 시작 시 문제를 통째로 복사(PRD 5.1 questions_snapshot).
 * 나중에 Show 를 고쳐도 진행 중·지난 회차는 바뀌지 않는다. 메모는 진행에 쓰지 않으므로 넣지 않는다.
 */
export function toQuestionSnapshot(questions: readonly QuestionRow[]): QuestionSnapshot[] {
  return [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q, index) => ({
      id: q.id,
      order_index: index,
      type: q.type,
      text_type: q.text_type,
      question_text: q.question_text,
      image_url: q.image_url,
      choices: q.choices.map((c) => ({ ...c })),
      time_limit_sec: q.time_limit_sec,
      use_score: q.use_score,
      double_score: q.use_score && q.double_score,
    }));
}
