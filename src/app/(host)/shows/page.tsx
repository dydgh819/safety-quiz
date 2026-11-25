import { Suspense } from "react";
import { connection } from "next/server";

import { ShowBoard } from "@/components/shows/show-board";
import { DbErrorNotice, supabaseSetupNotice } from "@/components/ui/setup-notice";
import { listShows, listTrashedShows } from "@/lib/db/shows";
import { ko } from "@/messages/ko";

/** A2 My Show */
export default function ShowsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Suspense fallback={<p className="text-neutral-500">{ko.shows.loading}</p>}>
        <ShowsLoader />
      </Suspense>
    </div>
  );
}

async function ShowsLoader() {
  // DB 조회는 요청 시점에만(빌드 시 프리렌더 제외)
  await connection();

  const setupNotice = supabaseSetupNotice();
  if (setupNotice) return setupNotice;

  let data;
  try {
    data = await Promise.all([listShows(), listTrashedShows()]);
  } catch (error) {
    console.error(error);
    return <DbErrorNotice error={error} />;
  }
  const [shows, trashed] = data;
  return <ShowBoard shows={shows} trashed={trashed} />;
}
