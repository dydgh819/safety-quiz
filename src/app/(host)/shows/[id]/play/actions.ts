"use server";

import { failure, ok, type ActionResult } from "@/lib/action-result";
import { createSession } from "@/lib/db/sessions";
import { setHostKeyCookie } from "@/lib/host-key";
import { uuidSchema } from "@/lib/validation/show";
import { playSettingsSchema } from "@/lib/validation/session";
import { ko } from "@/messages/ko";

/**
 * Play 시작(PL-01, JN-01): 회차 생성 → 진행 키를 이 브라우저 쿠키에 저장 → 발표 화면으로.
 * PRD 의 POST /api/sessions 를 교육자 화면 규칙(Server Action)에 맞춰 Action 으로 구현했다.
 */
export async function createSessionAction(showId: unknown, settings: unknown): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const id = uuidSchema.safeParse(showId);
    const parsed = playSettingsSchema.safeParse(settings);
    if (!id.success || !parsed.success) return failure(ko.errors.invalidInput);

    const result = await createSession(id.data, parsed.data);
    if (!result.ok) {
      if (result.reason === "showNotFound") return failure(ko.errors.showNotFound);
      if (result.reason === "showIncomplete") return failure(ko.playSettings.incomplete);
      return failure(ko.playSettings.pinExhausted);
    }
    await setHostKeyCookie(result.session.id, result.hostKey);
    return ok({ sessionId: result.session.id });
  } catch (error) {
    console.error("[action:createSession]", error);
    return failure(ko.errors.actionFailed);
  }
}
