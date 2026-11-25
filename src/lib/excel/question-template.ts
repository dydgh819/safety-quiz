import * as XLSX from "xlsx";

import { MAX_CHOICES } from "@/lib/quiz/constants";
import { ko } from "@/messages/ko";

/**
 * 문제 일괄 등록 엑셀 템플릿(QZ-10).
 * 열 = 번호, 문제, 보기1~4, 정답, 제한시간(초), 점수사용(Y/N), 점수2배(Y/N), 메모
 * 첫 시트 '문제'에 예시 2행, 두 번째 시트 '작성 안내'.
 */

/** 템플릿 열 제목(순서대로) */
export function questionTemplateHeaders(): string[] {
  const h = ko.excel.headers;
  return [
    h.no,
    h.question,
    ...Array.from({ length: MAX_CHOICES }, (_, i) => h.choice(i + 1)),
    h.answer,
    h.timeLimit,
    h.useScore,
    h.doubleScore,
    h.memo,
  ];
}

/** 정답 열 위치(0부터). '1,3'을 엑셀이 숫자 13으로 바꾸지 않게 텍스트 서식을 미리 넣는다 */
const ANSWER_COLUMN = 2 + MAX_CHOICES;
/** 텍스트 서식을 미리 넣어 둘 행 수 */
const PREFORMATTED_ROWS = 200;

export function buildQuestionTemplate(): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    questionTemplateHeaders(),
    ...ko.excel.examples.map((ex, i) => [
      i + 1,
      ex.question,
      ...ex.choices,
      ex.answer,
      ex.timeLimit,
      ex.useScore,
      ex.doubleScore,
      ex.memo,
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // 정답 열: 텍스트 서식
  for (let r = 1; r <= PREFORMATTED_ROWS; r += 1) {
    const ref = XLSX.utils.encode_cell({ r, c: ANSWER_COLUMN });
    const cell = sheet[ref] ?? { t: "s", v: "" };
    cell.t = "s";
    cell.v = String(cell.v ?? "");
    cell.z = "@";
    sheet[ref] = cell;
  }
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: PREFORMATTED_ROWS, c: rows[0].length - 1 } });
  sheet["!cols"] = [
    { wch: 6 },
    { wch: 50 },
    ...Array.from({ length: MAX_CHOICES }, () => ({ wch: 24 })),
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
  ];

  const guide = XLSX.utils.aoa_to_sheet(ko.excel.guide);
  guide["!cols"] = [{ wch: 16 }, { wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, ko.excel.questionSheet);
  XLSX.utils.book_append_sheet(workbook, guide, ko.excel.guideSheet);
  return workbook;
}
