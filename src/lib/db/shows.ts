import "server-only";

import { DbError } from "@/lib/db/errors";
import { createEmptyChoices } from "@/lib/quiz/choices";
import { DEFAULT_TIME_LIMIT_SEC, SHOW_TITLE_MAX } from "@/lib/quiz/constants";
import { getAdminClient } from "@/lib/supabase/admin";
import { TRASH_RETENTION_DAYS } from "@/lib/format";
import type { QuestionRow, ShowRow } from "@/types/db";
import type { ShowSettingsInput } from "@/lib/validation/show";

/**
 * Show 조회·저장(서버 전용). 로그인이 없으므로 모든 Show 가 대상이다(D-26).
 */

/** My Show 카드에 필요한 값(SH-02) */
export type ShowListItem = Pick<
  ShowRow,
  "id" | "title" | "description" | "thumbnail_url" | "is_complete" | "updated_at" | "deleted_at"
> & {
  question_count: number;
};

export type ShowWithQuestions = {
  show: ShowRow;
  questions: QuestionRow[];
};

function fail(error: { code?: string; message: string }): never {
  throw new DbError({ code: error.code ?? "", message: error.message });
}

const LIST_COLUMNS = "id, title, description, thumbnail_url, is_complete, updated_at, deleted_at, questions(count)";

type ListRow = Omit<ShowListItem, "question_count"> & { questions: { count: number }[] | null };

function toListItem(row: ListRow): ShowListItem {
  const { questions, ...rest } = row;
  return { ...rest, question_count: questions?.[0]?.count ?? 0 };
}

/** 휴지통에 없는 Show, 최근 수정 순 */
export async function listShows(): Promise<ShowListItem[]> {
  const { data, error } = await getAdminClient()
    .from("shows")
    .select(LIST_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) fail(error);
  return (data as unknown as ListRow[]).map(toListItem);
}

/** 휴지통(삭제 후 30일 이내만, SH-04), 최근 삭제 순 */
export async function listTrashedShows(now: Date = new Date()): Promise<ShowListItem[]> {
  const since = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getAdminClient()
    .from("shows")
    .select(LIST_COLUMNS)
    .not("deleted_at", "is", null)
    .gt("deleted_at", since)
    .order("deleted_at", { ascending: false });
  if (error) fail(error);
  return (data as unknown as ListRow[]).map(toListItem);
}

/** 편집·미리보기용. 휴지통에 있거나 없으면 null */
export async function getShowWithQuestions(id: string): Promise<ShowWithQuestions | null> {
  const db = getAdminClient();
  const { data: show, error } = await db.from("shows").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) fail(error);
  if (!show) return null;

  const { data: questions, error: qError } = await db
    .from("questions")
    .select("*")
    .eq("show_id", id)
    .order("order_index", { ascending: true });
  if (qError) fail(qError);

  return { show, questions: questions ?? [] };
}

/** 새 Show + 빈 문항 1개(문항은 항상 1개 이상 유지, QZ-01) */
export async function createShow(settings: ShowSettingsInput): Promise<string> {
  const db = getAdminClient();
  const { data, error } = await db.from("shows").insert(settings).select("id").single();
  if (error) fail(error);

  const { error: qError } = await db.from("questions").insert({
    show_id: data.id,
    order_index: 0,
    choices: createEmptyChoices(),
    time_limit_sec: DEFAULT_TIME_LIMIT_SEC,
  });
  if (qError) fail(qError);
  return data.id;
}

export async function updateShowSettings(id: string, settings: ShowSettingsInput): Promise<ShowRow> {
  const { data, error } = await getAdminClient()
    .from("shows")
    .update(settings)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) fail(error);
  return data;
}

export async function setShowComplete(id: string, isComplete: boolean): Promise<void> {
  const { error } = await getAdminClient().from("shows").update({ is_complete: isComplete }).eq("id", id);
  if (error) fail(error);
}

/** 복사본 제목: "원제목 (복사)" — 50자를 넘으면 원제목을 줄인다 */
export function copyTitle(title: string, suffix: string): string {
  const room = SHOW_TITLE_MAX - suffix.length;
  return `${title.slice(0, Math.max(0, room)).trimEnd()}${suffix}`;
}

/** Show 복사(SH-04): Show 와 문항을 통째로 복사. 새 id 반환 */
export async function copyShow(id: string, titleSuffix: string): Promise<string | null> {
  const source = await getShowWithQuestions(id);
  if (!source) return null;
  const db = getAdminClient();

  const { data, error } = await db
    .from("shows")
    .insert({
      title: copyTitle(source.show.title, titleSuffix),
      description: source.show.description,
      thumbnail_url: source.show.thumbnail_url,
      is_complete: source.show.is_complete,
    })
    .select("id")
    .single();
  if (error) fail(error);

  if (source.questions.length > 0) {
    const { error: qError } = await db.from("questions").insert(
      source.questions.map((q) => ({
        show_id: data.id,
        order_index: q.order_index,
        type: q.type,
        text_type: q.text_type,
        question_text: q.question_text,
        image_url: q.image_url,
        choices: q.choices,
        memo: q.memo,
        time_limit_sec: q.time_limit_sec,
        use_score: q.use_score,
        double_score: q.double_score,
      })),
    );
    if (qError) fail(qError);
  }
  return data.id;
}

/** 휴지통으로(SH-04) */
export async function trashShow(id: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("shows")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) fail(error);
}

export async function restoreShow(id: string): Promise<void> {
  const { error } = await getAdminClient().from("shows").update({ deleted_at: null }).eq("id", id);
  if (error) fail(error);
}

/** 완전삭제: 휴지통에 있는 것만. 문항은 함께 삭제, 회차·리포트는 유지(D-16) */
export async function deleteShowPermanently(id: string): Promise<void> {
  const { error } = await getAdminClient().from("shows").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) fail(error);
}
