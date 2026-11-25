import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { HostLobby } from "@/components/host/host-lobby";
import { DbErrorNotice, Notice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { getSession, listLobbyParticipants } from "@/lib/db/sessions";
import { hasHostAccess } from "@/lib/host-key";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/** P1~P7 발표 화면(프로젝터). 4단계: 대기실(P1) */
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
    const [session, access] = await Promise.all([getSession(sessionId), hasHostAccess(sessionId)]);
    loaded = { session, access, participants: access && session ? await listLobbyParticipants(sessionId) : [] };
  } catch (error) {
    console.error(error);
    return (
      <div className="p-8">
        <DbErrorNotice error={error} />
      </div>
    );
  }

  const { session, access, participants } = loaded;
  if (!session) notFound();
  if (!access) {
    return (
      <div className="p-8">
        <Notice title={ko.host.noAccessTitle} hint={ko.host.noAccessHint} />
      </div>
    );
  }

  return (
    <HostLobby
      sessionId={session.id}
      pin={session.pin}
      eduTitle={session.edu_title}
      totalQuestions={session.questions_snapshot.length}
      initial={{ state: session.state, entryClosed: session.entry_closed, participants }}
    />
  );
}
