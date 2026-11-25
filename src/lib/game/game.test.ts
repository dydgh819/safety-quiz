import { describe, expect, it } from "vitest";

import type { QuestionRow } from "@/types/db";

import { decideJoin, type JoinContext } from "./join";
import { checkNickname, isSameNickname, normalizeNickname } from "./nickname";
import { generatePin, isValidPin } from "./pin";
import { createSecret, hashSecret, verifySecret } from "./secret";
import { toQuestionSnapshot } from "./snapshot";

describe("PIN", () => {
  it("6자리 숫자, 앞자리 0 유지", () => {
    expect(generatePin(() => 42)).toBe("000042");
    expect(generatePin(() => 999999)).toBe("999999");
    expect(isValidPin("012345")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12345a")).toBe(false);
  });
});

describe("비밀값", () => {
  it("해시로 확인하고, 다른 값·빈 값은 거부", () => {
    const secret = createSecret();
    const hash = hashSecret(secret);
    expect(hash).not.toContain(secret);
    expect(verifySecret(secret, hash)).toBe(true);
    expect(verifySecret(createSecret(), hash)).toBe(false);
    expect(verifySecret("", hash)).toBe(false);
    expect(verifySecret(secret, "")).toBe(false);
  });

  it("매번 다른 값", () => {
    expect(createSecret()).not.toBe(createSecret());
  });
});

describe("닉네임", () => {
  it("공백 정리", () => {
    expect(normalizeNickname("  홍   길동 ")).toBe("홍 길동");
  });
  it("길이(글자 수 기준)", () => {
    expect(checkNickname("")).toBe("empty");
    expect(checkNickname("가".repeat(20))).toBeNull();
    expect(checkNickname("가".repeat(21))).toBe("tooLong");
    expect(checkNickname("😀".repeat(20))).toBeNull(); // 이모지도 1자
  });
  it("대소문자 무시 비교", () => {
    expect(isSameNickname("Kim", "kim")).toBe(true);
    expect(isSameNickname("김", "김철수")).toBe(false);
  });
});

describe("입장 판정", () => {
  const base: JoinContext = { state: "lobby", entryClosed: false, allowLateJoin: true, participants: [] };
  const kim = { id: "p1", nickname: "Kim", device_id: "d1", kicked: false };

  it("새 참가자", () => {
    expect(decideJoin(base, "Lee", "d2")).toEqual({ kind: "new" });
  });

  it("같은 기기·같은 닉네임이면 재입장", () => {
    expect(decideJoin({ ...base, participants: [kim] }, "kim", "d1")).toEqual({ kind: "rejoin", participantId: "p1" });
  });

  it("같은 기기로 다른 닉네임 입장은 거부(JN-07)", () => {
    expect(decideJoin({ ...base, participants: [kim] }, "Lee", "d1")).toEqual({
      kind: "reject",
      reason: "deviceUsed",
      currentNickname: "Kim",
    });
  });

  it("다른 기기가 쓰는 닉네임은 거부(JN-06, 기기 교체 없음)", () => {
    expect(decideJoin({ ...base, participants: [kim] }, "KIM", "d2")).toEqual({ kind: "reject", reason: "nicknameTaken" });
  });

  it("강퇴된 기기는 재입장 불가, 닉네임을 바꿔도 불가", () => {
    const kicked = { ...kim, kicked: true };
    expect(decideJoin({ ...base, participants: [kicked] }, "Kim", "d1")).toEqual({ kind: "reject", reason: "kicked" });
    expect(decideJoin({ ...base, participants: [kicked] }, "Other", "d1")).toEqual({ kind: "reject", reason: "kicked" });
  });

  it("입장 마감 중에는 새 참가자만 거부, 기존 참가자 재입장은 허용(D-10)", () => {
    const closed = { ...base, entryClosed: true, participants: [kim] };
    expect(decideJoin(closed, "Lee", "d2")).toEqual({ kind: "reject", reason: "entryClosed" });
    expect(decideJoin(closed, "Kim", "d1").kind).toBe("rejoin");
  });

  it("시작 후에는 지각 입장 설정을 따른다", () => {
    expect(decideJoin({ ...base, state: "question" }, "Lee", "d2")).toEqual({ kind: "new" });
    expect(decideJoin({ ...base, state: "question", allowLateJoin: false }, "Lee", "d2")).toEqual({
      kind: "reject",
      reason: "lateJoinClosed",
    });
  });

  it("종료된 회차는 거부", () => {
    expect(decideJoin({ ...base, state: "ended", participants: [kim] }, "Kim", "d1")).toEqual({ kind: "reject", reason: "ended" });
  });
});

describe("문제 스냅샷", () => {
  const q = (id: string, order: number, overrides: Partial<QuestionRow> = {}): QuestionRow => ({
    id,
    show_id: "s",
    order_index: order,
    type: "choice",
    text_type: "short",
    question_text: id,
    image_url: null,
    choices: [{ id: 1, text: "a", image_url: null, is_correct: true }],
    memo: "비밀 메모",
    time_limit_sec: 20,
    use_score: true,
    double_score: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  });

  it("순서대로 0..n-1, 메모는 빼고, 점수 사용 Off면 2배도 Off", () => {
    const snap = toQuestionSnapshot([q("b", 5), q("a", 2, { use_score: false, double_score: true })]);
    expect(snap.map((s) => [s.id, s.order_index])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(snap[0].double_score).toBe(false);
    expect(JSON.stringify(snap)).not.toContain("비밀 메모");
  });

  it("원본 보기를 바꿔도 스냅샷은 그대로", () => {
    const source = q("a", 0);
    const snap = toQuestionSnapshot([source]);
    source.choices[0].text = "changed";
    expect(snap[0].choices[0].text).toBe("a");
  });
});
