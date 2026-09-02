"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_LINES = 6;

type Props = {
  advisorName: string;
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

/**
 * Pinned to the bottom of the chat column. Grows to six lines, then scrolls.
 * Enter sends on a keyboard, Shift+Enter breaks a line. On a touch screen
 * Enter breaks a line and the button sends, which is what people expect there.
 */
export function Composer({ advisorName, busy, disabled, onSend, onStop }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const apply = () => setTouch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 24;
    const chrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const max = Math.round(line * MAX_LINES + chrome);
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    fit();
  }, [value, fit]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || busy || disabled) return;
    onSend(text);
    setValue("");
    // Keep the keyboard open on a phone so the next message is one tap away.
    ref.current?.focus();
  }, [value, busy, disabled, onSend]);

  const canSend = value.trim().length > 0 && !busy && !disabled;

  return (
    <form
      className="safe-bottom shrink-0 border-t border-line bg-cream px-3 pt-3 sm:px-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
        <label htmlFor="chat-composer" className="sr-only">
          Message {advisorName}
        </label>
        <textarea
          id="chat-composer"
          ref={ref}
          name="message"
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? "The composer is paused." : `Message ${advisorName}`}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint={touch ? "enter" : "send"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || touch || e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
          className="min-h-11 w-full min-w-0 resize-none border border-line bg-paper px-3.5 py-2.5 text-[max(1rem,16px)] leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted focus:border-sage focus:shadow-[0_0_0_3px_var(--color-sage-mist)] disabled:cursor-not-allowed disabled:bg-sage-whisper disabled:text-ink-muted"
        />
        {busy ? (
          <button type="button" onClick={onStop} className="btn btn-secondary h-11 shrink-0 px-3.5" aria-label="Stop the reply">
            <Square className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" fill="currentColor" />
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!canSend} className="btn h-11 w-11 shrink-0 px-0" aria-label={`Send to ${advisorName}`}>
            <ArrowUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      {!touch && !disabled && (
        <p className="mx-auto mt-1.5 hidden w-full max-w-3xl text-[0.6875rem] text-ink-muted sm:block" aria-hidden="true">
          Enter to send. Shift and Enter for a new line.
        </p>
      )}
    </form>
  );
}
