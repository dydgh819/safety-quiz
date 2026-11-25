import * as XLSX from "xlsx";

import {
  CHOICE_TEXT_MAX,
  DEFAULT_TIME_LIMIT_SEC,
  MAX_CHOICES,
  SHORT_QUESTION_MAX,
  TIME_LIMIT_OPTIONS,
  nearestTimeLimit,
} from "@/lib/quiz/constants";
import { validateQuestion, type QuestionIssue } from "@/lib/quiz/validate";
import { ko } from "@/messages/ko";
import type { Choice, TextType } from "@/types/db";

/**
 * 엑셀 문제 업로드 파싱(QZ-10). 순수 함수 — 브라우저에서 실행하고, 서버는 결과를 다시 검증한다.
 * 행마다 lib/quiz/validate.ts 로 완성 여부를 판정하고, 완성된 행만 등록한다.
 */

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const MEMO_MAX = 1000;

export type ImportIssue = QuestionIssue | "invalidAnswer";

export type ImportWarning = { kind: "timeLimitAdjusted"; from: string; to: number } | { kind: "autoLong" };

/** 등록할 문항(문항 저장 입력과 같은 모양) */
export type ImportedQuestion = {
  text_type: TextType;
  question_text: string;
  image_url: null;
  choices: Choice[];
  memo: string;
  time_limit_sec: number;
  use_score: boolean;
  double_score: boolean;
};

export type ImportRow = {
  /** 엑셀 행 번호(1부터, 제목 행 포함) */
  rowNumber: number;
  question: ImportedQuestion;
  issues: ImportIssue[];
  warnings: ImportWarning[];
};

export type ParseError = "unreadable" | "noHeader" | "noRows" | "tooManyRows";
export type ParseResult = { ok: true; rows: ImportRow[] } | { ok: false; error: ParseError };

