"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";

import { failure, ok, type ActionResult } from "@/lib/action-result";
import {
  addQuestion,
  deleteQuestion,
  duplicateQuestion,
  listQuestions,
  reorderQuestions,
  updateQuestion,
  type QuestionsResult,
} from "@/lib/db/questions";
import {
  copyShow,
  createShow,
  deleteShowPermanently,
  restoreShow,
  setShowComplete,
  trashShow,
  updateShowSettings,
} from "@/lib/db/shows";
import { readPublicEnv } from "@/lib/env";
import { findFirstIncomplete, validateQuestion, type QuestionIssue } from "@/lib/quiz/validate";
import { MAX_UPLOAD_BYTES, MEDIA_BUCKET, extensionFor } from "@/lib/storage";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  makeQuestionUpdateSchema,
  makeShowSettingsSchema,
  uploadRequestSchema,
  uuidSchema,
} from "@/lib/validation/show";
import { ko } from "@/messages/ko";
import type { QuestionRow, ShowRow } from "@/types/db";

/**
 * Show·문항 Server Action. 로그인이 없으므로(D-26) 권한 검사는 없고, 모든 입력은 zod 로 다시 검사한다.
 * 목록 화면에 영향을 주는 작업은 refresh() 로 화면을 갱신한다.
 * 자동 저장처럼 편집기 안에서만 쓰는 작업은 결과 데이터를 돌려주고 refresh 하지 않는다(편집 중 화면 재렌더 방지).
 */

function supabaseUrl(): string {
  return readPublicEnv()?.supabaseUrl ?? "";
}

async function run<T>(label: string, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    console.error(`[action:${label}]`, error);
    return failure(ko.errors.actionFailed);
  }
}

function parseId(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Show
// ---------------------------------------------------------------------------

export async function createShowAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run("createShow", async () => {
    const parsed = makeShowSettingsSchema(supabaseUrl()).safeParse(input);
    if (!parsed.success) return failure(ko.errors.invalidInput);
    const id = await createShow(parsed.data);
    refresh();
    return ok({ id });
  });
}

export async function updateShowSettingsAction(showId: unknown, input: unknown): Promise<ActionResult<ShowRow>> {
  return run("updateShowSettings", async () => {
    const id = parseId(showId);
    const parsed = makeShowSettingsSchema(supabaseUrl()).safeParse(input);
    if (!id || !parsed.success) return failure(ko.errors.invalidInput);
    const show = await updateShowSettings(id, parsed.data);
    refresh();
    return ok(show);
  });
}

export async function copyShowAction(showId: unknown): Promise<ActionResult<{ id: string }>> {
  return run("copyShow", async () => {
    const id = parseId(showId);
    if (!id) return failure(ko.errors.invalidInput);
    const newId = await copyShow(id, ko.shows.copySuffix);
    if (!newId) return failure(ko.errors.showNotFound);
    refresh();
    return ok({ id: newId });
  });
}

export async function trashShowAction(showId: unknown): Promise<ActionResult> {
  return run("trashShow", async () => {
    const id = parseId(showId);
    if (!id) return failure(ko.errors.invalidInput);
    await trashShow(id);
    refresh();
    return ok(undefined);
  });
}

export async function restoreShowAction(showId: unknown): Promise<ActionResult> {
  return run("restoreShow", async () => {
    const id = parseId(showId);
    if (!id) return failure(ko.errors.invalidInput);
    await restoreShow(id);
    refresh();
    return ok(undefined);
  });
}

export async function deleteShowPermanentlyAction(showId: unknown): Promise<ActionResult> {
  return run("deleteShowPermanently", async () => {
    const id = parseId(showId);
    if (!id) return failure(ko.errors.invalidInput);
    await deleteShowPermanently(id);
    refresh();
    return ok(undefined);
  });
}

/** '완성' 버튼(QZ-09): 서버에서 다시 검증. 미완성이면 첫 미완성 문항과 이유를 돌려준다 */
type CompleteResult = { complete: true } | { complete: false; questionId: string | null; issues: QuestionIssue[] };

