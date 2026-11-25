import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_ROWS,
  parseAnswerCell,
  parseQuestionTable,
  parseTimeLimit,
  parseYesNo,
  readQuestionWorkbook,
  type ImportRow,
} from "./question-import";
import { buildQuestionTemplate, questionTemplateHeaders } from "./question-template";

const HEADERS = questionTemplateHeaders();

/** 표 → 실제 xlsx 바이트 → 파싱(엑셀 파일을 올린 것과 같은 경로) */
function roundTrip(rows: unknown[][], sheetName = "문제") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return readQuestionWorkbook(bytes);
}

function rowsOf(result: ReturnType<typeof readQuestionWorkbook>): ImportRow[] {
  if (!result.ok) throw new Error(`parse failed: ${result.error}`);
  return result.rows;
}

const row = (
  question: string,
  choices: string[],
  answer: unknown,
  time: unknown = 20,
  useScore: unknown = "Y",
  double: unknown = "N",
  memo = "",
) => [1, question, ...choices, answer, time, useScore, double, memo];

describe("셀 해석", () => {
  it.each([
    [2, [2]],
    ["2", [2]],
    ["1,3", [1, 3]],
    ["3, 1", [1, 3]],
    ["1/3", [1, 3]],
    ["1 3", [1, 3]],
    ["①③", [1, 3]],
    ["2번", [2]],
    [13, [1, 3]], // 엑셀이 '1,3'을 숫자 13으로 바꾼 경우
    [1.3, [1, 3]],
    ["", []],
  ])("정답 %o → %o", (input, expected) => {
    expect(parseAnswerCell(input)).toEqual(expected);
  });

  it.each([["5"], ["0"], ["가"], ["1,5"], [15], [-1]])("읽을 수 없는 정답 %o → null", (input) => {
    expect(parseAnswerCell(input)).toBeNull();
  });

  it("Y/N", () => {
    expect(parseYesNo("Y", false)).toBe(true);
    expect(parseYesNo("n", true)).toBe(false);
    expect(parseYesNo("예", false)).toBe(true);
    expect(parseYesNo("X", true)).toBe(false);
    expect(parseYesNo("", true)).toBe(true);
    expect(parseYesNo("모름", false)).toBe(false);
  });

  it("제한시간", () => {
    expect(parseTimeLimit(30)).toEqual({ sec: 30, warning: null });
    expect(parseTimeLimit("")).toEqual({ sec: 20, warning: null });
    expect(parseTimeLimit("60초")).toEqual({ sec: 60, warning: null });
    expect(parseTimeLimit(15)).toEqual({ sec: 10, warning: { kind: "timeLimitAdjusted", from: "15", to: 10 } });
    expect(parseTimeLimit(200)).toEqual({ sec: 120, warning: { kind: "timeLimitAdjusted", from: "200", to: 120 } });
    expect(parseTimeLimit("빠르게").sec).toBe(20);
  });
});

