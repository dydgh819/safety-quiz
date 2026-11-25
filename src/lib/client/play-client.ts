import type { JoinResponse, PhoneStateResponse, PinLookupResponse, PlayErrorCode } from "@/lib/api/play-api";
import { PARTICIPANT_ID_HEADER, PARTICIPANT_TOKEN_HEADER } from "@/lib/validation/session";

import type { StoredCredentials } from "./participant-storage";

/**
 * 폰 화면 → 서버 API 호출(피교육자는 DB 에 직접 쓰지 않는다, 절대 규칙 2).
 * 네트워크 오류는 { ok:false, error:'network' } 로 돌려준다.
 */

export type NetworkError = { ok: false; error: "network" };
export type ClientErrorCode = PlayErrorCode | "network";

async function request<T>(url: string, init?: RequestInit): Promise<T | NetworkError> {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    return (await response.json()) as T;
  } catch {
    return { ok: false, error: "network" };
  }
}

export function lookupPin(pin: string) {
  return request<PinLookupResponse>(`/api/sessions/by-pin/${encodeURIComponent(pin)}`);
}

export function joinSession(sessionId: string, nickname: string, deviceId: string) {
  return request<JoinResponse>(`/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, deviceId }),
  });
}

export function fetchPhoneState(sessionId: string, credentials: StoredCredentials) {
  return request<PhoneStateResponse>(`/api/sessions/${sessionId}/state`, {
    headers: {
      [PARTICIPANT_ID_HEADER]: credentials.participantId,
      [PARTICIPANT_TOKEN_HEADER]: credentials.token,
    },
  });
}
