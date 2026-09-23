"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** danger = destructive (red); neutral = reversible (ink). */
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Native <dialog> in modal mode: real focus trap, Escape to dismiss, and
 * top-layer rendering, none of which a hand-rolled div gives you. Cancel is
 * first in the DOM so it takes autofocus; confirming is always deliberate.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape (and any programmatic close) unwinds through the same path.
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // Clicks landing on the dialog itself are backdrop clicks. The card
      // below stops propagation.
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border-0 bg-transparent p-0 backdrop:bg-ink/45"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-base font-extrabold tracking-tight">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-stone-500">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            autoFocus
            onClick={onCancel}
            className="min-h-[2.6rem] rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 transition-all hover:-translate-y-px hover:border-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-[2.6rem] rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 ${
              tone === "danger"
                ? "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600"
                : "bg-ink hover:bg-stone-800 focus-visible:outline-ink"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
