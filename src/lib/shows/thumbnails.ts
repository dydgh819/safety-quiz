/**
 * Show 대표이미지(SH-03). 기본 이미지 6종은 public/thumbnails/*.svg (단색 배경 + 안전 아이콘, 직접 제작).
 * 업로드한 이미지는 Supabase Storage 공개 URL 을 그대로 저장한다.
 */

export const DEFAULT_THUMBNAILS = [
  { id: "helmet", url: "/thumbnails/helmet.svg" },
  { id: "warning", url: "/thumbnails/warning.svg" },
  { id: "fire", url: "/thumbnails/fire.svg" },
  { id: "first-aid", url: "/thumbnails/first-aid.svg" },
  { id: "electric", url: "/thumbnails/electric.svg" },
  { id: "forklift", url: "/thumbnails/forklift.svg" },
] as const;

export const DEFAULT_THUMBNAIL_URL = DEFAULT_THUMBNAILS[0].url;

export function isDefaultThumbnail(url: string): boolean {
  return DEFAULT_THUMBNAILS.some((t) => t.url === url);
}
