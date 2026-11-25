"use server";

import { failure, ok, type ActionResult } from "@/lib/action-result";
import { getSession, kickParticipant, listLobbyParticipants, setEntryClosed, type LobbyParticipant } from "@/lib/db/sessions";
import { hasHostAccess } from "@/lib/host-key";
import { broadcastSessionEvent } from "@/lib/realtime/broadcast";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";
import type { SessionState } from "@/types/db";

/**
 * 발표 화면 Server Action. 모두 진행 키(D-27)를 확인한다.
 */

export type LobbySnapshot = {
  state: SessionState;
  entryClosed: boolean;
  participants: LobbyParticipant[];
};

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

/** 대기실 현황(방송 신호를 받거나 주기적으로 다시 읽는다) */
export async function getLobbyAction(sessionId: unknown): Promise<ActionResult<LobbySnapshot>> {
  return guard<LobbySnapshot>("getLobby", sessionId, async (id) => {
    const [session, participants] = await Promise.all([getSession(id), listLobbyParticipants(id)]);
    if (!session) return failure(ko.host.notFound);
    return ok({ state: session.state, entryClosed: session.entry_closed, participants });
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
