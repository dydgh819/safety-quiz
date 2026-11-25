import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ShowEditor } from "@/components/editor/show-editor";
import { DbErrorNotice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { getShowWithQuestions } from "@/lib/db/shows";
import { uuidSchema } from "@/lib/validation/show";
import { ko } from "@/messages/ko";

/** A4 Show 편집 */
export default function EditShowPage({ params }: PageProps<"/shows/[id]/edit">) {
  return (
    <Suspense fallback={<p className="p-8 text-neutral-500">{ko.editor.loading}</p>}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: { params: PageProps<"/shows/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const setupNotice = supabaseSetupNotice();
  if (setupNotice) return <div className="p-8">{setupNotice}</div>;

  let data;
  try {
    data = await getShowWithQuestions(id);
  } catch (error) {
    console.error(error);
    return (
      <div className="p-8">
        <DbErrorNotice error={error} />
      </div>
    );
  }
  if (!data) notFound();

  return <ShowEditor initialShow={data.show} initialQuestions={data.questions} />;
}
