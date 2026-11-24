import { ko } from "@/messages/ko";

/** A7 리포트 — 7단계에서 구현. 지금은 내비 링크가 404 가 되지 않도록 자리만. */
export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{ko.reports.title}</h1>
      <p className="text-neutral-500">{ko.reports.comingSoon}</p>
    </div>
  );
}
