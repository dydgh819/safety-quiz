import { CHOICE_SHAPES } from "@/lib/quiz/constants";

/**
 * 보기 1~4의 색·도형. 색은 globals.css 의 --color-choice-1~4 토큰.
 * Tailwind 가 클래스를 찾을 수 있도록 전체 클래스 이름을 그대로 적는다.
 */
const BG = ["bg-choice-1", "bg-choice-2", "bg-choice-3", "bg-choice-4"] as const;
const TEXT = ["text-choice-1", "text-choice-2", "text-choice-3", "text-choice-4"] as const;

/** 보기 id(1~4) → 스타일 */
export function choiceStyle(id: number) {
  const i = Math.min(Math.max(id, 1), 4) - 1;
  return { bg: BG[i], text: TEXT[i], shape: CHOICE_SHAPES[i] };
}
