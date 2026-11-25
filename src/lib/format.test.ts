import { describe, expect, it } from "vitest";

import { formatDateTime, todayInSeoul, trashDaysLeft } from "./format";

describe("formatDateTime", () => {
  it("한국 시간으로 표시한다", () => {
    expect(formatDateTime("2026-11-25T05:03:00Z")).toContain("14:03");
    expect(formatDateTime("2026-11-25T05:03:00Z")).toContain("2026");
  });
});

describe("trashDaysLeft", () => {
  const now = new Date("2026-11-25T00:00:00Z");
  it("방금 지운 항목은 30일", () => {
    expect(trashDaysLeft("2026-11-25T00:00:00Z", now)).toBe(30);
  });
  it("29.5일 지나면 1일", () => {
    expect(trashDaysLeft("2026-10-26T12:00:00Z", now)).toBe(1);
  });
  it("30일 넘으면 0", () => {
    expect(trashDaysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
  });
});

describe("todayInSeoul", () => {
  it("UTC 15시 이후는 한국 다음 날", () => {
    expect(todayInSeoul(new Date("2026-11-24T14:59:00Z"))).toBe("2026-11-24");
    expect(todayInSeoul(new Date("2026-11-24T15:00:00Z"))).toBe("2026-11-25");
  });
});
