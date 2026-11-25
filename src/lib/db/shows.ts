import "server-only";

import { DbError } from "@/lib/db/errors";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ShowRow } from "@/types/db";

/** My Show 목록 카드에 필요한 값(SH-02) */
export type ShowListItem = Pick<
  ShowRow,
  "id" | "title" | "thumbnail_url" | "is_complete" | "updated_at"
> & {
  question_count: number;
};

/** 휴지통에 없는 Show 를 최근 수정 순으로. 로그인이 없으므로 모든 Show 가 대상(D-26). */
export async function listShows(): Promise<ShowListItem[]> {
  const { data, error } = await getAdminClient()
    .from("shows")
    .select("id, title, thumbnail_url, is_complete, updated_at, questions(count)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new DbError({ code: error.code ?? "", message: error.message });

  return (data ?? []).map((row) => {
    const counts = row.questions as { count: number }[] | null;
    return {
      id: row.id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      is_complete: row.is_complete,
      updated_at: row.updated_at,
      question_count: counts?.[0]?.count ?? 0,
    };
  });
}
