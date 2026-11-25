"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId } from "react";

import { isQuestionComplete } from "@/lib/quiz/validate";
import { ko } from "@/messages/ko";
import type { QuestionRow } from "@/types/db";

type Props = {
  questions: QuestionRow[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
};

/** A4 좌측: 문제 썸네일 목록(번호·앞부분·미완성 경고), 추가·복사·삭제, 드래그 순서 변경(QZ-01) */
export function QuestionList({ questions, selectedId, busy, onSelect, onAdd, onDuplicate, onDelete, onReorder }: Props) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  }

  const canDelete = questions.length >= 2;

  return (
    <div className="flex h-full flex-col">
      <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-neutral-500">
        {ko.editor.listTitle} <span className="text-neutral-400">{questions.length}</span>
      </h2>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
            {questions.map((q, index) => (
              <SortableItem
                key={q.id}
                question={q}
                index={index}
                selected={q.id === selectedId}
                busy={busy}
                canDelete={canDelete}
                onSelect={() => onSelect(q.id)}
                onDuplicate={() => onDuplicate(q.id)}
                onDelete={() => onDelete(q.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="border-t border-neutral-200 p-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="min-h-11 w-full rounded-lg border-2 border-dashed border-brand-300 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          {ko.editor.addQuestion}
        </button>
      </div>
    </div>
  );
}

function SortableItem({
  question,
  index,
  selected,
  busy,
  canDelete,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  question: QuestionRow;
  index: number;
  selected: boolean;
  busy: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: busy,
  });
  const complete = isQuestionComplete(question);
  const excerpt = question.question_text.trim();

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group rounded-lg border bg-white ${
        selected ? "border-brand-500 ring-2 ring-brand-200" : "border-neutral-200 hover:border-neutral-300"
      } ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={ko.editor.dragHandle}
          className="flex w-7 shrink-0 cursor-grab items-center justify-center rounded-l-lg text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 py-2 pr-2 text-left">
          <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-500">
            {index + 1}
            {!complete && (
              <span title={ko.editor.incompleteMark} aria-label={ko.editor.incompleteMark} className="text-amber-600">
                ⚠
              </span>
            )}
            <span className="ml-auto font-normal">{ko.editor.seconds(question.time_limit_sec)}</span>
          </span>
          <span className={`mt-0.5 line-clamp-2 text-sm ${excerpt ? "text-neutral-800" : "text-neutral-400"}`}>
            {excerpt || ko.editor.untitledQuestion}
          </span>
        </button>
      </div>
      {selected && (
        <div className="flex gap-1 border-t border-neutral-100 px-2 py-1.5">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={busy}
            className="min-h-8 flex-1 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            {ko.editor.copyQuestion}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="min-h-8 flex-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {ko.editor.deleteQuestion}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
