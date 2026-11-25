"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  copyShowAction,
  deleteShowPermanentlyAction,
  restoreShowAction,
  trashShowAction,
} from "@/app/(host)/shows/actions";
import { ShowSettingsDialog } from "@/components/shows/show-settings-dialog";
import type { ActionResult } from "@/lib/action-result";
import type { ShowListItem } from "@/lib/db/shows";
import { formatDateTime, trashDaysLeft } from "@/lib/format";
import { DEFAULT_THUMBNAIL_URL } from "@/lib/shows/thumbnails";
import { ko } from "@/messages/ko";

type Props = {
  shows: ShowListItem[];
  trashed: ShowListItem[];
};

/** A2 My Show: 카드 목록·검색·휴지통 탭·카드 메뉴 */
export function ShowBoard({ shows, trashed }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const source = tab === "active" ? shows : trashed;
  const q = query.trim().toLowerCase();
  const visible = q ? source.filter((s) => s.title.toLowerCase().includes(q)) : source;

  function runAction(work: () => Promise<ActionResult<unknown>>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ko.shows.title}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-12 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600"
        >
          {ko.shows.create}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200">
        <div className="flex gap-1" role="tablist">
          <TabButton active={tab === "active"} onClick={() => setTab("active")}>
            {ko.shows.tabActive} <span className="text-neutral-400">{shows.length}</span>
          </TabButton>
          <TabButton active={tab === "trash"} onClick={() => setTab("trash")}>
            {ko.shows.tabTrash} <span className="text-neutral-400">{trashed.length}</span>
          </TabButton>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ko.shows.searchPlaceholder}
          aria-label={ko.shows.searchPlaceholder}
          className="mb-2 min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm sm:w-64"
        />
      </div>

      {tab === "trash" && <p className="text-sm text-neutral-500">{ko.shows.trashHint}</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          text={
            q ? ko.shows.noSearchResult : tab === "active" ? ko.shows.empty : ko.shows.trashEmpty
          }
          hint={!q && tab === "active" ? ko.shows.emptyHint : undefined}
        />
      ) : (
        <ul className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
          {visible.map((show) => (
            <li key={show.id}>
              {tab === "active" ? (
                <ActiveCard
                  show={show}
                  onCopy={() => runAction(() => copyShowAction(show.id))}
                  onTrash={() => {
                    if (window.confirm(ko.shows.confirmTrash(show.title))) runAction(() => trashShowAction(show.id));
                  }}
                />
              ) : (
                <TrashCard
                  show={show}
                  onRestore={() => runAction(() => restoreShowAction(show.id))}
                  onDeleteForever={() => {
                    if (window.confirm(ko.shows.confirmDeleteForever(show.title))) {
                      runAction(() => deleteShowPermanentlyAction(show.id));
                    }
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ShowSettingsDialog
          mode="create"
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/shows/${id}/edit`)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px min-h-11 border-b-2 px-4 font-semibold ${
        active ? "border-brand-500 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <p className="text-lg font-semibold text-neutral-700">{text}</p>
      {hint && <p className="mt-2 text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

function Thumbnail({ show }: { show: ShowListItem }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 정적 SVG·Supabase 공개 URL
    <img src={show.thumbnail_url ?? DEFAULT_THUMBNAIL_URL} alt="" className="aspect-video w-full object-cover" />
  );
}

function ActiveCard({ show, onCopy, onTrash }: { show: ShowListItem; onCopy: () => void; onTrash: () => void }) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/shows/${show.id}/edit`} className="flex flex-1 flex-col">
        <Thumbnail show={show} />
        <div className="flex flex-1 flex-col gap-1 px-4 py-3">
          <h2 className="flex items-start gap-2 font-semibold break-keep">
            {!show.is_complete && (
              <span
                title={ko.shows.incompleteTitle}
                className="mt-0.5 shrink-0 rounded bg-amber-100 px-1.5 text-xs leading-5 font-bold text-amber-700"
              >
                ! {ko.shows.incomplete}
              </span>
            )}
            <span className="line-clamp-2">{show.title}</span>
          </h2>
          <p className="mt-auto text-sm text-neutral-500">
            {ko.shows.questionCount(show.question_count)} · {ko.shows.updatedAt(formatDateTime(show.updated_at))}
          </p>
        </div>
      </Link>
      <div className="absolute top-2 right-2">
        <CardMenu
          items={[
            {
              label: ko.shows.menuPlay,
              disabled: true,
              title: show.is_complete ? ko.common.comingSoon(4) : ko.shows.playNeedsComplete,
            },
            { label: ko.shows.menuEdit, href: `/shows/${show.id}/edit` },
            { label: ko.shows.menuCopy, onSelect: onCopy },
            { label: ko.shows.menuPreview, href: `/shows/${show.id}/preview` },
            { label: ko.shows.menuDelete, onSelect: onTrash, danger: true },
          ]}
        />
      </div>
    </article>
  );
}

function TrashCard({
  show,
  onRestore,
  onDeleteForever,
}: {
  show: ShowListItem;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const deletedAt = show.deleted_at ?? show.updated_at;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white opacity-90">
      <div className="grayscale">
        <Thumbnail show={show} />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <h2 className="line-clamp-2 font-semibold">{show.title}</h2>
        <p className="text-sm text-neutral-500">
          {ko.shows.deletedAt(formatDateTime(deletedAt), trashDaysLeft(deletedAt))}
        </p>
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="min-h-10 flex-1 rounded-lg border border-neutral-300 font-medium hover:bg-neutral-50"
          >
            {ko.shows.menuRestore}
          </button>
          <button
            type="button"
            onClick={onDeleteForever}
            className="min-h-10 flex-1 rounded-lg border border-red-200 font-medium text-red-600 hover:bg-red-50"
          >
            {ko.shows.menuDeleteForever}
          </button>
        </div>
      </div>
    </article>
  );
}

type MenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
};

function CardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = (item: MenuItem) =>
    `block w-full px-4 py-2.5 text-left text-sm ${
      item.disabled ? "cursor-not-allowed text-neutral-300" : item.danger ? "text-red-600 hover:bg-red-50" : "hover:bg-neutral-100"
    }`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ko.shows.menu}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-neutral-700 shadow hover:bg-white"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {items.map((item) =>
            item.href && !item.disabled ? (
              <Link key={item.label} href={item.href} role="menuitem" className={itemClass(item)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={itemClass(item)}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
