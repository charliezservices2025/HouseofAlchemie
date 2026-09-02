/** Inline error shown near the top of a form. Renders nothing without a message. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="border border-danger bg-danger-soft px-3 py-2.5 text-sm leading-relaxed text-danger">
      {message}
    </p>
  );
}

/** Quiet confirmation, for things like "Sent. Check your inbox." */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="border border-line bg-sage-whisper px-3 py-2.5 text-sm leading-relaxed text-ink">
      {message}
    </p>
  );
}
