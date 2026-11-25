"use client";

import { useEffect, useState } from "react";

import {
  listOtherShowsAction,
  listShowQuestionsAction,
  type PickerQuestion,
  type PickerShow,
} from "@/app/(host)/shows/import-actions";
import { Modal } from "@/components/ui/modal";
import { ko } from "@/messages/ko";

type Props = {
  currentShowId: string;
  replacesBlank: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (sourceShowId: string, questionIds: string[]) => void;
};

type State =
  | { phase: "loading" }
  | { phase: "shows"; shows: PickerShow[] }
  | { phase: "questions"; show: PickerShow; shows: PickerShow[]; questions: PickerQuestion[] | null; selected: Set<string> }
  | { phase: "error"; message: string };

/** QZ-11: 다른 Show 선택 → 문항 체크(전체 또는 일부) → 현재 Show 끝에 추가 */
export function ImportFromShowDialog({ currentShowId, replacesBlank, busy, onClose, onConfirm }: Props) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    void listOtherShowsAction(currentShowId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { phase: "shows", shows: result.data } : { phase: "error", message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [currentShowId]);

  async function pickShow(show: PickerShow, shows: PickerShow[]) {
    setState({ phase: "questions", show, shows, questions: null, selected: new Set() });
    const result = await listShowQuestionsAction(show.id);
    if (!result.ok) {
      setState({ phase: "error", message: result.error });
      return;
    }
    setState({ phase: "questions", show, shows, questions: result.data, selected: new Set(result.data.map((q) => q.id)) });
  }

  function toggle(id: string) {
    if (state.phase !== "questions") return;
    const selected = new Set(state.selected);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    setState({ ...state, selected });
  }

  function toggleAll() {
    if (state.phase !== "questions" || !state.questions) return;
    const all = state.selected.size === state.questions.length;
    setState({ ...state, selected: all ? new Set() : new Set(state.questions.map((q) => q.id)) });
  }

  const selectedIds =
    state.phase === "questions" && state.questions ? state.questions.filter((q) => state.selected.has(q.id)).map((q) => q.id) : [];

  return (
    <Modal
      title={ko.importDialog.fromShowTitle}
      onClose={onClose}
      wide
      footer={
        state.phase === "questions" ? (
          <>
            <button
              type="button"
              onClick={() => setState({ phase: "shows", shows: state.shows })}
              className="min-h-11 rounded-lg px-4 font-medium text-neutral-600 hover:bg-neutral-100"
            >
              {ko.importDialog.back}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => onConfirm(state.show.id, selectedIds)}
              className="min-h-11 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {ko.importDialog.addButton(selectedIds.length)}
            </button>
          </>
        ) : undefined
      }
    >
      {state.phase === "loading" && <p className="text-neutral-500">{ko.importDialog.loadingQuestions}</p>}
      {state.phase === "error" && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}

      {state.phase === "shows" &&
        (state.shows.length === 0 ? (
          <p className="text-neutral-500">{ko.importDialog.noOtherShows}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{ko.importDialog.pickShow}</p>
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {state.shows.map((show) => (
                <li key={show.id}>
                  <button
                    type="button"
                    onClick={() => void pickShow(show, state.shows)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 text-left hover:border-brand-400 hover:bg-brand-50"
                  >
                    <span className="truncate font-medium">{show.title}</span>
                    <span className="shrink-0 text-sm text-neutral-500">{ko.shows.questionCount(show.question_count)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {state.phase === "questions" && (
        <div className="flex flex-col gap-3">
          <p className="font-semibold">{state.show.title}</p>
          {state.questions === null ? (
            <p className="text-neutral-500">{ko.importDialog.loadingQuestions}</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={state.selected.size === state.questions.length}
                    onChange={toggleAll}
                  />
                  {ko.importDialog.selectAll}
                </label>
                <span className="text-neutral-500">{ko.importDialog.selectedCount(selectedIds.length, state.questions.length)}</span>
              </div>
              <ol className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {state.questions.map((q, i) => (
                  <li key={q.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-neutral-50">
                      <input type="checkbox" className="size-4" checked={state.selected.has(q.id)} onChange={() => toggle(q.id)} />
                      <span className="w-6 shrink-0 text-sm font-bold text-neutral-500">{i + 1}</span>
                      <span className={`line-clamp-1 flex-1 text-sm ${q.question_text ? "" : "text-neutral-400"}`}>
                        {q.question_text || ko.editor.untitledQuestion}
                      </span>
                      {!q.complete && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-700">
                          {ko.importDialog.incompleteTag}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ol>
              {replacesBlank && selectedIds.length > 0 && <p className="text-sm text-neutral-600">{ko.importDialog.replacesBlank}</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
