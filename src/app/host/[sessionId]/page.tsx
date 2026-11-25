import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { HostScreen } from "@/components/host/host-screen";
import { DbErrorNotice, Notice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { loadGameData } from "@/lib/db/game";
import { buildHostView } from "@/lib/game/views";
import { hasHostAccess } from "@/lib/host-key";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/**
 * P1~P7 발표 화면(프로젝터). 새로고침하거나 다른 탭에서 열어도 서버의 현재 단계로 복구된다(PL-10).
 * 진행 키 쿠키가 있는 브라우저에서만 열린다(D-27).
 */
export default function HostPage({ params }: PageProps<"/host/[sessionId]">) {
  return (
    <Suspense fallback={<p className="p-8 text-neutral-500">{ko.host.loading}</p>}>
      <HostLoader params={params} />
    </Suspense>
  );
}

async function HostLoader({ params }: { params: PageProps<"/host/[sessionId]">["params"] }) {
  const { sessionId } = await params;
  if (!uuidSchema.safeParse(sessionId).success) notFound();
  await connection();

  const setupNotice = supabaseSetupNotice();
  if (setupNotice) return <div className="p-8">{setupNotice}</div>;

  let loaded;
  try {
    const access = await hasHostAccess(sessionId);
    loaded = { access, data: access ? await loadGameData(sessionId) : null };
  } catch (error) {
    console.error(error);
    return (
      <div className="p-8">
        <DbErrorNotice error={error} />
      </div>
    );
  }

  if (!loaded.access) {
    return (
      <div className="p-8">
        <Notice title={ko.host.noAccessTitle} hint={ko.host.noAccessHint} />
      </div>
    );
  }
  if (!loaded.data) notFound();

  return <HostScreen initial={buildHostView(loaded.data, new Date())} />;
}
