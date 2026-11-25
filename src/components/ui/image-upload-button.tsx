"use client";

import { useRef, useState } from "react";

import { createUploadUrlAction } from "@/app/(host)/shows/actions";
import { resizeImage } from "@/lib/image/resize";
import { MAX_UPLOAD_BYTES, MEDIA_BUCKET, type UploadKind } from "@/lib/storage";
import { getBrowserClient } from "@/lib/supabase/client";
import { ko } from "@/messages/ko";

type Props = {
  kind: UploadKind;
  label?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
};

/**
 * 이미지 선택 → 브라우저에서 1600px·WebP 로 축소 → 서버가 발급한 서명 URL 로 업로드.
 * 브라우저의 Supabase 클라이언트는 서명 URL 업로드에만 쓴다(테이블 접근 없음).
 */
export function ImageUploadButton({ kind, label, ariaLabel, className, disabled, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(ko.upload.notImage);
      return;
    }
    setBusy(true);
    try {
      const { blob, contentType } = await resizeImage(file);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(ko.upload.tooLarge);
        return;
      }
      const result = await createUploadUrlAction({ kind, contentType, size: blob.size });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { error: uploadError } = await getBrowserClient()
        .storage.from(MEDIA_BUCKET)
        .uploadToSignedUrl(result.data.path, result.data.token, blob, { contentType });
      if (uploadError) {
        console.error(uploadError);
        setError(ko.upload.failed);
        return;
      }
      onUploaded(result.data.publicUrl);
    } catch (e) {
      console.error(e);
      setError(ko.upload.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          "min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        }
      >
        {busy ? ko.upload.uploading : (label ?? ko.upload.button)}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
