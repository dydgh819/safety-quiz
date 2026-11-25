"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { lookupPin } from "@/lib/client/play-client";
import { isValidPin } from "@/lib/game/pin";
import { PIN_LENGTH } from "@/lib/quiz/constants";
import { ko } from "@/messages/ko";

/** M1 PIN 입력(JN-03): 숫자 6자리 → 회차 확인 → /play/[pin] */
export function PinForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPin(pin)) {
      setError(ko.join.invalidPin);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await lookupPin(pin);
    if (result.ok) {
      router.push(`/play/${pin}`);
      return;
    }
    setError(ko.play.errors[result.error]);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-center font-semibold text-neutral-600">{ko.join.pinLabel}</span>
        <input
          value={pin}
          // 숫자만 남기고 6자리로 자른다("123 456", "123-456" 붙여넣기 허용). maxLength 를 쓰면 기호 포함 글자 수로 잘려 버린다
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          autoFocus
          aria-invalid={!!error}
          className="min-h-16 rounded-2xl border-2 border-neutral-300 text-center text-4xl font-extrabold tracking-[0.3em] tabular-nums focus:border-brand-500 focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || pin.length !== PIN_LENGTH}
        className="min-h-14 rounded-2xl bg-brand-500 text-xl font-bold text-white disabled:opacity-40"
      >
        {busy ? ko.join.checking : ko.join.submit}
      </button>
    </form>
  );
}
