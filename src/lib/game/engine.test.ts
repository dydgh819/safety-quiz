import { describe, expect, it } from "vitest";

import type { QuestionSnapshot } from "@/types/db";

import { toPhoneQuestion } from "./phone-view";
import { computeQuestionResult } from "./results";
import {
  calculateScore,
  computeLeaderboard,
  computeStandings,
  correctChoiceIds,
  isAnswerCorrect,
  type RankAnswer,
  type RankParticipant,
} from "./scoring";
import { COUNTDOWN_MS, nextPosition, revealedUpTo, timingFor, type GamePosition } from "./state-machine";

const opts = { hideLeaderboard: false };

/** 처음부터 끝까지 nextPosition 을 따라간 경로 */
function walk(total: number, hideLeaderboard = false): string[] {
  const path: string[] = [];
  let pos: GamePosition | null = { state: "lobby", qIndex: null };
  while (pos) {
    path.push(pos.qIndex === null ? pos.state : `${pos.state}${pos.qIndex}`);
    pos = nextPosition(pos, total, { hideLeaderboard });
  }
  return path;
}

describe("상태 머신", () => {
  it("2문항: 마지막 문제는 reveal 다음 바로 final(D-06)", () => {
    expect(walk(2)).toEqual([
      "lobby",
      "countdown0",
      "question0",
      "reveal0",
      "leaderboard0",
      "countdown1",
      "question1",
      "reveal1",
      "final1",
      "ended1",
    ]);
  });

  it("1문항", () => {
    expect(walk(1)).toEqual(["lobby", "countdown0", "question0", "reveal0", "final0", "ended0"]);
  });

  it("랭킹 화면 비노출이면 leaderboard 를 건너뛴다", () => {
    expect(walk(2, true)).toEqual(["lobby", "countdown0", "question0", "reveal0", "countdown1", "question1", "reveal1", "final1", "ended1"]);
  });

  it("문항이 없으면 시작할 수 없고, ended 다음은 없다", () => {
    expect(nextPosition({ state: "lobby", qIndex: null }, 0, opts)).toBeNull();
    expect(nextPosition({ state: "ended", qIndex: 3 }, 4, opts)).toBeNull();
  });

  it("시각: 예고 3초, 문제는 제한시간, 종료는 ended_at", () => {
    const now = new Date("2026-11-25T00:00:00.000Z");
    expect(timingFor({ state: "countdown", qIndex: 0 }, now, 20)).toEqual({
      q_started_at: "2026-11-25T00:00:00.000Z",
      q_ends_at: new Date(now.getTime() + COUNTDOWN_MS).toISOString(),
    });
    expect(timingFor({ state: "question", qIndex: 0 }, now, 20).q_ends_at).toBe("2026-11-25T00:00:20.000Z");
    expect(timingFor({ state: "reveal", qIndex: 0 }, now, 20)).toEqual({});
    expect(timingFor({ state: "ended", qIndex: 0 }, now, 20)).toEqual({ ended_at: now.toISOString() });
  });

  it("공개된 문제 범위: 문제 진행 중에는 이전 문제까지만", () => {
    expect(revealedUpTo({ state: "lobby", qIndex: null }, 5)).toBe(-1);
    expect(revealedUpTo({ state: "question", qIndex: 2 }, 5)).toBe(1);
    expect(revealedUpTo({ state: "reveal", qIndex: 2 }, 5)).toBe(2);
    expect(revealedUpTo({ state: "final", qIndex: 4 }, 5)).toBe(4);
  });
});

describe("점수 공식(PRD 5.4)", () => {
  const base = { correct: true, timeLimitSec: 20, useScore: true, doubleScore: false };
  it.each([
    [0, 1000],
    [4000, 900], // PRD 예시: 20초 문제를 4초에 맞히면 900점
    [10000, 750],
    [20000, 500], // 끝날 때 맞히면 500점
    [20400, 500], // 유예 0.5초 안 제출도 500점(t ≤ T, D-12)
    [-50, 1000],
    [1234, 969], // round(1000 × (1 − 1.234/40)) = round(969.15)
  ])("20초 문제 %dms → %d점", (elapsedMs, expected) => {
    expect(calculateScore({ ...base, elapsedMs })).toBe(expected);
  });

  it("오답·점수 사용 Off는 0점, 2배는 2배", () => {
    expect(calculateScore({ ...base, elapsedMs: 4000, correct: false })).toBe(0);
    expect(calculateScore({ ...base, elapsedMs: 4000, useScore: false })).toBe(0);
    expect(calculateScore({ ...base, elapsedMs: 4000, doubleScore: true })).toBe(1800);
  });

  it("복수정답은 완전히 같을 때만 정답", () => {
    const correct = correctChoiceIds([
      { id: 1, is_correct: true },
      { id: 2, is_correct: false },
      { id: 3, is_correct: true },
    ]);
    expect(correct).toEqual([1, 3]);
    expect(isAnswerCorrect([3, 1], correct)).toBe(true);
    expect(isAnswerCorrect([1], correct)).toBe(false); // 빠짐
    expect(isAnswerCorrect([1, 2, 3], correct)).toBe(false); // 오답 포함
    expect(isAnswerCorrect([], correct)).toBe(false);
    expect(isAnswerCorrect([2], [2])).toBe(true);
  });
});

