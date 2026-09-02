import type { UIMessage } from "ai";

/** Citations only exist on messages loaded from the database, never in the stream. */
export type ChatMessageMetadata = { citations?: string[] };
export type ChatMessage = UIMessage<ChatMessageMetadata>;

export type ChatAdvisor = {
  slug: string;
  name: string;
  title: string;
  tagline: string;
  accentColor: string | null;
};

export type ChatUsage = {
  percent: number;
  warn: boolean;
  overCap: boolean;
  /** "1 October", computed on the server so the client never formats dates */
  resetLabel: string;
};

export type AdvisorQuestion = {
  id: string;
  question: string;
  placeholder?: string;
};

export type FirstMeeting = {
  questions: AdvisorQuestion[];
};
