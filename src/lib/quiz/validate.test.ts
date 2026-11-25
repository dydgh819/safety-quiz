import { describe, expect, it } from "vitest";

import type { Choice } from "@/types/db";

import {
  findFirstIncomplete,
  isQuestionComplete,
  isShowComplete,
  isUntouchedQuestion,
  validateQuestion,
  type QuestionDraft,
} from "./validate";

function choice(id: number, text: string, isCorrect = false, imageUrl: string | null = null): Choice {
  return { id, text, image_url: imageUrl, is_correct: isCorrect };
}

function valid(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return {
    text_type: "short",
    question_text: "안전모 턱끈은 어떻게 매야 하나요?",
    image_url: null,
    choices: [choice(1, "느슨하게"), choice(2, "단단히", true), choice(3, "안 맨다"), choice(4, "상관없다")],
    time_limit_sec: 20,
    ...overrides,
  };
}

describe("validateQuestion", () => {
  it("완성된 문항은 문제 없음", () => {
    expect(validateQuestion(valid())).toEqual([]);
    expect(isQuestionComplete(valid())).toBe(true);
  });

  it("문제가 비었거나 공백뿐이면 missingText", () => {
    expect(validateQuestion(valid({ question_text: "" }))).toContain("missingText");
    expect(validateQuestion(valid({ question_text: "   " }))).toContain("missingText");
  });

  it("단문형 120자 경계", () => {
    expect(validateQuestion(valid({ question_text: "가".repeat(120) }))).toEqual([]);
    expect(validateQuestion(valid({ question_text: "가".repeat(121) }))).toContain("textTooLong");
  });

  it("장문형 300자 경계", () => {
    expect(validateQuestion(valid({ text_type: "long", question_text: "가".repeat(300) }))).toEqual([]);
    expect(validateQuestion(valid({ text_type: "long", question_text: "가".repeat(301) }))).toContain("textTooLong");
  });

  it("장문형은 이미지 불가, 단문형은 가능", () => {
    expect(validateQuestion(valid({ text_type: "long", image_url: "https://x/a.webp" }))).toContain("longWithImage");
    expect(validateQuestion(valid({ text_type: "short", image_url: "https://x/a.webp" }))).toEqual([]);
  });

  it("보기 2개 미만이면 tooFewChoices, 2개는 허용", () => {
    expect(validateQuestion(valid({ choices: [choice(1, "예", true)] }))).toContain("tooFewChoices");
    expect(validateQuestion(valid({ choices: [choice(1, "예", true), choice(2, "아니오")] }))).toEqual([]);
  });

  it("보기 5개 이상이면 tooManyChoices", () => {
    const five = [1, 2, 3, 4, 5].map((i) => choice(i, `보기${i}`, i === 1));
    expect(validateQuestion(valid({ choices: five }))).toContain("tooManyChoices");
  });

  it("텍스트도 이미지도 없는 보기는 emptyChoice, 이미지만 있으면 통과", () => {
    expect(validateQuestion(valid({ choices: [choice(1, "예", true), choice(2, " ")] }))).toContain("emptyChoice");
    expect(
      validateQuestion(valid({ choices: [choice(1, "예", true), choice(2, "", false, "https://x/b.webp")] })),
    ).toEqual([]);
  });

  it("보기 텍스트 60자 경계", () => {
    expect(validateQuestion(valid({ choices: [choice(1, "가".repeat(60), true), choice(2, "나")] }))).toEqual([]);
    expect(validateQuestion(valid({ choices: [choice(1, "가".repeat(61), true), choice(2, "나")] }))).toContain(
      "choiceTooLong",
    );
  });

  it("정답이 없으면 noCorrect, 복수정답은 허용", () => {
    expect(validateQuestion(valid({ choices: [choice(1, "a"), choice(2, "b")] }))).toContain("noCorrect");
    expect(validateQuestion(valid({ choices: [choice(1, "a", true), choice(2, "b", true)] }))).toEqual([]);
  });

  it("허용되지 않은 제한시간은 invalidTimeLimit", () => {
    expect(validateQuestion(valid({ time_limit_sec: 15 }))).toContain("invalidTimeLimit");
    expect(validateQuestion(valid({ time_limit_sec: 120 }))).toEqual([]);
  });

  it("여러 문제가 동시에 보고된다", () => {
    expect(validateQuestion(valid({ question_text: "", choices: [] }))).toEqual(["missingText", "tooFewChoices", "noCorrect"]);
  });
});

describe("Show 완성 판정", () => {
  it("문항이 없으면 미완성", () => {
    expect(isShowComplete([])).toBe(false);
  });

  it("모두 완성이면 완성", () => {
    expect(isShowComplete([valid(), valid()])).toBe(true);
    expect(findFirstIncomplete([valid(), valid()])).toBe(-1);
  });

  it("첫 미완성 문항의 위치를 찾는다", () => {
    const list = [valid(), valid({ question_text: "" }), valid({ time_limit_sec: 7 })];
    expect(findFirstIncomplete(list)).toBe(1);
    expect(isShowComplete(list)).toBe(false);
  });
});

describe("isUntouchedQuestion", () => {
  const blank: QuestionDraft = {
    text_type: "short",
    question_text: "",
    image_url: null,
    choices: [choice(1, ""), choice(2, ""), choice(3, ""), choice(4, "")],
    time_limit_sec: 20,
  };
  it("빈 새 문항은 true", () => {
    expect(isUntouchedQuestion(blank)).toBe(true);
    expect(isUntouchedQuestion({ ...blank, time_limit_sec: 30 })).toBe(true);
  });
  it("무엇이든 입력했으면 false", () => {
    expect(isUntouchedQuestion({ ...blank, question_text: "a" })).toBe(false);
    expect(isUntouchedQuestion({ ...blank, choices: [choice(1, "", true), choice(2, "")] })).toBe(false);
    expect(isUntouchedQuestion({ ...blank, memo: "메모" })).toBe(false);
  });
});
