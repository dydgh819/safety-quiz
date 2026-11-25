import { MAX_IMAGE_DIMENSION, type UploadContentType } from "@/lib/storage";

/**
 * 브라우저에서 이미지를 긴 변 1600px 이하로 줄이고 WebP 로 바꾼다(브라우저 전용).
 * WebP 인코딩을 지원하지 않는 브라우저(구형 Safari)는 JPEG 로 대신한다.
 */
export async function resizeImage(file: File): Promise<{ blob: Blob; contentType: UploadContentType }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d context unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, contentType: "image/webp" };

  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("image encoding failed");
  return { blob: jpeg, contentType: "image/jpeg" };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
