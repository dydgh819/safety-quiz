"use server";

import { z } from "zod";

import { failure, ok, type ActionResult } from "@/lib/action-result";
import { appendQuestions, getQuestionsByIds, listQuestions, type QuestionsResult } from "@/lib/db/questions";
import { listShows, type ShowListItem } from "@/lib/db/shows";
import { MAX_IMPORT_ROWS } from "@/lib/excel/question-import";
import { readPublicEnv } from "@/lib/env";
import { isQuestionComplete } from "@/lib/quiz/validate";
import { makeQuestionUpdateSchema, uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/**
 * 문제 가져오기 Server Action: 엑셀 일괄 등록(QZ-10), 다른 Show 에서 불러오기(QZ-11).
 * 엑셀은 브라우저에서 파싱하므로, 서버는 받은 문항을 다시 검사하고 **완성된 문항만** 받는다.
 */

type AppendResult = QuestionsResult & { newId: string; replacedBlank: boolean };

async function run<T>(label: string, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    console.error(`[action:${label}]`, error);
    return failure(ko.errors.actionFailed);
  }
}

function appendFailure(result: "showNotFound" | "empty") {
  return failure(result === "showNotFound" ? ko.errors.showNotFound : ko.excel.errors.noRows);
}

/** 엑셀에서 읽은 완성 문항들을 Show 끝에 추가 */
export async function importQuestionsAction(showId: unknown, questions: unknown): Promise<ActionResult<AppendResult>> {
  return run<AppendResult>("importQuestions", async () => {
    const id = uuidSchema.safeParse(showId);
    const schema = z.array(makeQuestionUpdateSchema(readPublicEnv()?.supabaseUrl ?? "")).min(1).max(MAX_IMPORT_ROWS);
    const parsed = schema.safeParse(questions);
    if (!id.success || !parsed.success) return failure(ko.errors.invalidInput);
    // 엑셀로는 이미지를 넣지 않는다 + 완성된 문항만
    if (parsed.data.some((q) => q.image_url || q.choices.some((c) => c.image_url) || !isQuestionComplete(q))) {
      return failure(ko.errors.invalidInput);
    }
    const result = await appendQuestions(id.data, parsed.data);
    return typeof result === "string" ? appendFailure(result) : ok(result);
  });
}

export type PickerShow = Pick<ShowListItem, "id" | "title" | "question_count" | "is_complete">;

/** 불러올 수 있는 다른 Show 목록(휴지통 제외, 현재 Show 제외) */
export async function listOtherShowsAction(currentShowId: unknown): Promise<ActionResult<PickerShow[]>> {
  return run<PickerShow[]>("listOtherShows", async () => {
    const shows = await listShows();
    return ok(
      shows
        .filter((s) => s.id !== currentShowId && s.question_count > 0)
        .map(({ id, title, question_count, is_complete }) => ({ id, title, question_count, is_complete })),
    );
  });
}

export type PickerQuestion = { id: string; question_text: string; complete: boolean };

/** 다른 Show 의 문항 목록(선택용 요약) */
export async function listShowQuestionsAction(showId: unknown): Promise<ActionResult<PickerQuestion[]>> {
  return run<PickerQuestion[]>("listShowQuestions", async () => {
    const id = uuidSchema.safeParse(showId);
    if (!id.success) return failure(ko.errors.invalidInput);
    const questions = await listQuestions(id.data);
    return ok(questions.map((q) => ({ id: q.id, question_text: q.question_text, complete: isQuestionComplete(q) })));
  });
}

/** 다른 Show 에서 고른 문항을 복사해 현재 Show 끝에 추가(이미지 URL 도 그대로 복사) */
export async function copyQuestionsFromShowAction(
  targetShowId: unknown,
  sourceShowId: unknown,
  questionIds: unknown,
): Promise<ActionResult<AppendResult>> {
  return run<AppendResult>("copyQuestionsFromShow", async () => {
    const target = uuidSchema.safeParse(targetShowId);
    const source = uuidSchema.safeParse(sourceShowId);
    const ids = z.array(uuidSchema).min(1).max(MAX_IMPORT_ROWS).safeParse(questionIds);
    if (!target.success || !source.success || !ids.success || target.data === source.data) {
      return failure(ko.errors.invalidInput);
    }
    const picked = await getQuestionsByIds(source.data, ids.data);
    if (picked.length === 0) return failure(ko.errors.staleData);
    const result = await appendQuestions(
      target.data,
      picked.map((q) => ({
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
    return typeof result === "string" ? appendFailure(result) : ok(result);
  });
}
