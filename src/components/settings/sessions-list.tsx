"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { revokeOtherSession, signOutEverywhere, type ActionState } from "@/app/(auth)/actions";
import { Notice } from "./notice";

export type SessionRow = {
  id: string;
  device: string;
  lastSeen: string;
  current: boolean;
};

function Row({ row }: { row: SessionRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(revokeOtherSession, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <li className="border-b border-line py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.9375rem] text-ink">
            {row.device}
            {row.current ? (
              <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.18em] text-sage">This device</span>
            ) : null}
          </p>
          <p className="text-xs text-ink-muted">{row.current ? "Active now" : `Last seen ${row.lastSeen}`}</p>
        </div>
        {row.current ? null : (
          <form action={action} className="shrink-0">
            <input type="hidden" name="sessionId" value={row.id} />
            <button type="submit" className="btn btn-secondary" disabled={pending}>
              {pending ? "Signing out" : "Sign out"}
            </button>
          </form>
        )}
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}

async function signOutOthers(): Promise<ActionState> {
  const result = await signOutEverywhere();
  return result.ok ? { ok: true, message: "Signed out everywhere else." } : result;
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState>(signOutOthers, {});
  const others = sessions.filter((s) => !s.current).length;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-5">
      <ul className="border-t border-line">
        {sessions.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </ul>

      <Notice state={state} />

      {others > 0 ? (
        <form action={action}>
          <button type="submit" className="btn btn-secondary" disabled={pending}>
            {pending ? "Signing out" : "Sign out everywhere else"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">You are only signed in here.</p>
      )}
    </div>
  );
}
