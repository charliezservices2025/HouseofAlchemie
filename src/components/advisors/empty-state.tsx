export function EmptyState({ email, salesUrl, supportEmail }: { email: string; salesUrl: string; supportEmail: string }) {
  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow">Nothing unlocked yet</p>
      <h2 className="mt-1 text-2xl">Your team is waiting on Kajabi</h2>
      <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
        Access here is granted automatically when you subscribe to an advisor or a suite on Kajabi with this same email, {email}. It
        usually arrives a minute or two after checkout.
      </p>
      <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
        Already subscribed under a different email? Write to{" "}
        <a href={`mailto:${supportEmail}`} className="text-sage underline underline-offset-4">
          {supportEmail}
        </a>{" "}
        and we will connect the two.
      </p>
      <div className="mt-6">
        <a href={salesUrl} target="_blank" rel="noopener noreferrer" className="btn w-full sm:w-auto">
          Choose an advisor on Kajabi
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}
