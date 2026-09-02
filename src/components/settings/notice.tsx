import type { ActionState } from "@/app/(auth)/actions";

/**
 * Renders the outcome of a server action. The live region is always present
 * so screen readers announce a message the moment it appears. The inner
 * paragraphs carry no role of their own: a role="alert" inside a live region
 * is read twice.
 */
export function Notice({ state }: { state: ActionState }) {
  return (
    <div aria-live="polite">
      {state.error ? (
        <p className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : state.ok && state.message ? (
        <p className="border-l-2 border-sage bg-sage-whisper px-3 py-2 text-sm text-sage-deep">{state.message}</p>
      ) : null}
    </div>
  );
}
