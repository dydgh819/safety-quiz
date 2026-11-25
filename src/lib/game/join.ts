import type { SessionState } from "@/types/db";

import { isSameNickname } from "./nickname";

/**
 * 입장 판정(JN-04, JN-06, JN-07, D-03, D-10). 순수 함수 — DB 조회 결과를 받아 결정만 한다.
 *
 * 순서:
 *  1) 종료된 회차 → 거부
 *  2) 이 기기로 이미 들어온 참가자가 있으면: 강퇴됐으면 거부, 같은 닉네임이면 재입장(토큰 재발급), 다른 닉네임이면 거부
 *  3) 다른 기기가 같은 닉네임(대소문자 무시)을 쓰고 있으면 거부(기기 교체 없음)
 *  4) 입장 마감 중이면 새 참가자 거부(D-10)
 *  5) 퀴즈가 시작된 뒤인데 지각 입장이 꺼져 있으면 거부(JN-09, 동작은 6단계)
 *  6) 새 참가자
 */

export type ExistingParticipant = {
  id: string;
  nickname: string;
  device_id: string;
  kicked: boolean;
};

export type JoinContext = {
  state: SessionState;
  entryClosed: boolean;
  allowLateJoin: boolean;
  participants: readonly ExistingParticipant[];
};

export type JoinRejectReason = "ended" | "kicked" | "deviceUsed" | "nicknameTaken" | "entryClosed" | "lateJoinClosed";

export type JoinDecision =
  | { kind: "new" }
  | { kind: "rejoin"; participantId: string }
  | { kind: "reject"; reason: JoinRejectReason; currentNickname?: string };

export function decideJoin(ctx: JoinContext, nickname: string, deviceId: string): JoinDecision {
  if (ctx.state === "ended") return { kind: "reject", reason: "ended" };

  const mine = ctx.participants.find((p) => p.device_id === deviceId);
  if (mine) {
    if (mine.kicked) return { kind: "reject", reason: "kicked" };
    if (isSameNickname(mine.nickname, nickname)) return { kind: "rejoin", participantId: mine.id };
    return { kind: "reject", reason: "deviceUsed", currentNickname: mine.nickname };
  }

  if (ctx.participants.some((p) => isSameNickname(p.nickname, nickname))) {
    return { kind: "reject", reason: "nicknameTaken" };
  }
  if (ctx.entryClosed) return { kind: "reject", reason: "entryClosed" };
  if (ctx.state !== "lobby" && !ctx.allowLateJoin) return { kind: "reject", reason: "lateJoinClosed" };
  return { kind: "new" };
}
