import { Suspense } from "react";

import { PlayApp } from "@/components/mobile/play-app";
import { ko } from "@/messages/ko";

/** M2~M8 피교육자 화면(공개). QR 은 이 주소(/play/PIN)로 바로 들어온다(JN-03) */
export default function PlayPage({ params }: PageProps<"/play/[pin]">) {
  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-br from-brand-50 to-brand-100">
      <Suspense fallback={<p className="p-8 text-center text-neutral-500">{ko.play.loading}</p>}>
        <PlayLoader params={params} />
      </Suspense>
    </main>
  );
}

async function PlayLoader({ params }: { params: PageProps<"/play/[pin]">["params"] }) {
  const { pin } = await params;
  return <PlayApp pin={pin} />;
}
