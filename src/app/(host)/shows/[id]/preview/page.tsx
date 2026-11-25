import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ShowPreview } from "@/components/shows/show-preview";
import { DbErrorNotice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { getShowWithQuestions } from "@/lib/db/shows";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/** SH-05 미리보기: 발표 화면 + 휴대폰 화면 나란히. 기록은 남지 않는다 */
export default function PreviewShowPage({ params }: PageProps<"/shows/[id]/preview">) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <Suspense fallback={<p className="text-neutral-500">{ko.editor.loading}</p>}>
        <PreviewLoader params={params} />
      </Suspense>
    </div>
  );
}

async function PreviewLoader({ params }: { params: PageProps<"/shows/[id]/preview">["params"] }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const setupNotice = supabaseSetupNotice();
  if (setupNotice) return setupNotice;

  let data;
  try {
    data = await getShowWithQuestions(id);
  } catch (error) {
    console.error(error);
    return <DbErrorNotice error={error} />;
  }
  if (!data) notFound();

  return <ShowPreview show={data.show} questions={data.questions} />;
}
