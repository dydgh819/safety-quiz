import Link from "next/link";

import { ko } from "@/messages/ko";

/** 교육자 PC 화면 공통 레이아웃. 로그인 없음(D-26)이라 로그아웃 메뉴도 없다. */
export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
          <Link href="/shows" className="text-lg font-bold text-brand-600">
            {ko.app.name}
          </Link>
          <nav aria-label={ko.nav.mainLabel} className="flex gap-6 text-sm font-medium">
            <Link href="/shows" className="text-neutral-700 hover:text-brand-600">
              {ko.nav.shows}
            </Link>
            <Link href="/reports" className="text-neutral-700 hover:text-brand-600">
              {ko.nav.reports}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
