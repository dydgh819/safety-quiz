import type { Choice } from "@/types/db";

/**
 * 점수·순위(PRD 5.4). 순수 함수.
 *
 *   정답이면 score = round(B × (1 − t / 2T)) × M,  오답·미응답 0
 *   B = 1000(점수 사용 Off면 0), t = 문제 시작~제출 서버 시각 차(초, T를 넘지 않게 자름 D-12), T = 제한시간, M = 2배면 2
 *   복수정답은 정답 보기를 빠짐없이·오답 없이 고른 경우만 정답(부분 점수 없음)
 *   순위: 총점 ↓ → 정답 수 ↓ → 총 응답시간 ↑(미응답은 T로 계산 D-13) → 입장 시각 ↑
 */

export const BASE_SCORE = 1000;

export function correctChoiceIds(choices: readonly Pick<Choice, "id" | "is_correct">[]): number[] {
  return choices.filter((c) => c.is_correct).map((c) => c.id).sort((a, b) => a - b);
}

/** 고른 보기가 정답 집합과 정확히 같은지 */
export function isAnswerCorrect(chosen: readonly number[], correct: readonly number[]): boolean {
  if (chosen.length === 0 || correct.length === 0) return false;
  const a = [...new Set(chosen)].sort((x, y) => x - y);
  const b = [...new Set(correct)].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function calculateScore(input: {
  correct: boolean;
  elapsedMs: number;
  timeLimitSec: number;
  useScore: boolean;
  doubleScore: boolean;
}): number {
  if (!input.correct || !input.useScore || input.timeLimitSec <= 0) return 0;
  const t = Math.min(Math.max(input.elapsedMs / 1000, 0), input.timeLimitSec);
  const base = Math.round(BASE_SCORE * (1 - t / (2 * input.timeLimitSec)));
  return base * (input.doubleScore ? 2 : 1);
}

// ---------------------------------------------------------------------------
// 순위
// ---------------------------------------------------------------------------

export type RankParticipant = { id: string; nickname: string; joinedAt: string };
export type RankAnswer = { participantId: string; questionIndex: number; isCorrect: boolean; elapsedMs: number; score: number };

export type Standing = {
  participantId: string;
  nickname: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  totalTimeMs: number;
  joinedAt: string;
};

/**
 * 문제 0..upTo 까지의 누적 순위. upTo < 0 이면 모두 0점.
 * @param timeLimitsSec 문제별 제한시간(미응답 시간 계산용)
 */
export function computeStandings(
  participants: readonly RankParticipant[],
  answers: readonly RankAnswer[],
  timeLimitsSec: readonly number[],
  upTo: number,
): Standing[] {
  const byParticipant = new Map<string, RankAnswer[]>();
  for (const a of answers) {
    if (a.questionIndex > upTo) continue;
    const list = byParticipant.get(a.participantId) ?? [];
    list.push(a);
    byParticipant.set(a.participantId, list);
  }

  const rows = participants.map((p) => {
    const mine = byParticipant.get(p.id) ?? [];
    const answeredIndex = new Map(mine.map((a) => [a.questionIndex, a]));
    let totalTimeMs = 0;
    for (let i = 0; i <= upTo && i < timeLimitsSec.length; i += 1) {
      const answer = answeredIndex.get(i);
      totalTimeMs += answer ? Math.min(answer.elapsedMs, timeLimitsSec[i] * 1000) : timeLimitsSec[i] * 1000;
    }
    return {
      participantId: p.id,
      nickname: p.nickname,
      totalScore: mine.reduce((sum, a) => sum + a.score, 0),
      correctCount: mine.filter((a) => a.isCorrect).length,
      totalTimeMs,
      joinedAt: p.joinedAt,
    };
  });

  rows.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.correctCount - a.correctCount ||
      a.totalTimeMs - b.totalTimeMs ||
      a.joinedAt.localeCompare(b.joinedAt) ||
      a.participantId.localeCompare(b.participantId),
  );
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export type LeaderboardRow = Standing & {
  /** 이번 문제에서 얻은 점수 */
  gained: number;
  /** 직전 문제 기준 순위 대비 변동(+ 는 상승). 첫 문제는 0 */
  change: number;
};

/** 문제 upTo 기준 순위 + 이번 문제 점수 + 순위 변동(PL-07) */
export function computeLeaderboard(
  participants: readonly RankParticipant[],
  answers: readonly RankAnswer[],
  timeLimitsSec: readonly number[],
  upTo: number,
): LeaderboardRow[] {
  const now = computeStandings(participants, answers, timeLimitsSec, upTo);
  const before = upTo > 0 ? computeStandings(participants, answers, timeLimitsSec, upTo - 1) : null;
  const previousRank = new Map(before?.map((s) => [s.participantId, s.rank]));
  const gained = new Map<string, number>();
  for (const a of answers) if (a.questionIndex === upTo) gained.set(a.participantId, a.score);

  return now.map((s) => ({
    ...s,
    gained: gained.get(s.participantId) ?? 0,
    change: before ? (previousRank.get(s.participantId) ?? s.rank) - s.rank : 0,
  }));
}
