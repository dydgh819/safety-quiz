"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readPublicEnv } from "@/lib/env";
import type { Database } from "@/types/db";

/**
 * 브라우저용 anon 클라이언트 — **Realtime 구독 전용**.
 *
 * 테이블 읽기·쓰기에 쓰지 않는다(RLS 와 권한 회수로 어차피 모두 거부된다).
 * 데이터는 항상 서버(API 라우트·서버 컴포넌트·Server Action)를 거친다. CLAUDE.md 절대 규칙 2.
 */

let cached: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const env = readPublicEnv();
  if (!env) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다.");
  }
  cached = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
