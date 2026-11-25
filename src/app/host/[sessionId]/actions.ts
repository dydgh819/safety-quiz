"use server";

import { failure, ok, type ActionResult } from "@/lib/action-result";
import { advanceSession, loadGameData } from "@/lib/db/game";
import { kickParticipant, setEntryClosed } from "@/lib/db/sessions";
import { buildHostView, questionProgress, type HostView } from "@/lib/game/views";
import { hasHostAccess } from "@/lib/host-key";
import { broadcastSessionEvent } from "@/lib/realtime/broadcast";
import { uuidSchema } from "@/lib/validation/show";
import { advanceRequestSchema } from "@/lib/validation/session";
import { ko } from "@/messages/ko";

/**
 * 발표 화면 Server Action. 모두 진행 키(D-27)를 먼저 확인한다.
 */

async function guard<T>(label: string, sessionId: unknown, work: (id: string) => Promise<ActionResult<T>>) {
  try {
    const id = uuidSchema.safeParse(sessionId);
    if (!id.success) return failure(ko.errors.invalidInput);
    if (!(await hasHostAccess(id.data))) return failure(ko.host.noAccessTitle);
    return await work(id.data);
  } catch (error) {
    console.error(`[action:${label}]`, error);
    return failure(ko.host.actionFailed);
  }
}

/** 발표 화면 전체 데이터(새로고침·다른 PC 복구 PL-10, 방송 신호 후 다시 읽기) */
export async function getHostViewAction(sessionId: unknown): Promise<ActionResult<HostView>> {
  return guard<HostView>("getHostView", sessionId, async (id) => {
    const data = await loadGameData(id);
    if (!data) return failure(ko.host.notFound);
    return ok(buildHostView(data, new Date()));
  });
}

/** 문제 진행 중 응답 현황(0.5초마다, D-20) */
export async function getProgressAction(sessionId: unknown): Promise<ActionResult<{ answered: number; active: number }>> {
  return guard<{ answered: number; active: number }>("getProgress", sessionId, async (id) => {
    const data = await loadGameData(id);
    if (!data) return failure(ko.host.notFound);
    return ok(questionProgress(data, new Date()));
  });
}

/**
 * 다음 단계로(PL-02·03·05). expected = 화면이 알고 있는 현재 위치.
 * 이미 다른 요청이 넘겼으면 바꾸지 않고 최신 화면 데이터만 돌려준다(중복 클릭·자동 진행 안전).
 */
export async function advanceAction(sessionId: unknown, expected: unknown): Promise<ActionResult<HostView>> {
  return guard<HostView>("advance", sessionId, async (id) => {
    const position = advanceRequestSchema.safeParse(expected);
    if (!position.success) return failure(ko.errors.invalidInput);

    const result = await advanceSession(id, position.data);
    if (result.applied && result.session) {
      await broadcastSessionEvent(id, "state_changed", {
        state: result.session.state,
        qIndex: result.session.current_q_index,
      });
    }
    const data = await loadGameData(id);
    if (!data) return failure(ko.host.notFound);
    return ok(buildHostView(data, new Date()));
  });
}

/** 강퇴(JN-08) */
export async function kickParticipantAction(sessionId: unknown, participantId: unknown): Promise<ActionResult> {
  return guard<undefined>("kickParticipant", sessionId, async (id) => {
    const pid = uuidSchema.safeParse(participantId);
    if (!pid.success) return failure(ko.errors.invalidInput);
    if (await kickParticipant(id, pid.data)) {
      await broadcastSessionEvent(id, "participant_kicked", { participantId: pid.data });
    }
    return ok(undefined);
  });
}

/** 입장 마감/재개(D-10) */
export async function setEntryClosedAction(sessionId: unknown, closed: unknown): Promise<ActionResult> {
  return guard<undefined>("setEntryClosed", sessionId, async (id) => {
    if (typeof closed !== "boolean") return failure(ko.errors.invalidInput);
    await setEntryClosed(id, closed);
    await broadcastSessionEvent(id, "lobby_changed", {});
    return ok(undefined);
  });
}
