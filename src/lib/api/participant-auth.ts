import "server-only";

import type { NextRequest } from "next/server";

import { authenticateParticipant } from "@/lib/db/sessions";
import { uuidSchema } from "@/lib/validation/show";
import {
  PARTICIPANT_ID_HEADER,
  PARTICIPANT_TOKEN_HEADER,
  participantCredentialsSchema,
} from "@/lib/validation/session";
import type { ParticipantRow } from "@/types/db";

/** 폰 요청의 참가자 확인(재접속 토큰). 실패 이유를 코드로 돌려준다 */
export async function authenticateRequest(
  request: NextRequest,
  sessionId: string,
): Promise<{ ok: true; participant: ParticipantRow } | { ok: false; error: "unauthorized" | "kicked" }> {
  const credentials = participantCredentialsSchema.safeParse({
    participantId: request.headers.get(PARTICIPANT_ID_HEADER),
    token: request.headers.get(PARTICIPANT_TOKEN_HEADER),
  });
  if (!uuidSchema.safeParse(sessionId).success || !credentials.success) return { ok: false, error: "unauthorized" };
  const participant = await authenticateParticipant(sessionId, credentials.data.participantId, credentials.data.token);
  if (!participant) return { ok: false, error: "unauthorized" };
  if (participant.kicked) return { ok: false, error: "kicked" };
  return { ok: true, participant };
}
