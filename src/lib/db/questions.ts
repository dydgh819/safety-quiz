import "server-only";

import { DbError } from "@/lib/db/errors";
import { createEmptyChoices } from "@/lib/quiz/choices";
import { DEFAULT_TIME_LIMIT_SEC } from "@/lib/quiz/constants";
import { isShowComplete, isUntouchedQuestion } from "@/lib/quiz/validate";
import { getAdminClient } from "@/lib/supabase/admin";
import type { QuestionRow } from "@/types/db";
import type { QuestionUpdateInput } from "@/lib/validation/show";

/**
 * 문항 조회·저장(서버 전용). 순서(order_index)는 항상 0..n-1 로 다시 매긴다.
 * 구조 변경(추가·복사·삭제·순서)은 변경 후 전체 목록과 Show 완성 여부를 돌려준다.
 */

export type QuestionsResult = {
  questions: QuestionRow[];
  isComplete: boolean;
};

function fail(error: { code?: string; message: string }): never {
  throw new DbError({ code: error.code ?? "", message: error.message });
}

export async function listQuestions(showId: string): Promise<QuestionRow[]> {
  const { data, error } = await getAdminClient()
    .from("questions")
    .select("*")
    .eq("show_id", showId)
    .order("order_index", { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

/** 순서가 바뀐 문항만 order_index 를 고친다 */
async function writeOrder(ordered: readonly Pick<QuestionRow, "id" | "order_index">[]): Promise<void> {
  const db = getAdminClient();
  const changes = ordered
    .map((q, index) => ({ id: q.id, from: q.order_index, to: index }))
    .filter((c) => c.from !== c.to);
  const results = await Promise.all(
    changes.map((c) => db.from("questions").update({ order_index: c.to }).eq("id", c.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) fail(failed.error);
}

/**
 * 문항이 바뀐 뒤 Show 완성 표시를 맞춘다(QZ-09).
 * 완성된 Show 를 고쳐서 미완성이 되면 is_complete 를 끈다. 다시 완성하려면 '완성' 버튼을 누른다.
 */
export async function syncShowCompletion(showId: string, questions?: QuestionRow[]): Promise<QuestionsResult> {
  const db = getAdminClient();
  const list = questions ?? (await listQuestions(showId));
  const { data: show, error } = await db.from("shows").select("is_complete").eq("id", showId).single();
  if (error) fail(error);

  let isComplete = show.is_complete;
  if (isComplete && !isShowComplete(list)) {
    const { error: uError } = await db.from("shows").update({ is_complete: false }).eq("id", showId);
    if (uError) fail(uError);
    isComplete = false;
  }
  return { questions: list, isComplete };
}

async function assertQuestionInShow(showId: string, questionId: string): Promise<QuestionRow> {
  const { data, error } = await getAdminClient()
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .eq("show_id", showId)
    .maybeSingle();
  if (error) fail(error);
  if (!data) throw new DbError({ code: "NOT_FOUND", message: "question not found" });
  return data;
}

/** 빈 문항 추가: afterId 다음에(없으면 맨 끝) */
export async function addQuestion(showId: string, afterId: string | null): Promise<QuestionsResult & { newId: string }> {
  const list = await listQuestions(showId);
  const afterIndex = afterId ? list.findIndex((q) => q.id === afterId) : -1;
  const insertAt = afterIndex >= 0 ? afterIndex + 1 : list.length;

  const { data, error } = await getAdminClient()
    .from("questions")
    .insert({
      show_id: showId,
      order_index: insertAt,
      choices: createEmptyChoices(),
      time_limit_sec: DEFAULT_TIME_LIMIT_SEC,
    })
    .select("*")
    .single();
  if (error) fail(error);

  const ordered = [...list.slice(0, insertAt), data, ...list.slice(insertAt)];
  await writeOrder(ordered);
  return { ...(await syncShowCompletion(showId)), newId: data.id };
}

/** 문항 복사: 바로 다음 자리에 */
export async function duplicateQuestion(showId: string, questionId: string): Promise<QuestionsResult & { newId: string }> {
  const source = await assertQuestionInShow(showId, questionId);
  const list = await listQuestions(showId);
  const at = list.findIndex((q) => q.id === questionId) + 1;

  const { data, error } = await getAdminClient()
    .from("questions")
    .insert({
      show_id: showId,
      order_index: at,
      type: source.type,
      text_type: source.text_type,
      question_text: source.question_text,
      image_url: source.image_url,
      choices: source.choices,
      memo: source.memo,
      time_limit_sec: source.time_limit_sec,
      use_score: source.use_score,
      double_score: source.double_score,
    })
    .select("*")
    .single();
  if (error) fail(error);

  await writeOrder([...list.slice(0, at), data, ...list.slice(at)]);
  return { ...(await syncShowCompletion(showId)), newId: data.id };
}

/** 문항 삭제: 2개 이상일 때만(QZ-01) */
export async function deleteQuestion(showId: string, questionId: string): Promise<QuestionsResult | "lastQuestion"> {
  await assertQuestionInShow(showId, questionId);
  const list = await listQuestions(showId);
  if (list.length <= 1) return "lastQuestion";

  const { error } = await getAdminClient().from("questions").delete().eq("id", questionId);
  if (error) fail(error);

  await writeOrder(list.filter((q) => q.id !== questionId));
  return syncShowCompletion(showId);
}

/** 순서 변경(드래그). orderedIds 는 이 Show 의 문항 id 전체여야 한다 */
export async function reorderQuestions(showId: string, orderedIds: readonly string[]): Promise<QuestionsResult | "mismatch"> {
  const list = await listQuestions(showId);
  const byId = new Map(list.map((q) => [q.id, q]));
  if (orderedIds.length !== list.length || new Set(orderedIds).size !== list.length || orderedIds.some((id) => !byId.has(id))) {
    return "mismatch";
  }
  await writeOrder(orderedIds.map((id) => byId.get(id)!));
  return syncShowCompletion(showId);
}

/** 가져올 문항 내용(엑셀·다른 Show) */
export type QuestionContent = Pick<
  QuestionRow,
  "text_type" | "question_text" | "image_url" | "choices" | "memo" | "time_limit_sec" | "use_score" | "double_score"
>;

/**
 * 문항 여러 개를 Show 끝에 추가(QZ-10, QZ-11).
 * Show 에 아무것도 입력하지 않은 문항 1개만 있으면(새 Show) 그 문항은 지우고 추가한다.
 */
export async function appendQuestions(
  showId: string,
  contents: readonly QuestionContent[],
): Promise<(QuestionsResult & { newId: string; replacedBlank: boolean }) | "showNotFound" | "empty"> {
  if (contents.length === 0) return "empty";
  const db = getAdminClient();
  const { data: show, error: sError } = await db.from("shows").select("id").eq("id", showId).is("deleted_at", null).maybeSingle();
  if (sError) fail(sError);
  if (!show) return "showNotFound";

  const list = await listQuestions(showId);
  const replacedBlank = list.length === 1 && isUntouchedQuestion(list[0]);
  if (replacedBlank) {
    const { error } = await db.from("questions").delete().eq("id", list[0].id);
    if (error) fail(error);
  }
  const start = replacedBlank ? 0 : list.length;

  const { data, error } = await db
    .from("questions")
    .insert(contents.map((c, i) => ({ ...c, show_id: showId, order_index: start + i })))
    .select("id, order_index");
  if (error) fail(error);
  const first = [...data].sort((a, b) => a.order_index - b.order_index)[0];

  return { ...(await syncShowCompletion(showId)), newId: first.id, replacedBlank };
}

/** 다른 Show 의 문항 중 고른 것을 원래 순서대로 읽는다(QZ-11) */
export async function getQuestionsByIds(sourceShowId: string, ids: readonly string[]): Promise<QuestionRow[]> {
  const { data, error } = await getAdminClient()
    .from("questions")
    .select("*")
    .eq("show_id", sourceShowId)
    .in("id", [...ids])
    .order("order_index", { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

/** 문항 내용 저장(자동 저장) */
export async function updateQuestion(
  showId: string,
  questionId: string,
  input: QuestionUpdateInput,
): Promise<{ question: QuestionRow; isComplete: boolean }> {
  const { data, error } = await getAdminClient()
    .from("questions")
    .update(input)
    .eq("id", questionId)
    .eq("show_id", showId)
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  if (!data) throw new DbError({ code: "NOT_FOUND", message: "question not found" });

  const { isComplete } = await syncShowCompletion(showId);
  return { question: data, isComplete };
}
