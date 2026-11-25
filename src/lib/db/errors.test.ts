import { describe, expect, it } from "vitest";

import { DbError, classifyDbError, toDbErrorInfo } from "./errors";

describe("classifyDbError", () => {
  it.each([
    [{ code: "PGRST205", message: "Could not find the table 'public.shows' in the schema cache" }, "tablesMissing"],
    [{ code: "42P01", message: 'relation "public.shows" does not exist' }, "tablesMissing"],
    [{ code: "42501", message: "permission denied for table shows" }, "permissionDenied"],
    [{ code: "", message: "Invalid API key" }, "invalidKey"],
    [{ code: "PGRST301", message: "JWSError JWSInvalidSignature / JWT invalid" }, "invalidKey"],
    [{ code: "", message: "TypeError: fetch failed" }, "unreachable"],
    [{ code: "", message: "getaddrinfo ENOTFOUND xxx.supabase.co" }, "unreachable"],
    [{ code: "XX000", message: "something else" }, "unknown"],
  ] as const)("%o → %s", (info, expected) => {
    expect(classifyDbError(info)).toBe(expected);
  });
});

describe("toDbErrorInfo", () => {
  it("DbError 는 코드를 유지한다", () => {
    expect(toDbErrorInfo(new DbError({ code: "42501", message: "permission denied" }))).toEqual({
      code: "42501",
      message: "permission denied",
    });
  });

  it("일반 Error 와 문자열도 처리한다", () => {
    expect(toDbErrorInfo(new Error("boom"))).toEqual({ code: "", message: "boom" });
    expect(toDbErrorInfo("x")).toEqual({ code: "", message: "x" });
  });
});
