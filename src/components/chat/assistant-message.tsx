import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  advisorName: string;
  text: string;
  streaming: boolean;
  citations?: string[];
};

function AssistantMessageBase({ advisorName, text, streaming, citations }: Props) {
  return (
    <div className="max-w-full">
      <p className="eyebrow mb-2">{advisorName}</p>
      {/* No aria-live here: a live region on streaming text would re-announce the whole reply on every token. */}
      <div className={`prose-hoa min-w-0 break-words ${streaming ? "caret" : ""}`} aria-busy={streaming || undefined}>
        {text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : null}
      </div>
      {citations && citations.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">Drawn from: {citations.join(", ")}</p>
      )}
    </div>
  );
}

export const AssistantMessage = memo(AssistantMessageBase);
