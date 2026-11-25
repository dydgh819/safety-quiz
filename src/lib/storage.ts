/**
 * 이미지 저장소 상수(Supabase Storage). 004_storage.sql 의 버킷 설정과 같아야 한다.
 */
export const MEDIA_BUCKET = "quiz-media";
/** 업로드 최대 크기(축소 후 기준) */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** 긴 변 최대 픽셀(브라우저에서 이 크기로 줄인 뒤 업로드) */
export const MAX_IMAGE_DIMENSION = 1600;
/** 업로드 허용 형식(축소 후) */
export const UPLOAD_CONTENT_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];
/** 저장 폴더 */
export const UPLOAD_KINDS = ["questions", "choices", "thumbnails"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function extensionFor(contentType: UploadContentType): string {
  return contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
}

/** 이 버킷의 공개 URL 접두사 */
export function mediaPublicPrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;
}

/** 우리 버킷에 올린 이미지 URL 인지(외부 URL 저장 방지) */
export function isOwnMediaUrl(url: string, supabaseUrl: string): boolean {
  const prefix = mediaPublicPrefix(supabaseUrl);
  return url.startsWith(prefix) && /^[a-z]+\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(url.slice(prefix.length));
}
