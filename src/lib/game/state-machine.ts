import type { SessionState } from "@/types/db";

/**
 * 회차 진행 상태 머신(PRD 5.2, PL-02). 순수 함수.
 *
 *   lobby → countdown(0) → question(0) → reveal(0) → leaderboard(0) → countdown(1) → … → reveal(마지막) → final → ended
 *
 * - 마지막 문제는 reveal 다음 바로 final(D-06)
 * - '랭킹 화면 비노출' 옵션이면 reveal 다음 바로 다음 문제 countdown(PRD 5.2)
 * - 이 표에 없는 전환은 서버가 거부한다(절대 규칙 1)
 */

export type GamePosition = { state: SessionState; qIndex: number | null };

export type MachineOptions = { hideLeaderboard: boolean };

/** 문제 예고 시간(P2) */
export const COUNTDOWN_MS = 3000;
/** 제한시간 뒤 네트워크 여유(PRD 5.4) */
export const ANSWER_GRACE_MS = 500;

export function nextPosition(current: GamePosition, totalQuestions: number, options: MachineOptions): GamePosition | null {
  const q = current.qIndex ?? 0;
  const last = totalQuestions - 1;

  switch (current.state) {
    case "lobby":
      return totalQuestions > 0 ? { state: "countdown", qIndex: 0 } : null;
    case "countdown":
      return { state: "question", qIndex: q };
    case "question":
      return { state: "reveal", qIndex: q };
    case "reveal":
      if (q >= last) return { state: "final", qIndex: last };
      return options.hideLeaderboard ? { state: "countdown", qIndex: q + 1 } : { state: "leaderboard", qIndex: q };
    case "leaderboard":
      return q >= last ? { state: "final", qIndex: last } : { state: "countdown", qIndex: q + 1 };
    case "final":
      return { state: "ended", qIndex: q };
    case "ended":
      return null;
  }
}

export function isSamePosition(a: GamePosition, b: GamePosition): boolean {
  return a.state === b.state && (a.qIndex ?? null) === (b.qIndex ?? null);
}

/** 상태가 바뀔 때 함께 저장할 시각. 예고(countdown) 동안은 예고 시작·끝, 문제(question) 동안은 문제 시작·마감 */
export function timingFor(
  next: GamePosition,
  now: Date,
  timeLimitSec: number | null,
): { q_started_at?: string; q_ends_at?: string; ended_at?: string } {
  if (next.state === "countdown") {
    return { q_started_at: now.toISOString(), q_ends_at: new Date(now.getTime() + COUNTDOWN_MS).toISOString() };
  }
  if (next.state === "question" && timeLimitSec !== null) {
    return { q_started_at: now.toISOString(), q_ends_at: new Date(now.getTime() + timeLimitSec * 1000).toISOString() };
  }
  if (next.state === "ended") return { ended_at: now.toISOString() };
  return {};
}

/** 지금까지 결과가 공개된 마지막 문제 위치(점수·순위는 여기까지만 계산해야 정답이 미리 새지 않는다) */
export function revealedUpTo(position: GamePosition, totalQuestions: number): number {
  const q = position.qIndex ?? -1;
  switch (position.state) {
    case "lobby":
      return -1;
    case "countdown":
    case "question":
      return q - 1;
    case "reveal":
    case "leaderboard":
      return q;
    case "final":
    case "ended":
      return totalQuestions - 1;
  }
}
