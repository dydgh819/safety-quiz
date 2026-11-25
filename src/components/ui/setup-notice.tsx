import { classifyDbError, toDbErrorInfo } from "@/lib/db/errors";
import { detectWrongServerKey, listMissingSupabaseEnv } from "@/lib/supabase/admin";
import { ko } from "@/messages/ko";

/** 빨간 안내 상자 */
export function Notice({ title, hint, detail }: { title: string; hint: string; detail?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
      <p className="font-semibold text-red-700">{title}</p>
      <p className="mt-1 text-sm text-red-600">{hint}</p>
      {detail && <p className="mt-2 font-mono text-xs break-all text-red-500">{detail}</p>}
    </div>
  );
}

/** Supabase 설정 문제가 있으면 안내 상자, 없으면 null (서버 컴포넌트 전용) */
export function supabaseSetupNotice(): React.ReactElement | null {
  const missing = listMissingSupabaseEnv();
  if (missing.length > 0) {
    return <Notice title={ko.errors.supabaseNotConfigured} hint={ko.errors.supabaseNotConfiguredHint(missing)} />;
  }
  if (detectWrongServerKey()) {
    return <Notice title={ko.errors.supabaseNotConfigured} hint={ko.errors.wrongServerKey} />;
  }
  return null;
}

/** DB 조회 실패 안내(원인별) */
export function DbErrorNotice({ error }: { error: unknown }) {
  const info = toDbErrorInfo(error);
  return (
    <Notice
      title={ko.errors.loadFailed}
      hint={ko.errors.dbErrorHint[classifyDbError(info)]}
      detail={ko.errors.dbErrorDetail(info.code, info.message)}
    />
  );
}
