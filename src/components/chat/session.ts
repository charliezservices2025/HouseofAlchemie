import { DefaultChatTransport } from "ai";
import type { ChatMessage } from "./types";

/**
 * Owns the transport to /api/chat and the two things the browser has to
 * remember between requests: which conversation this is, assigned by the
 * server on the first reply and read back from the x-conversation-id header,
 * and the HTTP status of the last response, which the stream error message
 * (the response body text) does not carry.
 *
 * The server owns history, so only the last user message is sent.
 */
export class ChatSession {
  readonly transport: DefaultChatTransport<ChatMessage>;
  private readonly advisorSlug: string;
  private conversationId: string | null;
  private awaitingFirstReply: boolean;
  private lastStatus = 0;
  private pendingUrl: string | null = null;

  constructor(advisorSlug: string, conversationId: string | null) {
    this.advisorSlug = advisorSlug;
    this.conversationId = conversationId;
    this.awaitingFirstReply = conversationId === null;
    this.transport = new DefaultChatTransport<ChatMessage>({
      api: "/api/chat",
      fetch: (input, init) => this.trackedFetch(input, init),
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          advisorSlug: this.advisorSlug,
          conversationId: this.conversationId ?? undefined,
          messages: messages.slice(-1),
        },
      }),
    });
  }

  /** 0 when the request never reached the server. */
  get status(): number {
    return this.lastStatus;
  }

  /** The conversation this screen is writing to, once the server has assigned one. */
  get currentConversationId(): string | null {
    return this.conversationId;
  }

  /**
   * True exactly once: after the request that created the conversation has
   * ended, however it ended. A request that never produced a conversation
   * (a 503, a dropped connection) leaves the flag alone so the next attempt
   * still gets its refresh.
   */
  completeReply(): boolean {
    if (!this.awaitingFirstReply || !this.conversationId) return false;
    this.awaitingFirstReply = false;
    return true;
  }

  /**
   * The address this screen should show once the conversation exists.
   * Returned once. The URL is swapped with history.replaceState rather than a
   * navigation so the screen never remounts and the stream is never cut, and
   * only after router.refresh() has settled, because a refresh issued after
   * the swap makes Next see a different route segment and reload the page.
   */
  takePendingUrl(): string | null {
    const url = this.pendingUrl;
    this.pendingUrl = null;
    return url;
  }

  private async trackedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    this.lastStatus = 0;
    const res = await fetch(input, init);
    this.lastStatus = res.status;
    const id = res.headers.get("x-conversation-id");
    if (res.ok && id && !this.conversationId) {
      this.conversationId = id;
      this.pendingUrl = `/chat/${this.advisorSlug}/${id}`;
    }
    return res;
  }
}
