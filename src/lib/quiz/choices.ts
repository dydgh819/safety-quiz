import type { Choice } from "@/types/db";

import { MAX_CHOICES, MIN_CHOICES } from "./constants";

/**
 * 보기 목록 다루기(순수 함수). 보기 id 는 항상 1..n 연속 정수로 유지한다
 * (발표 화면 번호·색·도형과 answers.choice_ids 가 이 id 를 쓴다).
 */

/** 새 문항의 기본 보기: 빈 보기 4개(안전교육 퀴즈는 대부분 4지선다) */
export function createEmptyChoices(count: number = MAX_CHOICES): Choice[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, text: "", image_url: null, is_correct: false }));
}

/** 순서대로 id 를 1..n 으로 다시 매긴다 */
export function renumberChoices(choices: readonly Choice[]): Choice[] {
  return choices.map((c, i) => ({ ...c, id: i + 1 }));
}

export function addChoice(choices: readonly Choice[]): Choice[] {
  if (choices.length >= MAX_CHOICES) return [...choices];
  return renumberChoices([...choices, { id: 0, text: "", image_url: null, is_correct: false }]);
}

export function removeChoice(choices: readonly Choice[], id: number): Choice[] {
  if (choices.length <= MIN_CHOICES) return [...choices];
  return renumberChoices(choices.filter((c) => c.id !== id));
}

export function updateChoice(choices: readonly Choice[], id: number, patch: Partial<Omit<Choice, "id">>): Choice[] {
  return choices.map((c) => (c.id === id ? { ...c, ...patch } : c));
}
