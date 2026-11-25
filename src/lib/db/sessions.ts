import "server-only";

import { randomInt } from "node:crypto";

import { DbError } from "@/lib/db/errors";
import { decideJoin, type JoinRejectReason } from "@/lib/game/join";
import { generatePin } from "@/lib/game/pin";
import { createSecret, hashSecret, verifySecret } from "@/lib/game/secret";
import { toQuestionSnapshot } from "@/lib/game/snapshot";
import { isShowComplete } from "@/lib/quiz/validate";
import { getAdminClient } from "@/lib/supabase/admin";
import type { PlaySettingsInput } from "@/lib/validation/session";
import type { ParticipantRow, SessionRow } from "@/types/db";

import { listQuestions } from "./questions";

/**
 * 회차·참가자 조회·저장(서버 전용).
 */

/** 마지막 활동 후 이 시간이 지난 미종료 회차는 자동 종료(D-17) */
export const STALE_SESSION_HOURS = 12;

function fail(error: { code?: string; message: string }): never {
  throw new DbError({ code: error.code ?? "", message: error.message });
}

/** 방치된 회차 정리: PIN 을 다시 쓸 수 있게 종료 처리 */
export async function endStaleSessions(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - STALE_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await getAdminClient()
    .from("sessions")
    .update({ state: "ended", ended_at: now.toISOString() })
    .neq("state", "ended")
    .lt("last_activity_at", cutoff);
  if (error) fail(error);
}

export async function touchSession(sessionId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) fail(error);
}

export type CreateSessionResult =
  | { ok: true; session: SessionRow; hostKey: string }
  | { ok: false; reason: "showNotFound" | "showIncomplete" | "pinExhausted" };

/** 회차 생성(JN-01): 문제 스냅샷, 겹치지 않는 PIN, 진행 키 */
export async function createSession(showId: string, settings: PlaySettingsInput): Promise<CreateSessionResult> {
  const db = getAdminClient();
  await endStaleSessions();

  const { data: show, error: sError } = await db
    .from("shows")
    .select("id, is_complete")
    .eq("id", showId)
    .is("deleted_at", null)
    .maybeSingle();
  if (sError) fail(sError);
  if (!show) return { ok: false, reason: "showNotFound" };

  const questions = await listQuestions(showId);
  // 완성 표시만 믿지 않고 실제 문항도 다시 검사(QZ-09)
  if (!show.is_complete || !isShowComplete(questions)) return { ok: false, reason: "showIncomplete" };

  const hostKey = createSecret();
  const base = {
    show_id: showId,
    mode: "choice_individual" as const,
    play_type: settings.play_type,
    options: settings.options,
    edu_title: settings.edu_title,
    edu_date: settings.edu_date,
    questions_snapshot: toQuestionSnapshot(questions),
    host_key_hash: hashSecret(hostKey),
  };

  // PIN 충돌(진행 중 회차와 같은 PIN)이면 다시 뽑는다
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await db
      .from("sessions")
      .insert({ ...base, pin: generatePin((max) => randomInt(max)) })
      .select("*")
      .single();
    if (!error) return { ok: true, session: data, hostKey };
    if (error.code !== "23505") fail(error);
  }
  return { ok: false, reason: "pinExhausted" };
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await getAdminClient().from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) fail(error);
  return data;
}

/** 진행 중(종료 아님) 회차를 PIN 으로 */
export async function getActiveSessionByPin(pin: string): Promise<SessionRow | null> {
  await endStaleSessions();
  const { data, error } = await getAdminClient()
    .from("sessions")
    .select("*")
    .eq("pin", pin)
    .neq("state", "ended")
    .maybeSingle();
  if (error) fail(error);
  return data;
}

/** 진행 키 확인(D-27) */
export async function verifyHostKey(sessionId: string, hostKey: string | undefined): Promise<boolean> {
  if (!hostKey) return false;
  const { data, error } = await getAdminClient()
    .from("sessions")
    .select("host_key_hash")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) fail(error);
  return !!data && verifySecret(hostKey, data.host_key_hash);
}

