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

/** 환경변수가 모두 있는지 확인(화면 안내용). */
export function isSupabaseConfigured(): boolean {
  return readPublicEnv() !== null && !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
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
