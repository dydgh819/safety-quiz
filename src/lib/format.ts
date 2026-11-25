/**
 * 날짜 표시. 서버(UTC)와 브라우저의 시간대가 달라도 같은 문자열이 나오도록 한국 시간으로 고정한다.
 */
const dateTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 2026-11-25T05:03:00Z → "2026. 11. 25. 14:03" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** 휴지통 보관 기간(일) */
export const TRASH_RETENTION_DAYS = 30;

/** 휴지통에 들어간 시각 기준 남은 일수(올림, 최소 0) */
export function trashDaysLeft(deletedAtIso: string, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - new Date(deletedAtIso).getTime();
  const leftMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
}
