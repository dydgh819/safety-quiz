import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readPublicEnv } from "@/lib/env";
import type { Database } from "@/types/db";

/**
 * 서버 전용 관리자 클라이언트(service role, RLS 우회).
 *
 * 절대 규칙(CLAUDE.md):
 * - SUPABASE_SERVICE_ROLE_KEY 는 이 파일에서만 읽는다.
 * - 이 파일은 'server-only' 이므로 클라이언트 컴포넌트에서 import 하면 빌드가 실패한다.
 * - 모든 DB 읽기·쓰기는 이 클라이언트로 서버에서만 한다(D-26).
 */

export type AdminClient = SupabaseClient<Database>;

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase 환경변수가 없습니다: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

let cached: AdminClient | null = null;

/**
 * 비어 있는 Supabase 환경변수의 **이름** 목록(화면 안내용). 값은 절대 돌려주지 않는다.
 * NEXT_PUBLIC_* 는 빌드 시점에 코드에 박히므로, 변수를 등록하기 전에 빌드된 배포에서는 비어 있다.
 */
export function listMissingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

/**
 * SUPABASE_SERVICE_ROLE_KEY 자리에 브라우저용 키가 들어갔는지 검사(화면 안내용). 키 값은 돌려주지 않는다.
 * - 'publishable': 새 Publishable key(sb_publishable_…)를 넣음
 * - 'anon': 예전 anon JWT 를 넣음
 */
export function detectWrongServerKey(): "publishable" | "anon" | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (key.startsWith("sb_publishable_")) return "publishable";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
      if (payload.role === "anon") return "anon";
    } catch {
      // JWT 가 아니면 판단하지 않음
    }
  }
  return null;
}

/** 환경변수가 모두 있는지 확인(화면 안내용). */
export function isSupabaseConfigured(): boolean {
  return listMissingSupabaseEnv().length === 0;
}

/** 요청 처리 중에만 호출한다. 빌드(프리렌더) 시점에 호출되지 않게 <Suspense> 안이나 API 안에서 쓴다. */
export function getAdminClient(): AdminClient {
  if (cached) return cached;

  const env = readPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !serviceRoleKey) throw new SupabaseNotConfiguredError();

  cached = createClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
