import { describe, expect, it } from "vitest";

import { DEFAULT_SESSION_OPTIONS } from "@/lib/quiz/constants";
import type { QuestionSnapshot, SessionState } from "@/types/db";

import { buildHostView, buildPhoneGame, questionProgress, type GameData } from "./views";

const q = (id: string, correct: number[]): QuestionSnapshot => ({
  id,
  order_index: 0,
  type: "choice",
  text_type: "short",
  question_text: `문제 ${id}`,
  image_url: null,
  choices: [1, 2, 3, 4].map((n) => ({ id: n, text: `보기${n}`, image_url: null, is_correct: correct.includes(n) })),
  time_limit_sec: 20,
  use_score: true,
  double_score: false,
});

const now = new Date("2026-11-25T01:00:00.000Z");
const recent = "2026-11-25T00:59:55.000Z";
const stale = "2026-11-25T00:50:00.000Z";

function data(state: SessionState, qIndex: number | null): GameData {
  return {
    session: {
      id: "s",
      pin: "123456",
      edu_title: "교육",
      play_type: "onsite",
      options: DEFAULT_SESSION_OPTIONS,
      state,
      current_q_index: qIndex,
      q_started_at: "2026-11-25T00:59:50.000Z",
      q_ends_at: "2026-11-25T01:00:10.000Z",
      entry_closed: false,
      questions_snapshot: [q("q0", [2]), q("q1", [1, 3])],
    },
    participants: [
      { id: "a", nickname: "A", joined_at: "2026-11-25T00:00:01Z", last_seen_at: recent },
      { id: "b", nickname: "B", joined_at: "2026-11-25T00:00:02Z", last_seen_at: recent },
      { id: "c", nickname: "C", joined_at: "2026-11-25T00:00:03Z", last_seen_at: stale },
    ],
    answers: [
      { participant_id: "a", question_id: "q0", choice_ids: [2], is_correct: true, elapsed_ms: 4000, score: 900 },
      { participant_id: "b", question_id: "q0", choice_ids: [1], is_correct: false, elapsed_ms: 3000, score: 0 },
      // q1: a 가 이미 정답 제출(문제 진행 중)
      { participant_id: "a", question_id: "q1", choice_ids: [1, 3], is_correct: true, elapsed_ms: 1000, score: 975 },
      // 강퇴된 참가자의 답(참가자 목록에 없음) → 무시
      { participant_id: "x", question_id: "q0", choice_ids: [2], is_correct: true, elapsed_ms: 100, score: 997 },
    ],
  };
}

describe("폰 데이터: 정답·점수 유출 방지(절대 규칙 3)", () => {
  it("문제 진행 중: 정답 정보 없음, 누적은 이전 문제까지만", () => {
    const game = buildPhoneGame(data("question", 1), "a");
    const json = JSON.stringify(game);
    expect(json).not.toContain("is_correct");
    expect(json).not.toContain("correctIds");
    expect(game.result).toBeNull();
    expect(game.myAnswer).toEqual({ choiceIds: [1, 3] }); // 내가 낸 답은 다시 보여줌(M6)
    expect(game.me.totalScore).toBe(900); // q1 의 975점은 아직 반영하지 않음
    expect(game.question?.multiple).toBe(true);
    expect(game.question?.questionText).toBeNull(); // 현장 Play
  });

  it("예고 중에는 문제도 내 답도 보내지 않는다", () => {
    const game = buildPhoneGame(data("countdown", 1), "a");
    expect(game.question).toBeNull();
    expect(game.myAnswer).toBeNull();
  });

  it("결과 공개 후: 정답·내 정답 여부·이번 점수·누적·순위", () => {
    const a = buildPhoneGame(data("reveal", 1), "a");
    expect(a.result).toEqual({ correctIds: [1, 3], isCorrect: true, gained: 975 });
    expect(a.me).toEqual({ totalScore: 1875, correctCount: 2, rank: 1, participantCount: 3 });

    const c = buildPhoneGame(data("reveal", 1), "c");
    expect(c.result).toEqual({ correctIds: [1, 3], isCorrect: null, gained: 0 }); // 미응답
  });
});

describe("발표 화면 데이터", () => {
  it("문제 진행 중: 응답 n / 접속 N(30초 안 확인 + 이미 답한 사람)", () => {
    const view = buildHostView(data("question", 1), now);
    expect(view.progress).toEqual({ answered: 1, active: 2 }); // c 는 오래전에 확인 → 제외
    expect(view.result).toBeNull();
    expect(view.leaderboard).toBeNull();
    expect(questionProgress(data("question", 0), now)).toEqual({ answered: 2, active: 2 });
  });

  it("결과: 보기별 인원(강퇴자 제외)과 정답", () => {
    const view = buildHostView(data("reveal", 0), now);
    expect(view.result).toEqual({ correctIds: [2], counts: { 1: 1, 2: 1, 3: 0, 4: 0 }, answeredCount: 2, correctCount: 1 });
  });

  it("랭킹·최종: Top 10, 요약", () => {
    const board = buildHostView(data("leaderboard", 0), now).leaderboard!;
    expect(board.map((r) => [r.nickname, r.rank, r.gained])).toEqual([
      ["A", 1, 900],
      ["B", 2, 0],
      ["C", 3, 0],
    ]);
    const final = buildHostView(data("final", 1), now);
    expect(final.summary).toEqual({ participantCount: 3, averageScore: 625, averageCorrectRate: 2 / 6 });
  });
});
