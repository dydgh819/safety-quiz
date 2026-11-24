import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHOICE_SHAPES,
  DEFAULT_SESSION_OPTIONS,
  DEFAULT_TIME_LIMIT_SEC,
  MAX_CHOICES,
  TIME_LIMIT_OPTIONS,
  nearestTimeLimit,
} from "./constants";

const initSql = readFileSync(
  join(process.cwd(), "supabase/migrations/001_init.sql"),
  "utf8",
);

describe("퀴즈 상수", () => {
  it("기본 제한시간은 선택지 안에 있다", () => {
    expect(TIME_LIMIT_OPTIONS).toContain(DEFAULT_TIME_LIMIT_SEC);
  });

  it("제한시간 선택지는 DB check 제약과 같다", () => {
    const match = initSql.match(/time_limit_sec in \(([^)]+)\)/);
    expect(match).not.toBeNull();
    const dbValues = match![1].split(",").map((v) => Number(v.trim()));
    expect(dbValues).toEqual([...TIME_LIMIT_OPTIONS]);
  });

  it("보기 도형은 최대 보기 수만큼 있다", () => {
    expect(CHOICE_SHAPES).toHaveLength(MAX_CHOICES);
  });

  it("진행 옵션 기본값은 PRD 3.5 + D-05 와 같다", () => {
    expect(DEFAULT_SESSION_OPTIONS).toEqual({
      hide_leaderboard: false,
      show_choice_text: false,
      sound: true,
      allow_rejoin: true,
      use_submit_button: false,
      auto_advance: false,
      allow_late_join: true,
    });
  });
});

describe("nearestTimeLimit", () => {
  it.each([
    [20, 20],
    [1, 5],
    [7, 5], // 5와 10 사이에서 5에 더 가까움
    [8, 10],
    [15, 10], // 10과 20의 정중앙이면 짧은 쪽
    [45, 30],
    [46, 60],
    [100, 90],
    [500, 120],
    [-3, 5],
  ])("%d초 → %d초", (input, expected) => {
    expect(nearestTimeLimit(input)).toBe(expected);
  });
});