describe("순위", () => {
  const people: RankParticipant[] = [
    { id: "a", nickname: "A", joinedAt: "2026-11-25T00:00:01Z" },
    { id: "b", nickname: "B", joinedAt: "2026-11-25T00:00:02Z" },
    { id: "c", nickname: "C", joinedAt: "2026-11-25T00:00:03Z" },
    { id: "d", nickname: "D", joinedAt: "2026-11-25T00:00:00Z" },
  ];
  const limits = [20, 20];
  const ans = (participantId: string, questionIndex: number, isCorrect: boolean, elapsedMs: number, score: number): RankAnswer => ({
    participantId,
    questionIndex,
    isCorrect,
    elapsedMs,
    score,
  });

  it("총점 → 정답 수 → 총 응답시간 → 입장 시각", () => {
    const answers = [
      ans("a", 0, true, 4000, 900),
      ans("b", 0, true, 4000, 900),
      ans("c", 0, true, 4000, 900),
      // 점수 사용 Off 문항(0점이지만 정답 수는 셈)
      ans("a", 1, true, 5000, 0),
      ans("b", 1, true, 3000, 0),
      ans("c", 1, false, 1000, 0),
    ];
    const s = computeStandings(people, answers, limits, 1);
    // a·b 는 900점·정답 2개 → 시간 짧은 b 가 위, c 는 정답 1개, d 는 0점
    expect(s.map((x) => [x.participantId, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
      ["d", 4],
    ]);
    expect(s.find((x) => x.participantId === "d")!.totalTimeMs).toBe(40000); // 미응답은 T로 계산(D-13)
  });

  it("모든 값이 같으면 먼저 입장한 사람이 위", () => {
    const s = computeStandings(people, [], limits, 1);
    expect(s.map((x) => x.participantId)).toEqual(["d", "a", "b", "c"]);
  });

  it("upTo 이후 문제는 계산하지 않는다(정답 공개 전 순위 유출 방지)", () => {
    const s = computeStandings(people, [ans("c", 1, true, 1000, 975)], limits, 0);
    expect(s.find((x) => x.participantId === "c")!.totalScore).toBe(0);
  });

  it("문제별 랭킹: 이번 문제 점수와 순위 변동", () => {
    const answers = [ans("a", 0, true, 2000, 950), ans("b", 1, true, 1000, 975), ans("b", 0, true, 10000, 750)];
    const lb = computeLeaderboard(people, answers, limits, 1);
    const b = lb.find((x) => x.participantId === "b")!;
    const a = lb.find((x) => x.participantId === "a")!;
    expect([b.rank, b.gained, b.change]).toEqual([1, 975, 1]); // 2위 → 1위
    expect([a.rank, a.gained, a.change]).toEqual([2, 0, -1]); // 1위 → 2위
    expect(computeLeaderboard(people, answers, limits, 0).every((x) => x.change === 0)).toBe(true);
  });
});

describe("문제 결과", () => {
  it("보기별 인원(복수 선택은 보기마다), 정답 인원", () => {
    const q = {
      choices: [
        { id: 1, text: "a", image_url: null, is_correct: true },
        { id: 2, text: "b", image_url: null, is_correct: false },
        { id: 3, text: "c", image_url: null, is_correct: true },
      ],
    };
    const r = computeQuestionResult(q, [
      { choiceIds: [1, 3], isCorrect: true },
      { choiceIds: [1], isCorrect: false },
      { choiceIds: [2, 2], isCorrect: false },
    ]);
    expect(r).toEqual({ correctIds: [1, 3], counts: { 1: 2, 2: 1, 3: 1 }, answeredCount: 3, correctCount: 1 });
  });
});

describe("폰으로 보내는 문제(절대 규칙 3)", () => {
  const question: QuestionSnapshot = {
    id: "q1",
    order_index: 0,
    type: "choice",
    text_type: "short",
    question_text: "비밀 문제",
    image_url: "https://x/q.webp",
    choices: [
      { id: 1, text: "정답보기", image_url: null, is_correct: true },
      { id: 2, text: "오답보기", image_url: "https://x/c.webp", is_correct: false },
    ],
    time_limit_sec: 20,
    use_score: true,
    double_score: true,
  };

  it.each([
    ["onsite", false],
    ["onsite", true],
    ["remote", false],
  ] as const)("%s / 답변 노출 %s: 정답 정보가 없다", (playType, showChoiceText) => {
    const json = JSON.stringify(toPhoneQuestion(question, 0, 5, { playType, showChoiceText }));
    expect(json).not.toContain("is_correct");
    expect(json).not.toContain("correct");
  });

  it("현장 Play + 답변 노출 Off: 문제·보기 텍스트·이미지 모두 없음", () => {
    const p = toPhoneQuestion(question, 0, 5, { playType: "onsite", showChoiceText: false });
    expect(p.questionText).toBeNull();
    expect(p.imageUrl).toBeNull();
    expect(p.choices).toEqual([
      { id: 1, text: null, imageUrl: null },
      { id: 2, text: null, imageUrl: null },
    ]);
    expect(JSON.stringify(p)).not.toContain("정답보기");
  });

  it("현장 Play + 답변 노출 On: 보기 텍스트만", () => {
    const p = toPhoneQuestion(question, 0, 5, { playType: "onsite", showChoiceText: true });
    expect(p.questionText).toBeNull();
    expect(p.choices[0].text).toBe("정답보기");
  });

  it("원격 Play: 문제·보기 모두, 복수정답 여부와 2배 표시", () => {
    const p = toPhoneQuestion(question, 2, 5, { playType: "remote", showChoiceText: false });
    expect(p.questionText).toBe("비밀 문제");
    expect(p.imageUrl).toBe("https://x/q.webp");
    expect(p.choices[1].imageUrl).toBe("https://x/c.webp");
    expect([p.index, p.total, p.multiple, p.doubleScore]).toEqual([2, 5, false, true]);
  });
});
