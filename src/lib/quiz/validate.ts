import type { Choice, TextType } from "@/types/db";

import {
  CHOICE_TEXT_MAX,
  LONG_QUESTION_MAX,
  MAX_CHOICES,
  MIN_CHOICES,
  SHORT_QUESTION_MAX,
  TIME_LIMIT_OPTIONS,
} from "./constants";

/**
 * 문항 완성 여부 검증(QZ-08). 미완성 판정은 이 파일 한 곳에서만 한다.
 * 편집기(목록 경고·완성 버튼), 서버 Action(완성 처리), 3단계 엑셀 업로드가 모두 이 함수를 쓴다.
 */

/** 검증에 필요한 문항 필드 */
export type QuestionDraft = {
  text_type: TextType;
  question_text: string;
  image_url: string | null;
  choices: Choice[];
  time_limit_sec: number;
};

export type QuestionIssue =
  | "missingText" // 문제 없음
  | "textTooLong" // 단문형 120자 / 장문형 300자 초과
  | "longWithImage" // 장문형인데 이미지 있음
  | "tooFewChoices" // 보기 2개 미만
  | "tooManyChoices" // 보기 4개 초과
  | "emptyChoice" // 텍스트도 이미지도 없는 보기
  | "choiceTooLong" // 보기 텍스트 60자 초과
  | "noCorrect" // 정답 없음
  | "invalidTimeLimit"; // 허용되지 않은 제한시간

export function questionTextLimit(textType: TextType): number {
  return textType === "long" ? LONG_QUESTION_MAX : SHORT_QUESTION_MAX;
}

export function isChoiceEmpty(choice: Pick<Choice, "text" | "image_url">): boolean {
  return choice.text.trim() === "" && !choice.image_url;
}

/** 문제가 있으면 목록, 없으면 빈 배열 */
export function validateQuestion(q: QuestionDraft): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const text = q.question_text.trim();

  if (text === "") issues.push("missingText");
  if (q.question_text.length > questionTextLimit(q.text_type)) issues.push("textTooLong");
  if (q.text_type === "long" && q.image_url) issues.push("longWithImage");

  if (q.choices.length < MIN_CHOICES) issues.push("tooFewChoices");
  if (q.choices.length > MAX_CHOICES) issues.push("tooManyChoices");
  if (q.choices.some(isChoiceEmpty)) issues.push("emptyChoice");
  if (q.choices.some((c) => c.text.length > CHOICE_TEXT_MAX)) issues.push("choiceTooLong");
  if (!q.choices.some((c) => c.is_correct)) issues.push("noCorrect");

  if (!(TIME_LIMIT_OPTIONS as readonly number[]).includes(q.time_limit_sec)) issues.push("invalidTimeLimit");

  return issues;
}

export function isQuestionComplete(q: QuestionDraft): boolean {
  return validateQuestion(q).length === 0;
}

/** 첫 미완성 문항의 위치. 모두 완성이면 -1 */
export function findFirstIncomplete(questions: readonly QuestionDraft[]): number {
  return questions.findIndex((q) => !isQuestionComplete(q));
}

/** Show 완성 조건(QZ-09): 문항이 1개 이상이고 모두 완성 */
export function isShowComplete(questions: readonly QuestionDraft[]): boolean {
  return questions.length > 0 && findFirstIncomplete(questions) === -1;
}

/**
 * 아무것도 입력하지 않은 문항(새 Show 의 빈 1번 문항 등).
 * 엑셀·다른 Show 에서 문제를 가져올 때, 이런 문항 하나만 있으면 지우고 가져온다.
 */
export function isUntouchedQuestion(q: QuestionDraft & { memo?: string }): boolean {
  return (
    q.question_text.trim() === "" &&
    !q.image_url &&
    (q.memo ?? "").trim() === "" &&
    q.choices.every((c) => c.text.trim() === "" && !c.image_url && !c.is_correct)
  );
}
