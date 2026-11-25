"use client";

import { useState } from "react";

import { createShowAction, updateShowSettingsAction } from "@/app/(host)/shows/actions";
import { ImageUploadButton } from "@/components/ui/image-upload-button";
import { Modal } from "@/components/ui/modal";
import { SHOW_TITLE_MAX } from "@/lib/quiz/constants";
import { DEFAULT_THUMBNAILS, DEFAULT_THUMBNAIL_URL, isDefaultThumbnail } from "@/lib/shows/thumbnails";
import { ko } from "@/messages/ko";
import type { ShowRow } from "@/types/db";

type Settings = Pick<ShowRow, "title" | "description" | "thumbnail_url">;

type Props =
  | { mode: "create"; onClose: () => void; onCreated: (id: string) => void }
  | { mode: "edit"; show: ShowRow; onClose: () => void; onSaved: (show: ShowRow) => void };

/** A3 Show 기본설정: 제목(필수, 50자)·설명·대표이미지(기본 6종 또는 업로드) */
export function ShowSettingsDialog(props: Props) {
  const initial: Settings =
    props.mode === "edit"
      ? { title: props.show.title, description: props.show.description, thumbnail_url: props.show.thumbnail_url }
      : { title: "", description: "", thumbnail_url: DEFAULT_THUMBNAIL_URL };

  const [values, setValues] = useState<Settings>(initial);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(
    initial.thumbnail_url && !isDefaultThumbnail(initial.thumbnail_url) ? initial.thumbnail_url : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (values.title.trim() === "") {
      setError(ko.showSettings.titleRequired);
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { ...values, title: values.title.trim(), description: values.description.trim() };
    if (props.mode === "create") {
      const result = await createShowAction(payload);
      if (result.ok) props.onCreated(result.data.id);
      else setError(result.error);
    } else {
      const result = await updateShowSettingsAction(props.show.id, payload);
      if (result.ok) props.onSaved(result.data);
      else setError(result.error);
    }
    setBusy(false);
  }

  const formId = "show-settings-form";

  return (
    <Modal
      title={props.mode === "create" ? ko.showSettings.createTitle : ko.showSettings.editTitle}
      onClose={props.onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            className="min-h-11 rounded-lg px-4 font-medium text-neutral-600 hover:bg-neutral-100"
          >
            {ko.common.cancel}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            className="min-h-11 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {props.mode === "create" ? ko.showSettings.create : ko.showSettings.save}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm font-semibold">
            {ko.showSettings.titleLabel}
            <span className="font-normal text-neutral-400">
              {ko.common.charCount(values.title.length, SHOW_TITLE_MAX)}
            </span>
          </span>
          <input
            autoFocus
            value={values.title}
            maxLength={SHOW_TITLE_MAX}
            placeholder={ko.showSettings.titlePlaceholder}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            className="min-h-11 rounded-lg border border-neutral-300 px-3 focus:border-brand-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{ko.showSettings.descriptionLabel}</span>
          <textarea
            value={values.description}
            maxLength={500}
            rows={2}
            placeholder={ko.showSettings.descriptionPlaceholder}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            className="rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{ko.showSettings.thumbnailLabel}</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DEFAULT_THUMBNAILS.map((thumb) => (
              <ThumbOption
                key={thumb.id}
                url={thumb.url}
                label={ko.showSettings.thumbnailName(thumb.id)}
                selected={values.thumbnail_url === thumb.url}
                onSelect={() => setValues({ ...values, thumbnail_url: thumb.url })}
              />
            ))}
            {uploadedUrl && (
              <ThumbOption
                url={uploadedUrl}
                label={ko.showSettings.thumbnailUploaded}
                selected={values.thumbnail_url === uploadedUrl}
                onSelect={() => setValues({ ...values, thumbnail_url: uploadedUrl })}
              />
            )}
          </div>
          <div>
            <ImageUploadButton
              kind="thumbnails"
              label={ko.showSettings.thumbnailUpload}
              onUploaded={(url) => {
                setUploadedUrl(url);
                setValues((v) => ({ ...v, thumbnail_url: url }));
              }}
            />
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function ThumbOption({
  url,
  label,
  selected,
  onSelect,
}: {
  url: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={label}
      className={`overflow-hidden rounded-lg border-2 ${selected ? "border-brand-500 ring-2 ring-brand-200" : "border-transparent"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG·Supabase 공개 URL */}
      <img src={url} alt={label} className="aspect-video w-full object-cover" />
    </button>
  );
}
