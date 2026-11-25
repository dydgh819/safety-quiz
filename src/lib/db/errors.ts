/**
 * Supabase(PostgREST) 오류를 원인별로 분류한다. 화면 안내용 순수 함수.
 * 오류 메시지에는 키 값이 들어가지 않으므로 코드·메시지를 화면에 보여줘도 된다.
 */

export type DbErrorKind =
  | "tablesMissing" // SQL(001·002)을 실행하지 않음
  | "permissionDenied" // service_role 이 아닌 키를 넣었거나 권한 부족
  | "invalidKey" // 키 값이 틀림
  | "unreachable" // URL 이 틀렸거나 네트워크 문제
  | "unknown";

export type DbErrorInfo = {
  code: string;
  message: string;
};

export class DbError extends Error {
  readonly code: string;
  constructor(info: DbErrorInfo) {
    super(info.message);
    this.name = "DbError";
    this.code = info.code;
  }
}

export function classifyDbError(info: DbErrorInfo): DbErrorKind {
  const code = info.code.toUpperCase();
  const msg = info.message.toLowerCase();

  if (code === "PGRST205" || code === "42P01" || msg.includes("could not find the table") || msg.includes("does not exist")) {
    return "tablesMissing";
  }
  if (code === "42501" || msg.includes("permission denied")) {
    return "permissionDenied";
  }
  if (msg.includes("invalid api key") || msg.includes("no api key") || msg.includes("jwt") || msg.includes("unauthorized")) {
    return "invalidKey";
  }
  if (msg.includes("fetch failed") || msg.includes("enotfound") || msg.includes("getaddrinfo") || msg.includes("econnrefused") || msg.includes("network")) {
    return "unreachable";
  }
  return "unknown";
}

/** 알 수 없는 예외를 DbErrorInfo 로 */
export function toDbErrorInfo(error: unknown): DbErrorInfo {
  if (error instanceof DbError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: "", message: error.message };
  return { code: "", message: String(error) };
}
