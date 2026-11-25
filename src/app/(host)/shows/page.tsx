import { Suspense } from "react";
import { connection } from "next/server";

import { classifyDbError, toDbErrorInfo } from "@/lib/db/errors";
import { listShows } from "@/lib/db/shows";
import { detectWrongServerKey, listMissingSupabaseEnv } from "@/lib/supabase/admin";
import { ko } from "@/messages/ko";

/** A2 My Show — 1단계는 목록 조회와 빈 상태만. 카드·만들기·메뉴는 2단계. */
export default function ShowsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{ko.shows.title}</h1>
        <button
          type="button"
          disabled
          title={ko.shows.createComingSoon}
          className="min-h-12 rounded-lg bg-brand-500 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ko.shows.create}
        </button>
      </div>

      <Suspense fallback={<p className="text-neutral-500">{ko.shows.loading}</p>}>
        <ShowList />
      </Suspense>
    </div>
  );
}

async function ShowList() {
  // DB 조회는 요청 시점에만(빌드 시 프리렌더 제외)
  await connection();

  const missingEnv = listMissingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <Notice
        title={ko.errors.supabaseNotConfigured}
        hint={ko.errors.supabaseNotConfiguredHint(missingEnv)}
      />
    );
  }

  if (detectWrongServerKey()) {
    return <Notice title={ko.errors.supabaseNotConfigured} hint={ko.errors.wrongServerKey} />;
  }

  let shows;
  try {
    shows = await listShows();
  } catch (error) {
    console.error(error);
    const info = toDbErrorInfo(error);
    return (
      <Notice
        title={ko.errors.loadFailed}
        hint={ko.errors.dbErrorHint[classifyDbError(info)]}
        detail={ko.errors.dbErrorDetail(info.code, info.message)}
      />
    );
  }

  if (shows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
        <p className="text-lg font-semibold text-neutral-700">{ko.shows.empty}</p>
        <p className="mt-2 text-sm text-neutral-500">{ko.shows.emptyHint}</p>
      </div>
    );
  }

  // 2단계에서 카드 목록(썸네일·검색·메뉴)으로 교체
  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">{ko.shows.count(shows.length)}</p>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {shows.map((show) => (
          <li key={show.id} className="flex items-center justify-between px-5 py-4">
            <span className="font-medium">
              {show.title}
              {!show.is_complete && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">
                  ! {ko.shows.incomplete}
                </span>
              )}
            </span>
            <span className="text-sm text-neutral-500">{ko.shows.questionCount(show.question_count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ title, hint, detail }: { title: string; hint: string; detail?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
      <p className="font-semibold text-red-700">{title}</p>
      <p className="mt-1 text-sm text-red-600">{hint}</p>
      {detail && <p className="mt-2 font-mono text-xs break-all text-red-500">{detail}</p>}
    </div>
  );
}
