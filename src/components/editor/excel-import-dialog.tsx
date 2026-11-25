"use client";

import { useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { ImportedQuestion, ImportIssue, ImportRow, ImportWarning, ParseError } from "@/lib/excel/question-import";
import { ko } from "@/messages/ko";

type Props = {
  /** 이 Show 에 빈 문항 1개만 있어 가져오면서 지워지는지(안내용) */
  replacesBlank: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (questions: ImportedQuestion[]) => void;
};

type State =
  | { phase: "choose"; error: string | null }
  | { phase: "reading" }
  | { phase: "parsed"; fileName: string; rows: ImportRow[] };

/** QZ-10: 엑셀 업로드 → 행별 검증 결과 안내 → 완성된 행만 추가 */
export function ExcelImportDialog({ replacesBlank, busy, onClose, onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "choose", error: null });

  async function handleFile(file: File) {
    const { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS, readQuestionWorkbook } = await import("@/lib/excel/question-import");
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setState({ phase: "choose", error: ko.excel.errors.tooLarge });
      return;
    }
    setState({ phase: "reading" });
    try {
      const result = readQuestionWorkbook(await file.arrayBuffer());
      if (!result.ok) {
        setState({ phase: "choose", error: parseErrorMessage(result.error, MAX_IMPORT_ROWS) });
        return;
      }
      setState({ phase: "parsed", fileName: file.name, rows: result.rows });
    } catch (e) {
      console.error(e);
      setState({ phase: "choose", error: ko.excel.errors.unreadable });
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void handleFile(file);
      }}
    />
  );

  const okRows = state.phase === "parsed" ? state.rows.filter((r) => r.issues.length === 0) : [];
  const badRows = state.phase === "parsed" ? state.rows.filter((r) => r.issues.length > 0) : [];

  return (
    <Modal
      title={ko.importDialog.excelTitle}
      onClose={onClose}
      wide
      footer={
        state.phase === "parsed" ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="min-h-11 rounded-lg px-4 font-medium text-neutral-600 hover:bg-neutral-100"
            >
              {ko.importDialog.chooseOther}
            </button>
            <button
              type="button"
              disabled={okRows.length === 0 || busy}
              onClick={() => onConfirm(okRows.map((r) => r.question))}
              className="min-h-11 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {ko.importDialog.addButton(okRows.length)}
            </button>
          </>
        ) : undefined
      }
    >
      {fileInput}
      {state.phase === "choose" && (
        <div className="flex flex-col items-start gap-4">
          <p className="text-neutral-700">{ko.importDialog.excelIntro}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-12 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600"
          >
            {ko.importDialog.chooseFile}
          </button>
          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
        </div>
      )}

      {state.phase === "reading" && <p className="text-neutral-500">{ko.importDialog.reading}</p>}

      {state.phase === "parsed" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">{state.fileName}</p>
          <p className="text-lg font-bold">
            <span className="text-green-700">{ko.importDialog.summary(okRows.length, badRows.length)}</span>
          </p>
          {replacesBlank && okRows.length > 0 && <p className="text-sm text-neutral-600">{ko.importDialog.replacesBlank}</p>}

          {badRows.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-red-700">{ko.importDialog.badSection}</h3>
              <ul className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                {badRows.map((r) => (
                  <li key={r.rowNumber}>
                    <span className="font-semibold">{ko.importDialog.row(r.rowNumber)}</span>{" "}
                    <span className="text-neutral-500">{excerpt(r.question.question_text)}</span>
                    <span className="block text-red-700">{r.issues.map(issueMessage).join(" ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {okRows.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-green-700">{ko.importDialog.okSection}</h3>
              <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border border-neutral-200 p-3 text-sm">
                {okRows.map((r) => (
                  <li key={r.rowNumber}>
                    <span className="font-semibold">{ko.importDialog.row(r.rowNumber)}</span> {excerpt(r.question.question_text)}
                    {r.warnings.length > 0 && (
                      <span className="ml-1 text-amber-700">({r.warnings.map(warningMessage).join(", ")})</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function excerpt(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function issueMessage(issue: ImportIssue): string {
  return issue === "invalidAnswer" ? ko.excel.issues.invalidAnswer : ko.editor.issues[issue];
}

function warningMessage(warning: ImportWarning): string {
  return warning.kind === "autoLong" ? ko.excel.warnings.autoLong : ko.excel.warnings.timeLimitAdjusted(warning.from, warning.to);
}

function parseErrorMessage(error: ParseError, maxRows: number): string {
  switch (error) {
    case "noHeader":
      return ko.excel.errors.noHeader;
    case "noRows":
      return ko.excel.errors.noRows;
    case "tooManyRows":
      return ko.excel.errors.tooManyRows(maxRows);
    default:
      return ko.excel.errors.unreadable;
  }
}