// ---------------------------------------------------------------------------
// 셀 값 해석
// ---------------------------------------------------------------------------

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** 열 제목 비교용: 공백·괄호 설명 제거, 소문자 */
export function normalizeHeader(value: unknown): string {
  return cellText(value)
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

const CIRCLED: Record<string, string> = { "①": "1", "②": "2", "③": "3", "④": "4" };

/**
 * 정답 셀 → 보기 번호 목록. 읽을 수 없으면 null, 비었으면 [].
 * 허용: 2 / "2" / "1,3" / "1, 3" / "1/3" / "1 3" / "①③" / "2번", 그리고 엑셀이 '1,3'을 숫자 13으로 바꾼 경우.
 */
export function parseAnswerCell(value: unknown, maxChoice: number = MAX_CHOICES): number[] | null {
  let text = cellText(value);
  if (text === "") return [];
  text = text.replace(/[①②③④]/g, (c) => ` ${CIRCLED[c]} `).replace(/번/g, " ");

  let tokens = text.split(/[\s,，、/·;.+]+/).filter((t) => t !== "");
  if (tokens.length === 0) return null;
  // '13' 처럼 한 덩어리로 붙은 경우(엑셀이 1,3 을 숫자로 바꿈) → 자리마다 보기 번호
  if (tokens.length === 1 && tokens[0].length > 1 && new RegExp(`^[1-${maxChoice}]+$`).test(tokens[0])) {
    tokens = tokens[0].split("");
  }

  const numbers: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return null;
    const n = Number(token);
    if (n < 1 || n > maxChoice) return null;
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers.sort((a, b) => a - b);
}

const YES = /^(y|yes|o|true|1|예|네|사용|on)$/i;
const NO = /^(n|no|x|false|0|아니오|아니요|미사용|off)$/i;

/** Y/N 셀. 비었거나 알 수 없으면 기본값 */
export function parseYesNo(value: unknown, fallback: boolean): boolean {
  const text = cellText(value);
  if (YES.test(text)) return true;
  if (NO.test(text)) return false;
  return fallback;
}

/** 제한시간 셀. 비면 기본 20초, 허용값이 아니면 가장 가까운 값 + 경고 */
export function parseTimeLimit(value: unknown): { sec: number; warning: ImportWarning | null } {
  const text = cellText(value).replace(/초$/, "").trim();
  if (text === "") return { sec: DEFAULT_TIME_LIMIT_SEC, warning: null };
  const n = Number(text);
  if (!Number.isFinite(n)) {
    return { sec: DEFAULT_TIME_LIMIT_SEC, warning: { kind: "timeLimitAdjusted", from: cellText(value), to: DEFAULT_TIME_LIMIT_SEC } };
  }
  if ((TIME_LIMIT_OPTIONS as readonly number[]).includes(n)) return { sec: n, warning: null };
  const to = nearestTimeLimit(n);
  return { sec: to, warning: { kind: "timeLimitAdjusted", from: cellText(value), to } };
}

// ---------------------------------------------------------------------------
// 표 → 행
// ---------------------------------------------------------------------------

type ColumnMap = {
  question: number;
  choices: number[]; // 보기1~4 열 위치(-1 = 없음)
  answer: number;
  timeLimit: number;
  useScore: number;
  doubleScore: number;
  memo: number;
};

function findColumns(headerRow: unknown[]): ColumnMap | null {
  const h = ko.excel.headers;
  const normalized = headerRow.map(normalizeHeader);
  const find = (label: string) => normalized.indexOf(normalizeHeader(label));
  const question = find(h.question);
  if (question < 0) return null;
  return {
    question,
    choices: Array.from({ length: MAX_CHOICES }, (_, i) => find(h.choice(i + 1))),
    answer: find(h.answer),
    timeLimit: find(h.timeLimit),
    useScore: find(h.useScore),
    doubleScore: find(h.doubleScore),
    memo: find(h.memo),
  };
}

const at = (row: unknown[], col: number): unknown => (col >= 0 ? row[col] : undefined);

function parseRow(row: unknown[], rowNumber: number, cols: ColumnMap): ImportRow | null {
  const questionText = cellText(at(row, cols.question));
  const choiceCells = cols.choices.map((col, i) => ({ number: i + 1, text: cellText(at(row, col)) }));

  // 문제·보기가 모두 비면 빈 행으로 보고 건너뛴다(번호만 남은 행 포함)
  if (questionText === "" && choiceCells.every((c) => c.text === "")) return null;

  const warnings: ImportWarning[] = [];
  const issues: ImportIssue[] = [];

  const textType: TextType = questionText.length > SHORT_QUESTION_MAX ? "long" : "short";
  if (textType === "long") warnings.push({ kind: "autoLong" });

  // 비어 있는 보기 열은 빼고 1..n 으로 다시 번호를 매긴다. 정답은 엑셀의 보기 번호 기준
  const filled = choiceCells.filter((c) => c.text !== "");
  const answers = parseAnswerCell(at(row, cols.answer));
  let answerInvalid = answers === null;
  if (answers) {
    const filledNumbers = new Set(filled.map((c) => c.number));
    if (answers.some((n) => !filledNumbers.has(n))) answerInvalid = true;
  }
  const choices: Choice[] = filled.map((c, i) => ({
    id: i + 1,
    text: c.text.slice(0, CHOICE_TEXT_MAX + 1), // 61자 이상이면 validate 가 choiceTooLong 으로 잡는다
    image_url: null,
    is_correct: !answerInvalid && !!answers?.includes(c.number),
  }));

  const time = parseTimeLimit(at(row, cols.timeLimit));
  if (time.warning) warnings.push(time.warning);

  const useScore = parseYesNo(at(row, cols.useScore), true);
  const question: ImportedQuestion = {
    text_type: textType,
    question_text: questionText,
    image_url: null,
    choices,
    memo: cellText(at(row, cols.memo)).slice(0, MEMO_MAX),
    time_limit_sec: time.sec,
    use_score: useScore,
    double_score: useScore && parseYesNo(at(row, cols.doubleScore), false),
  };

  issues.push(...validateQuestion(question));
  if (answerInvalid) {
    // 정답을 읽지 못한 경우 '정답 없음'보다 구체적인 이유만 보여준다
    const i = issues.indexOf("noCorrect");
    if (i >= 0) issues.splice(i, 1);
    issues.push("invalidAnswer");
  }
  return { rowNumber, question, issues, warnings };
}

/** 2차원 표(첫 행 = 열 제목) → 행 목록 */
export function parseQuestionTable(table: readonly unknown[][]): ParseResult {
  // 맨 위 몇 행 안에서 '문제' 열 제목이 있는 행을 찾는다
  let headerIndex = -1;
  let cols: ColumnMap | null = null;
  for (let i = 0; i < Math.min(table.length, 5); i += 1) {
    cols = findColumns(table[i] ?? []);
    if (cols) {
      headerIndex = i;
      break;
    }
  }
  if (!cols) return { ok: false, error: "noHeader" };

  const rows: ImportRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i += 1) {
    const parsed = parseRow(table[i] ?? [], i + 1, cols);
    if (parsed) rows.push(parsed);
  }
  if (rows.length === 0) return { ok: false, error: "noRows" };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "tooManyRows" };
  return { ok: true, rows };
}

/** 엑셀 파일(바이트) → 행 목록. '문제' 시트가 있으면 그 시트, 없으면 첫 시트 */
export function readQuestionWorkbook(data: ArrayBuffer | Uint8Array): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array" });
  } catch {
    return { ok: false, error: "unreadable" };
  }
  const name = workbook.SheetNames.includes(ko.excel.questionSheet) ? ko.excel.questionSheet : workbook.SheetNames[0];
  const sheet = name ? workbook.Sheets[name] : undefined;
  if (!sheet) return { ok: false, error: "unreadable" };
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });
  return parseQuestionTable(table);
}
