"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-secondary min-h-11 px-3 text-[0.6875rem]" aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy it by hand" : label}
    </button>
  );
}
