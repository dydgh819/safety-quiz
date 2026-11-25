import { describe, expect, it } from "vitest";

import { addChoice, createEmptyChoices, removeChoice, renumberChoices, updateChoice } from "./choices";

describe("보기 다루기", () => {
  it("빈 보기 4개를 1~4 번호로 만든다", () => {
    const c = createEmptyChoices();
    expect(c.map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(c.every((x) => x.text === "" && x.image_url === null && !x.is_correct)).toBe(true);
  });

  it("보기를 지우면 번호를 1..n 으로 다시 매기고, 2개 아래로는 지우지 않는다", () => {
    const four = updateChoice(createEmptyChoices(), 3, { text: "셋", is_correct: true });
    const three = removeChoice(four, 2);
    expect(three.map((x) => [x.id, x.text])).toEqual([
      [1, ""],
      [2, "셋"],
      [3, ""],
    ]);
    expect(three[1].is_correct).toBe(true);
    const two = removeChoice(three, 1);
    expect(removeChoice(two, 1)).toHaveLength(2);
  });

  it("보기는 4개까지만 추가된다", () => {
    const two = createEmptyChoices(2);
    const three = addChoice(two);
    expect(three.map((x) => x.id)).toEqual([1, 2, 3]);
    expect(addChoice(createEmptyChoices(4))).toHaveLength(4);
  });

  it("renumberChoices 는 원본을 바꾸지 않는다", () => {
    const src = [{ id: 7, text: "a", image_url: null, is_correct: false }];
    renumberChoices(src);
    expect(src[0].id).toBe(7);
  });
});
