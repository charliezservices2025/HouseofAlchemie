"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { ChatAdvisor, ChatMessage } from "./types";
import { AssistantMessage } from "./assistant-message";

const NEAR_BOTTOM_PX = 56;

export function messageText(m: ChatMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

type Props = {
  advisor: ChatAdvisor;
  messages: ChatMessage[];
  streaming: boolean;
  /** A message has been sent and the first byte of the reply has not arrived */
  pending: boolean;
  /** Rendered inside the scroll area when there are no messages */
  children?: React.ReactNode;
};

/**
 * The scrolling column. Follows new content while the reader is at the
 * bottom, and stops following the moment they scroll up to re-read.
 */
export function MessageList({ advisor, messages, streaming, pending, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stuckRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stuckRef.current = true;
    setShowJump(false);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const stuck = distance <= NEAR_BOTTOM_PX;
    stuckRef.current = stuck;
    setShowJump(!stuck && messages.length > 0);
  }, [messages.length]);

  // Land at the bottom on first paint, before the reader sees the top of a long thread.
  useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  // Follow the stream while stuck to the bottom. When the reader has scrolled
  // up, the scroll handler has already shown the Jump to latest button.
  useEffect(() => {
    if (stuckRef.current) scrollToBottom("auto");
  }, [messages, streaming, pending, scrollToBottom]);

  // When the keyboard opens the column shrinks. Keep the latest line in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stuckRef.current) scrollToBottom("auto");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {messages.length === 0 ? (
          children
        ) : (
          <ol className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6">
            {messages.map((m) => {
              const text = messageText(m);
              if (m.role === "user") {
                return (
                  <li key={m.id} className="flex justify-end">
                    <div className="max-w-[88%] whitespace-pre-wrap break-words border border-line bg-sage-mist px-4 py-3 text-[0.9375rem] leading-relaxed text-ink sm:max-w-[75%]">
                      {text}
                    </div>
                  </li>
                );
              }
              if (m.role !== "assistant") return null;
              return (
                <li key={m.id} className="flex justify-start">
                  <AssistantMessage
                    advisorName={advisor.name}
                    text={text}
                    streaming={streaming && m.id === lastAssistantId}
                    citations={m.metadata?.citations}
                  />
                </li>
              );
            })}
            {pending && (
              <li className="flex justify-start" aria-live="polite">
                <div>
                  <p className="eyebrow mb-2">{advisor.name}</p>
                  <span className="caret text-[0.9375rem] text-ink-muted">Thinking</span>
                </div>
              </li>
            )}
          </ol>
        )}
      </div>
      {showJump && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="btn btn-secondary pointer-events-auto h-11 bg-cream px-4 text-[0.6875rem]"
          >
            <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Jump to latest
          </button>
        </div>
      )}
    </div>
  );
}
