import type { PlayType, SessionState } from "@/types/db";

/**
 * 폰(피교육자) API 의 요청·응답 형식. 서버(route.ts)와 폰 화면이 함께 쓴다.
 * 오류는 한국어 문구 대신 코드로 돌려주고, 화면에서 ko.ts 문구로 바꾼다.
 *
 * 절대 규칙 3: 여기 응답에는 정답(is_correct)을 절대 넣지 않는다.
 */

export type PlayErrorCode =
  | "invalidInput"
  | "notFound"
  | "ended"
  | "kicked"
  | "deviceUsed"
  | "nicknameTaken"
  | "nicknameEmpty"
  | "nicknameTooLong"
  | "entryClosed"
  | "lateJoinClosed"
  | "unauthorized"
  | "serverError";

export type PlayError = { ok: false; error: PlayErrorCode; currentNickname?: string };

/** GET /api/sessions/by-pin/[pin] */
export type PinLookupResponse =
  | { ok: true; sessionId: string; eduTitle: string; state: SessionState; entryClosed: boolean }
  | PlayError;

/** POST /api/sessions/[id]/join */
export type JoinResponse =
  | { ok: true; participantId: string; nickname: string; token: string; rejoined: boolean }
  | PlayError;

/** GET /api/sessions/[id]/state (헤더: x-participant-id, x-participant-token) — 4단계: 대기실 정보까지 */
export type PhoneStateResponse =
  | {
      ok: true;
      serverTime: string;
      session: {
        id: string;
        eduTitle: string;
        state: SessionState;
        playType: PlayType;
        totalQuestions: number;
        participantCount: number;
      };
      me: { id: string; nickname: string; joinedAt: string };
    }
  | PlayError;
