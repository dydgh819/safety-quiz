"use client";

import { useEffect, useId } from "react";

import { ko } from "@/messages/ko";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
};

/** 간단한 모달. Esc·배경 클릭으로 닫힌다. */
export function Modal({ title, onClose, children, footer, wide }: Props) {
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={ko.common.close}
            className="flex size-10 items-center justify-center rounded-lg text-xl text-neutral-500 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
