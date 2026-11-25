import "server-only";

import type { PlayErrorCode } from "@/lib/api/play-api";

/** 폰 API 공통 응답 도우미. 캐시되지 않게 no-store */
const NO_STORE = { "Cache-Control": "no-store" };

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

const STATUS: Record<PlayErrorCode, number> = {
  invalidInput: 400,
  nicknameEmpty: 400,
  nicknameTooLong: 400,
  unauthorized: 401,
  kicked: 403,
  entryClosed: 403,
  lateJoinClosed: 403,
  closed: 409,
  late: 409,
  notFound: 404,
  deviceUsed: 409,
  nicknameTaken: 409,
  ended: 410,
  serverError: 500,
};

export function playError(error: PlayErrorCode, extra: { currentNickname?: string } = {}): Response {
  return json({ ok: false, error, ...extra }, STATUS[error]);
}
