"use client";

import { arrayMove } from "@dnd-kit/sortable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  addQuestionAction,
  completeShowAction,
  deleteQuestionAction,
  duplicateQuestionAction,
  reorderQuestionsAction,
  saveQuestionAction,
} from "@/app/(host)/shows/actions";
import { copyQuestionsFromShowAction, importQuestionsAction } from "@/app/(host)/shows/import-actions";
import { ExcelImportDialog } from "@/components/editor/excel-import-dialog";
import { ImportFromShowDialog } from "@/components/editor/import-from-show-dialog";
import { QuestionForm, type QuestionPatch } from "@/components/editor/question-form";
import { QuestionList } from "@/components/editor/question-list";
import { ShowSettingsDialog } from "@/components/shows/show-settings-dialog";
import { QuestionStage } from "@/components/stage/question-stage";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/lib/action-result";
import type { QuestionsResult } from "@/lib/db/questions";
import type { ImportedQuestion } from "@/lib/excel/question-import";
import { isUntouchedQuestion, validateQuestion } from "@/lib/quiz/validate";
import { ko } from "@/messages/ko";
import type { QuestionRow, ShowRow } from "@/types/db";

/** 자동 저장 대기 시간(QZ-08) */
const AUTOSAVE_DELAY_MS = 1000;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function toPayload(q: QuestionRow) {
  return {
    text_type: q.text_type,
    question_text: q.question_text,
    image_url: q.image_url,
    choices: q.choices,
    memo: q.memo,
    time_limit_sec: q.time_limit_sec,
    use_score: q.use_score,
    double_score: q.double_score,
  };
}

