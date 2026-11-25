import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PlaySettingsForm } from "@/components/play/play-settings-form";
import { DbErrorNotice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { getShowWithQuestions } from "@/lib/db/shows";
import { todayInSeoul } from "@/lib/format";
import { isShowComplete } from "@/lib/quiz/validate";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/** A5 Play 설정 */
export default function PlaySettingsPage({ params }: PageProps<"/shows/[id]/play">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Suspense fallback={<p className="text-neutral-500">{ko.playSettings.loading}</p>}>
        <PlaySettingsLoader params={params} />
      </Suspense>
    </div>
  );
}

async function PlaySettingsLoader({ params }: { params: PageProps<"/shows/[id]/play">["params"] }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  await connection();

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

  // 완성된 Show 만 진입(QZ-09)
  if (!data.show.is_complete || !isShowComplete(data.questions)) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-800">{ko.playSettings.incomplete}</p>
        <Link
          href={`/shows/${id}/edit`}
          className="min-h-11 rounded-lg bg-brand-500 px-5 py-3 font-semibold text-white hover:bg-brand-600"
        >
          {ko.playSettings.goEdit}
        </Link>
      </div>
    );
  }

  return (
    <PlaySettingsForm
      showId={id}
      showTitle={data.show.title}
      questionCount={data.questions.length}
      defaultDate={todayInSeoul()}
    />
  );
}