export type LobbyParticipant = Pick<ParticipantRow, "id" | "nickname" | "joined_at">;

/** 대기실 참가자(강퇴 제외), 최근 입장 순(JN-08) */
export async function listLobbyParticipants(sessionId: string): Promise<LobbyParticipant[]> {
  const { data, error } = await getAdminClient()
    .from("participants")
    .select("id, nickname, joined_at")
    .eq("session_id", sessionId)
    .eq("kicked", false)
    .order("joined_at", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function countParticipants(sessionId: string): Promise<number> {
  const { count, error } = await getAdminClient()
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("kicked", false);
  if (error) fail(error);
  return count ?? 0;
}

export type JoinResult =
  | { ok: true; participant: Pick<ParticipantRow, "id" | "nickname">; token: string; rejoined: boolean }
  | { ok: false; reason: JoinRejectReason | "notFound"; currentNickname?: string };

/**
 * 입장(JN-04, 06, 07, 10). 같은 기기의 재입장이면 재접속 토큰을 새로 발급한다.
 * 동시에 같은 닉네임으로 들어오는 경우는 DB 유일 제약이 막고, 다시 판정한다.
 */
export async function joinSession(sessionId: string, nickname: string, deviceId: string): Promise<JoinResult> {
  const db = getAdminClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await getSession(sessionId);
    if (!session) return { ok: false, reason: "notFound" };

    const { data: participants, error } = await db
      .from("participants")
      .select("id, nickname, device_id, kicked")
      .eq("session_id", sessionId);
    if (error) fail(error);

    const decision = decideJoin(
      {
        state: session.state,
        entryClosed: session.entry_closed,
        allowLateJoin: session.options?.allow_late_join ?? true,
        participants: participants ?? [],
      },
      nickname,
      deviceId,
    );

    if (decision.kind === "reject") {
      return { ok: false, reason: decision.reason, currentNickname: decision.currentNickname };
    }

    const token = createSecret();
    const now = new Date().toISOString();

    if (decision.kind === "rejoin") {
      const { data, error: uError } = await db
        .from("participants")
        .update({ rejoin_token_hash: hashSecret(token), last_seen_at: now })
        .eq("id", decision.participantId)
        .select("id, nickname")
        .single();
      if (uError) fail(uError);
      await touchSession(sessionId);
      return { ok: true, participant: data, token, rejoined: true };
    }

    const { data, error: iError } = await db
      .from("participants")
      .insert({ session_id: sessionId, nickname, device_id: deviceId, rejoin_token_hash: hashSecret(token) })
      .select("id, nickname")
      .single();
    if (!iError) {
      await touchSession(sessionId);
      return { ok: true, participant: data, token, rejoined: false };
    }
    if (iError.code !== "23505") fail(iError);
    // 동시에 같은 닉네임·기기로 들어온 경우 → 한 번 더 판정
  }
  return { ok: false, reason: "nicknameTaken" };
}

/** 폰의 재접속 토큰 확인. 맞으면 참가자, 아니면 null */
export async function authenticateParticipant(
  sessionId: string,
  participantId: string,
  token: string,
): Promise<ParticipantRow | null> {
  const { data, error } = await getAdminClient()
    .from("participants")
    .select("*")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) fail(error);
  if (!data || !verifySecret(token, data.rejoin_token_hash)) return null;
  return data;
}

export async function markParticipantSeen(participantId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("participants")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", participantId);
  if (error) fail(error);
}

/** 강퇴(JN-08): 같은 기기는 이 회차에 다시 들어올 수 없다 */
export async function kickParticipant(sessionId: string, participantId: string): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("participants")
    .update({ kicked: true })
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .select("id");
  if (error) fail(error);
  if (data.length > 0) await touchSession(sessionId);
  return data.length > 0;
}

/** 입장 마감/재개(D-10) */
export async function setEntryClosed(sessionId: string, closed: boolean): Promise<void> {
  const { error } = await getAdminClient()
    .from("sessions")
    .update({ entry_closed: closed, last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) fail(error);
}
