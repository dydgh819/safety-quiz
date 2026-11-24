/**
 * 환경변수 읽기.
 *
 * - NEXT_PUBLIC_* 는 빌드 시 브라우저 번들에 문자열로 박히므로 반드시 `process.env.NEXT_PUBLIC_X` 형태로 직접 참조한다.
 * - SUPABASE_SERVICE_ROLE_KEY 는 여기서 읽지 않는다. src/lib/supabase/admin.ts(server-only)에서만 읽는다.
 */

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

/** 값이 비어 있으면 null. 화면에서 '설정 안 됨' 안내를 보여줄 수 있게 예외 대신 null 을 돌려준다. */
export function readPublicEnv(): PublicEnv | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}
