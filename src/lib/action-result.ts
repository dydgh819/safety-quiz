/** Server Action 공통 결과. error 는 화면에 그대로 보여줄 한국어 문구(ko.ts) */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