describe("정상 파일", () => {
  it("템플릿 그대로 올리면 예시 2행이 모두 등록 가능", () => {
    const bytes = XLSX.write(buildQuestionTemplate(), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = rowsOf(readQuestionWorkbook(bytes));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].question.choices).toHaveLength(3); // 보기4가 비어 있음
    expect(rows[1].question.choices.filter((c) => c.is_correct).map((c) => c.id)).toEqual([1, 3]);
    expect(rows[1].question.double_score).toBe(true);
  });

  it("20문항을 행 순서대로 읽는다", () => {
    const data = Array.from({ length: 20 }, (_, i) => row(`문제 ${i + 1}`, ["가", "나", "다", "라"], (i % 4) + 1));
    const rows = rowsOf(roundTrip([HEADERS, ...data]));
    expect(rows).toHaveLength(20);
    expect(rows.map((r) => r.question.question_text)).toEqual(data.map((d) => d[1]));
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
  });

  it("열 제목의 공백·괄호 설명은 무시하고, 다른 시트 이름이면 첫 시트를 읽는다", () => {
    const headers = ["번호", " 문제 ", "보기 1", "보기2", "보기3", "보기4", "정답 (예: 2 또는 1,3)", "제한시간", "점수사용", "점수 2배", "메모"];
    const rows = rowsOf(roundTrip([headers, row("질문", ["a", "b", "", ""], "2", 10)], "Sheet1"));
    expect(rows[0].issues).toEqual([]);
    expect(rows[0].question.time_limit_sec).toBe(10);
  });

  it("빈 행과 번호만 있는 행은 건너뛴다", () => {
    const rows = rowsOf(
      roundTrip([HEADERS, row("Q1", ["a", "b", "", ""], 1), [], [3], row("Q2", ["a", "b", "", ""], 2)]),
    );
    expect(rows.map((r) => [r.rowNumber, r.question.question_text])).toEqual([
      [2, "Q1"],
      [5, "Q2"],
    ]);
  });

  it("120자를 넘으면 장문형으로, 점수사용 N이면 점수2배도 끈다", () => {
    const long = "가".repeat(150);
    const [r] = rowsOf(roundTrip([HEADERS, row(long, ["a", "b", "", ""], 1, 20, "N", "Y")]));
    expect(r.question.text_type).toBe("long");
    expect(r.warnings).toContainEqual({ kind: "autoLong" });
    expect(r.issues).toEqual([]);
    expect(r.question.use_score).toBe(false);
    expect(r.question.double_score).toBe(false);
  });

  it("비어 있는 보기 열은 빼고 번호를 다시 매기되, 정답은 엑셀 보기 번호 기준", () => {
    const [r] = rowsOf(roundTrip([HEADERS, row("Q", ["a", "", "c", ""], 3)]));
    expect(r.question.choices.map((c) => [c.id, c.text, c.is_correct])).toEqual([
      [1, "a", false],
      [2, "c", true],
    ]);
  });
});

describe("오류 파일", () => {
  it("문제 열이 없으면 noHeader", () => {
    expect(roundTrip([["이름", "부서"], ["a", "b"]])).toEqual({ ok: false, error: "noHeader" });
  });

  it("제목 행만 있으면 noRows", () => {
    expect(roundTrip([HEADERS])).toEqual({ ok: false, error: "noRows" });
  });

  it("엑셀이 아니면 unreadable", () => {
    expect(readQuestionWorkbook(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).toEqual({ ok: false, error: "unreadable" });
  });

  it(`${MAX_IMPORT_ROWS}행을 넘으면 tooManyRows`, () => {
    const data = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row("Q", ["a", "b", "", ""], 1));
    expect(parseQuestionTable([HEADERS, ...data])).toEqual({ ok: false, error: "tooManyRows" });
  });

  it("행별 미완성 이유", () => {
    const rows = rowsOf(
      roundTrip([
        HEADERS,
        row("", ["a", "b", "", ""], 1), // 문제 없음
        row("보기 1개", ["a", "", "", ""], 1), // 보기 2개 미만
        row("정답 없음", ["a", "b", "", ""], ""), // 정답 없음
        row("정답 5", ["a", "b", "", ""], 5), // 범위 밖
        row("빈 보기 정답", ["a", "b", "", ""], 3), // 비어 있는 보기를 정답으로
        row("가".repeat(301), ["a", "b", "", ""], 1), // 300자 초과
        row("보기 61자", ["가".repeat(61), "b", "", ""], 1), // 보기 길이
        row("정상", ["a", "b", "", ""], 2, 15), // 제한시간 보정(경고만)
      ]),
    );
    expect(rows.map((r) => [r.rowNumber, r.issues])).toEqual([
      [2, ["missingText"]],
      [3, ["tooFewChoices"]],
      [4, ["noCorrect"]],
      [5, ["invalidAnswer"]],
      [6, ["invalidAnswer"]],
      [7, ["textTooLong"]],
      [8, ["choiceTooLong"]],
      [9, []],
    ]);
    expect(rows[7].warnings).toEqual([{ kind: "timeLimitAdjusted", from: "15", to: 10 }]);
    expect(rows[7].question.time_limit_sec).toBe(10);
  });
});