export async function completeShowAction(showId: unknown): Promise<ActionResult<CompleteResult>> {
  return run<CompleteResult>("completeShow", async () => {
    const id = parseId(showId);
    if (!id) return failure(ko.errors.invalidInput);
    const questions = await listQuestions(id);
    if (questions.length === 0) return ok({ complete: false, questionId: null, issues: [] });

    const index = findFirstIncomplete(questions);
    if (index >= 0) {
      return ok({ complete: false, questionId: questions[index].id, issues: validateQuestion(questions[index]) });
    }
    await setShowComplete(id, true);
    return ok({ complete: true });
  });
}

// ---------------------------------------------------------------------------
// 문항
// ---------------------------------------------------------------------------

export async function addQuestionAction(
  showId: unknown,
  afterId: unknown,
): Promise<ActionResult<QuestionsResult & { newId: string }>> {
  return run("addQuestion", async () => {
    const id = parseId(showId);
    const after = afterId === null ? null : parseId(afterId);
    if (!id || (afterId !== null && !after)) return failure(ko.errors.invalidInput);
    return ok(await addQuestion(id, after));
  });
}

export async function duplicateQuestionAction(
  showId: unknown,
  questionId: unknown,
): Promise<ActionResult<QuestionsResult & { newId: string }>> {
  return run("duplicateQuestion", async () => {
    const id = parseId(showId);
    const qid = parseId(questionId);
    if (!id || !qid) return failure(ko.errors.invalidInput);
    return ok(await duplicateQuestion(id, qid));
  });
}

export async function deleteQuestionAction(showId: unknown, questionId: unknown): Promise<ActionResult<QuestionsResult>> {
  return run("deleteQuestion", async () => {
    const id = parseId(showId);
    const qid = parseId(questionId);
    if (!id || !qid) return failure(ko.errors.invalidInput);
    const result = await deleteQuestion(id, qid);
    if (result === "lastQuestion") return failure(ko.editor.cannotDeleteLast);
    return ok(result);
  });
}

export async function reorderQuestionsAction(showId: unknown, orderedIds: unknown): Promise<ActionResult<QuestionsResult>> {
  return run("reorderQuestions", async () => {
    const id = parseId(showId);
    const ids = Array.isArray(orderedIds) ? orderedIds.map(parseId) : null;
    if (!id || !ids || ids.some((x) => x === null)) return failure(ko.errors.invalidInput);
    const result = await reorderQuestions(id, ids as string[]);
    if (result === "mismatch") return failure(ko.errors.staleData);
    return ok(result);
  });
}

export async function saveQuestionAction(
  showId: unknown,
  questionId: unknown,
  input: unknown,
): Promise<ActionResult<{ question: QuestionRow; isComplete: boolean }>> {
  return run("saveQuestion", async () => {
    const id = parseId(showId);
    const qid = parseId(questionId);
    const parsed = makeQuestionUpdateSchema(supabaseUrl()).safeParse(input);
    if (!id || !qid || !parsed.success) return failure(ko.errors.invalidInput);
    return ok(await updateQuestion(id, qid, parsed.data));
  });
}

// ---------------------------------------------------------------------------
// 이미지 업로드: 서명 업로드 URL 발급(브라우저는 이 토큰으로만 업로드 가능)
// ---------------------------------------------------------------------------

export async function createUploadUrlAction(
  request: unknown,
): Promise<ActionResult<{ path: string; token: string; publicUrl: string }>> {
  return run("createUploadUrl", async () => {
    const parsed = uploadRequestSchema.safeParse(request);
    if (!parsed.success) return failure(ko.errors.invalidInput);
    if (parsed.data.size > MAX_UPLOAD_BYTES) return failure(ko.upload.tooLarge);

    const path = `${parsed.data.kind}/${randomUUID()}.${extensionFor(parsed.data.contentType)}`;
    const bucket = getAdminClient().storage.from(MEDIA_BUCKET);
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error) {
      console.error("[action:createUploadUrl]", error);
      return failure(ko.upload.failed);
    }
    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    return ok({ path: data.path, token: data.token, publicUrl });
  });
}