/** A4 Show 편집 화면 */
export function ShowEditor({ initialShow, initialQuestions }: { initialShow: ShowRow; initialQuestions: QuestionRow[] }) {
  const router = useRouter();
  const [show, setShow] = useState(initialShow);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selectedId, setSelectedId] = useState<string | null>(initialQuestions[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [importDialog, setImportDialog] = useState<"excel" | "show" | null>(null);

  // 자동 저장 상태(렌더와 무관한 값은 ref)
  const questionsRef = useRef(initialQuestions);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dirty = useRef(new Set<string>());
  const inflight = useRef(0);

  const commitQuestions = useCallback((next: QuestionRow[]) => {
    questionsRef.current = next;
    setQuestions(next);
  }, []);

  const saveNow = useCallback(
    async (id: string): Promise<boolean> => {
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.delete(id);
      if (!dirty.current.has(id)) return true;

      const q = questionsRef.current.find((x) => x.id === id);
      dirty.current.delete(id);
      if (!q) return true;

      inflight.current += 1;
      setSaveState("saving");
      const result = await saveQuestionAction(show.id, id, toPayload(q));
      inflight.current -= 1;

      if (!result.ok) {
        dirty.current.add(id);
        setSaveState("error");
        setNotice(result.error);
        return false;
      }
      setShow((s) => ({ ...s, is_complete: result.data.isComplete }));
      if (inflight.current === 0 && dirty.current.size === 0) setSaveState("saved");
      return true;
    },
    [show.id],
  );

  /** 대기 중인 저장을 모두 즉시 실행 */
  const flushAll = useCallback(async (): Promise<boolean> => {
    let allOk = true;
    for (const id of [...dirty.current]) {
      if (!(await saveNow(id))) allOk = false;
    }
    return allOk;
  }, [saveNow]);

  function updateQuestion(id: string, patch: QuestionPatch) {
    commitQuestions(questionsRef.current.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    dirty.current.add(id);
    setSaveState("pending");
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(
      id,
      setTimeout(() => void saveNow(id), AUTOSAVE_DELAY_MS),
    );
  }

  // 저장 전 창을 닫으려 하면 경고
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty.current.size > 0 || inflight.current > 0) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /** 구조 변경(추가·복사·삭제·순서): 저장을 먼저 끝내고 서버 결과로 목록을 바꾼다 */
  async function structural(
    work: () => Promise<ActionResult<QuestionsResult & { newId?: string }>>,
    onDone?: (data: QuestionsResult & { newId?: string }) => void,
  ) {
    setBusy(true);
    setNotice(null);
    const saved = await flushAll();
    if (!saved) {
      setBusy(false);
      return;
    }
    const result = await work();
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    commitQuestions(result.data.questions);
    setShow((s) => ({ ...s, is_complete: result.data.isComplete }));
    onDone?.(result.data);
  }

  function handleAdd() {
    void structural(
      () => addQuestionAction(show.id, selectedId),
      (data) => data.newId && setSelectedId(data.newId),
    );
  }

  function handleDuplicate(id: string) {
    void structural(
      () => duplicateQuestionAction(show.id, id),
      (data) => data.newId && setSelectedId(data.newId),
    );
  }

  function handleDelete(id: string) {
    const index = questionsRef.current.findIndex((q) => q.id === id);
    if (!window.confirm(ko.editor.confirmDeleteQuestion(index + 1))) return;
    void structural(
      () => deleteQuestionAction(show.id, id),
      (data) => {
        const next = data.questions[Math.min(index, data.questions.length - 1)];
        setSelectedId(next?.id ?? null);
      },
    );
  }

  function handleReorder(fromId: string, toId: string) {
    const list = questionsRef.current;
    const from = list.findIndex((q) => q.id === fromId);
    const to = list.findIndex((q) => q.id === toId);
    if (from < 0 || to < 0) return;
    const previous = list;
    const moved = arrayMove(list, from, to);
    commitQuestions(moved); // 화면은 바로 바꾸고
    void structural(
      () => reorderQuestionsAction(show.id, moved.map((q) => q.id)),
    ).then(() => {
      // 실패하면 structural 이 목록을 바꾸지 않으므로 원래 순서로 되돌린다
      if (questionsRef.current === moved) commitQuestions(previous);
    });
  }

  /** 엑셀(QZ-10)·다른 Show(QZ-11)에서 가져온 문항을 끝에 추가하고 첫 추가 문항을 연다 */
  function handleImportExcel(rows: ImportedQuestion[]) {
    setImportDialog(null); // 실패 안내가 대화상자에 가리지 않도록 먼저 닫는다
    void structural(
      () => importQuestionsAction(show.id, rows),
      (data) => data.newId && setSelectedId(data.newId),
    );
  }

  function handleImportFromShow(sourceShowId: string, questionIds: string[]) {
    setImportDialog(null); // 실패 안내가 대화상자에 가리지 않도록 먼저 닫는다
    void structural(
      () => copyQuestionsFromShowAction(show.id, sourceShowId, questionIds),
      (data) => data.newId && setSelectedId(data.newId),
    );
  }

  async function handleDownloadTemplate() {
    const [XLSX, { buildQuestionTemplate }] = await Promise.all([import("xlsx"), import("@/lib/excel/question-template")]);
    XLSX.writeFile(buildQuestionTemplate(), ko.excel.templateFileName);
  }

  async function handleComplete() {
    setBusy(true);
    setNotice(null);
    const saved = await flushAll();
    if (!saved) {
      setBusy(false);
      return;
    }
    const result = await completeShowAction(show.id);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    if (result.data.complete) {
      setShow((s) => ({ ...s, is_complete: true }));
      setCompleteOpen(true);
      return;
    }
    const { questionId, issues } = result.data;
    if (!questionId) {
      setNotice(ko.editor.noQuestionsNotice);
      return;
    }
    setSelectedId(questionId);
    const index = questionsRef.current.findIndex((q) => q.id === questionId);
    setNotice([ko.editor.incompleteNotice(index + 1), ...issues.map((i) => ko.editor.issues[i])].join(" "));
  }

  async function goTo(href: string) {
    await flushAll();
    router.push(href);
  }

  const selectedIndex = questions.findIndex((q) => q.id === selectedId);
  const selected = selectedIndex >= 0 ? questions[selectedIndex] : null;
  const selectedIssues = selected ? validateQuestion(selected) : [];
  const replacesBlank = questions.length === 1 && isUntouchedQuestion(questions[0]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[40rem] flex-col">
      {/* 상단: 제목 · 저장 상태 · 미리보기 · 기본설정 · 완성 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
        <Link
          href="/shows"
          onClick={(e) => {
            e.preventDefault();
            void goTo("/shows");
          }}
          className="min-h-10 rounded-lg px-2 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {ko.editor.backToList}
        </Link>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="min-w-0 truncate text-left text-lg font-bold hover:text-brand-700"
          title={ko.editor.settings}
        >
          {show.title}
        </button>
        <SaveIndicator state={saveState} onRetry={() => void flushAll()} />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void goTo(`/shows/${show.id}/preview`)}
            className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50"
          >
            {ko.editor.preview}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50"
          >
            {ko.editor.settings}
          </button>
          {show.is_complete ? (
            <span
              title={ko.editor.completedHint}
              className="flex min-h-10 items-center rounded-lg bg-green-50 px-4 text-sm font-bold text-green-700"
            >
              ✓ {ko.editor.completed}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={busy}
              className="min-h-10 rounded-lg bg-brand-500 px-5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {ko.editor.complete}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div role="alert" className="flex items-center gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={ko.common.close} className="px-2 text-lg">
            ×
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 좌: 문제 목록 */}
        <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-50">
          <QuestionList
            questions={questions}
            selectedId={selectedId}
            busy={busy}
            onSelect={setSelectedId}
            onAdd={handleAdd}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onReorder={handleReorder}
            onExcelImport={() => setImportDialog("excel")}
            onDownloadTemplate={() => void handleDownloadTemplate()}
            onImportFromShow={() => setImportDialog("show")}
          />
        </aside>

        {/* 중앙: 발표 화면 미리보기(QZ-07) */}
        <section aria-label={ko.editor.previewLabel} className="min-w-0 flex-1 overflow-y-auto bg-neutral-100 p-6">
          {selected && (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              <QuestionStage
                questionNumber={selectedIndex + 1}
                totalQuestions={questions.length}
                textType={selected.text_type}
                questionText={selected.question_text}
                imageUrl={selected.image_url}
                choices={selected.choices}
                timeLimitSec={selected.time_limit_sec}
                doubleScore={selected.use_score && selected.double_score}
              />
              {selectedIssues.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selectedIssues.map((issue) => (
                    <li key={issue}>⚠ {ko.editor.issues[issue]}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* 우: 입력 폼 */}
        <aside className="w-[26rem] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
          {selected && (
            <QuestionForm
              key={selected.id}
              question={selected}
              disabled={busy}
              onChange={(patch) => updateQuestion(selected.id, patch)}
            />
          )}
        </aside>
      </div>

      {settingsOpen && (
        <ShowSettingsDialog
          mode="edit"
          show={show}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            setShow(updated);
            setSettingsOpen(false);
          }}
        />
      )}

      {importDialog === "excel" && (
        <ExcelImportDialog
          replacesBlank={replacesBlank}
          busy={busy}
          onClose={() => setImportDialog(null)}
          onConfirm={handleImportExcel}
        />
      )}
      {importDialog === "show" && (
        <ImportFromShowDialog
          currentShowId={show.id}
          replacesBlank={replacesBlank}
          busy={busy}
          onClose={() => setImportDialog(null)}
          onConfirm={handleImportFromShow}
        />
      )}

      {completeOpen && (
        <Modal
          title={ko.editor.completeDialogTitle}
          onClose={() => setCompleteOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                className="min-h-11 rounded-lg px-4 font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {ko.editor.keepEditing}
              </button>
              <button
                type="button"
                disabled
                title={ko.common.comingSoon(4)}
                className="min-h-11 rounded-lg border border-neutral-300 px-4 font-medium text-neutral-400"
              >
                {ko.editor.playNow}
              </button>
              <button
                type="button"
                onClick={() => router.push("/shows")}
                className="min-h-11 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600"
              >
                {ko.editor.goToList}
              </button>
            </>
          }
        >
          <p className="text-neutral-700">{ko.editor.completeDialogBody}</p>
        </Modal>
      )}
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "error") {
    return (
      <span className="flex items-center gap-2 text-sm text-red-600" role="status">
        {ko.editor.saveError}
        <button type="button" onClick={onRetry} className="rounded px-2 py-1 font-semibold underline">
          {ko.common.retry}
        </button>
      </span>
    );
  }
  return (
    <span role="status" className={`text-sm ${state === "saved" ? "text-green-700" : "text-neutral-500"}`}>
      {state === "saved" ? `✓ ${ko.editor.saveSaved}` : ko.editor.saveSaving}
    </span>
  );
}
