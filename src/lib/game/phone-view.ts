import type { PlayType, QuestionSnapshot } from "@/types/db";

import { correctChoiceIds } from "./scoring";

/**
 * 폰으로 보내는 문제(절대 규칙 3). 폰으로 가는 문제는 반드시 이 함수를 거친다.
 * - 정답(is_correct)·정답 보기 id 는 넣지 않는다.
 * - 현장 Play 는 문제·이미지를 보내지 않는다(프로젝터를 보며 푼다).
 * - 현장 Play + 답변 노출 Off 면 보기 텍스트·이미지도 보내지 않는다(블록 색·번호만).
 * - 복수정답 여부(multiple)는 보낸다(PRD 5.3 question_open: 복수정답이면 다중 선택 + 제출 버튼).
 */

export type PhoneChoice = { id: number; text: string | null; imageUrl: string | null };

export type PhoneQuestion = {
  index: number;
  total: number;
  textType: QuestionSnapshot["text_type"];
  questionText: string | null;
  imageUrl: string | null;
  choices: PhoneChoice[];
  timeLimitSec: number;
  multiple: boolean;
  doubleScore: boolean;
};

export function toPhoneQuestion(
  question: QuestionSnapshot,
  index: number,
  total: number,
  view: { playType: PlayType; showChoiceText: boolean },
): PhoneQuestion {
  const remote = view.playType === "remote";
  const choiceContent = remote || view.showChoiceText;
  return {
    index,
    total,
    textType: question.text_type,
    questionText: remote ? question.question_text : null,
    imageUrl: remote ? question.image_url : null,
    choices: question.choices.map((c) => ({
      id: c.id,
      text: choiceContent ? c.text : null,
      imageUrl: choiceContent ? c.image_url : null,
    })),
    timeLimitSec: question.time_limit_sec,
    multiple: correctChoiceIds(question.choices).length > 1,
    doubleScore: question.use_score && question.double_score,
  };
}
