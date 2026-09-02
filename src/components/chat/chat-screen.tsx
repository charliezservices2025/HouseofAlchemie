"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { ChatAdvisor, ChatMessage, ChatUsage, FirstMeeting } from "./types";
import { ChatSession } from "./session";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { FirstMeetingForm } from "./first-meeting";
import { UsageMeter } from "./usage-meter";

type Props = {
  advisor: ChatAdvisor;
  initialMessages: ChatMessage[];
  conversationId: string | null;
  usage: ChatUsage;
  aiConfigured: boolean;
  firstMeeting: FirstMeeting | null;
};

type Blocker = { kind: "not-configured" } | { kind: "over-cap"; message: string } | null;
type Notice = { message: string; retry: boolean } | null;

/** The transport surfaces a failed response as an Error whose message is the body text. */
function parseErrorBody(message: string): { error?: string; code?: string } {
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const { error, code } = parsed as Record<string, unknown>;
      return { error: typeof error === "string" ? error : undefined, code: typeof code === "string" ? code : undefined };
    }
  } catch {
    // Not JSON: a network failure or a plain text body.
  }
  return {};
}

/**
 * A new conversation starts at /chat/{slug} and, once the server has assigned
 * an id, the address is swapped to /chat/{slug}/{id} without a navigation so
 * the stream is never cut. The router still believes it is showing the
 * /chat/{slug} page, so tapping the advisor in the rail afterwards (which
 * means "start a fresh one") would otherwise re-render this same screen with
 * the same key and the old conversation would stay put. This wrapper notices
 * the address going back to /chat/{slug} after a swap and remounts the screen.
 */
export function ChatScreen(props: Props) {
  const pathname = usePathname();
  const [generation, setGeneration] = useState(0);
  const swappedRef = useRef(false);

  useEffect(() => {
    if (props.conversationId !== null) return;
    if (swappedRef.current && pathname === `/chat/${props.advisor.slug}`) {
      swappedRef.current = false;
      setGeneration((g) => g + 1);
    }
  }, [pathname, props.conversationId, props.advisor.slug]);

  const onUrlSwapped = useCallback(() => {
    swappedRef.current = true;
  }, []);

  return <ChatScreenBody key={generation} {...props} onUrlSwapped={onUrlSwapped} />;
}

function ChatScreenBody({ advisor, initialMessages, conversationId, usage, aiConfigured, firstMeeting, onUrlSwapped }: Props & { onUrlSwapped: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  // The page keys this component by advisor and conversation, so one session
  // lives exactly as long as this screen does.
  const [session] = useState(() => new ChatSession(advisor.slug, conversationId));
  const [refreshing, startRefresh] = useTransition();

  const capMessage = `You have used this month's allowance for ${advisor.name}. It resets on ${usage.resetLabel}.`;
  const [blocker, setBlocker] = useState<Blocker>(() => {
    if (!aiConfigured) return { kind: "not-configured" };
    if (usage.overCap) return { kind: "over-cap", message: capMessage };
    return null;
  });
  const [notice, setNotice] = useState<Notice>(null);
  const [meeting, setMeeting] = useState<FirstMeeting | null>(firstMeeting);

  const { messages, sendMessage, status, stop, regenerate, clearError } = useChat<ChatMessage>({
    transport: session.transport,
    messages: initialMessages,
    onError: (err) => {
      const httpStatus = session.status;
      const body = parseErrorBody(err.message);
      if (body.code === "AI_NOT_CONFIGURED" || httpStatus === 503) {
        setBlocker({ kind: "not-configured" });
      } else if (body.code === "OVER_CAP" || httpStatus === 429) {
        setBlocker({ kind: "over-cap", message: body.error ?? capMessage });
      } else if (httpStatus === 401) {
        router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      } else if (httpStatus === 403) {
        router.push("/advisors");
      } else if (httpStatus === 0) {
        setNotice({ message: "The connection dropped before the reply arrived. Check your signal and try again.", retry: true });
      } else if (httpStatus >= 500) {
        setNotice({ message: "Something went wrong at our end. Try again in a moment.", retry: true });
      } else if (httpStatus === 200) {
        setNotice({ message: "The reply was cut short. Try again.", retry: true });
      } else {
        setNotice({ message: body.error ?? "That did not go through. Try again.", retry: false });
      }
    },
    onFinish: () => {
      // The rail lists recent conversations. Once the server has created this
      // one (even if the reply was stopped early), re-render the server tree
      // while the address still matches it; the URL swap follows once this
      // settles.
      if (session.completeReply()) startRefresh(() => router.refresh());
    },
  });

  useEffect(() => {
    if (refreshing) return;
    const url = session.takePendingUrl();
    if (url) {
      window.history.replaceState(null, "", url);
      onUrlSwapped();
    }
  }, [refreshing, session, onUrlSwapped]);

  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || blocker || busy) return;
      setNotice(null);
      clearError();
      void sendMessage({ text: clean });
    },
    [blocker, busy, clearError, sendMessage],
  );

  const retry = useCallback(() => {
    setNotice(null);
    clearError();
    void regenerate();
  }, [clearError, regenerate]);

  // Size the column to the visible viewport, so the composer sits above the
  // keyboard on a phone instead of underneath it. The shell's main column has
  // a min height, not a height, so this is measured rather than inherited.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const vv = window.visualViewport;
    const update = () => {
      const top = Math.max(0, el.getBoundingClientRect().top);
      const height = vv ? vv.offsetTop + vv.height : window.innerHeight;
      el.style.height = `${Math.max(240, Math.round(height - top))}px`;
    };
    update();
    window.addEventListener("resize", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      el.style.height = "";
    };
  }, []);

  const shownUsage: ChatUsage =
    blocker?.kind === "over-cap" ? { ...usage, overCap: true, percent: Math.max(100, usage.percent) } : usage;

  return (
    <div ref={rootRef} className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col lg:h-dvh">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl leading-tight text-ink">{advisor.name}</h1>
          <p className="truncate text-xs text-ink-muted">{advisor.title}</p>
        </div>
        <UsageMeter usage={shownUsage} />
      </header>

      {meeting ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FirstMeetingForm advisor={advisor} firstMeeting={meeting} onDone={() => setMeeting(null)} />
        </div>
      ) : (
        <>
          <MessageList advisor={advisor} messages={messages} streaming={status === "streaming"} pending={status === "submitted"}>
            <EmptyState advisor={advisor} onPick={send} disabled={Boolean(blocker) || busy} />
          </MessageList>

          {(blocker || notice) && (
            <div className="shrink-0 px-3 pb-2 sm:px-4">
              <div className="mx-auto w-full max-w-3xl">
                {blocker?.kind === "not-configured" && (
                  <p role="status" className="border-l-2 border-gold bg-paper px-4 py-3 text-sm leading-relaxed text-ink-soft">
                    {advisor.name} is not connected yet. Please check back soon.
                  </p>
                )}
                {blocker?.kind === "over-cap" && (
                  <p role="status" className="border-l-2 border-danger bg-paper px-4 py-3 text-sm leading-relaxed text-ink-soft">
                    {blocker.message}
                  </p>
                )}
                {!blocker && notice && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 border-danger bg-paper px-4 py-2 text-sm leading-relaxed text-ink-soft">
                    <span>{notice.message}</span>
                    {notice.retry && (
                      <button type="button" onClick={retry} className="btn btn-ghost h-11 px-3 text-[0.6875rem]">
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <Composer advisorName={advisor.name} busy={busy} disabled={Boolean(blocker)} onSend={send} onStop={stop} />
        </>
      )}
    </div>
  );
}
