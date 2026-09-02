"use client";

import { useActionState, useState } from "react";
import { archiveConversation, renameConversation, restoreConversation } from "@/app/(app)/conversations/actions";
import type { ActionState } from "@/app/(auth)/actions";

type Props = { id: string; title: string; archived: boolean };

const linkButton =
  "inline-flex min-h-11 items-center px-1 text-xs tracking-[0.08em] text-ink-muted uppercase transition-colors hover:text-ink disabled:opacity-45";

/** Rename and archive, inline, without leaving the list. */
export function ConversationActions({ id, title, archived }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [renameState, renameAction, renamePending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await renameConversation(prev, form);
    if (result.ok) setRenaming(false);
    return result;
  }, {});
  const [archiveState, archiveAction, archivePending] = useActionState<ActionState, FormData>(
    archived ? restoreConversation : archiveConversation,
    {},
  );

  if (renaming) {
    const inputId = `rename-${id}`;
    return (
      <form action={renameAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor={inputId} className="sr-only">
          New name
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            name="title"
            defaultValue={title}
            maxLength={120}
            required
            autoFocus
            disabled={renamePending}
            className="field min-w-0 flex-1 text-[max(1rem,16px)]!"
          />
          <button type="submit" disabled={renamePending} className="btn h-11 shrink-0 px-4">
            Save
          </button>
          <button type="button" onClick={() => setRenaming(false)} disabled={renamePending} className="btn btn-ghost h-11 shrink-0 px-3">
            Cancel
          </button>
        </div>
        {renameState.error && (
          <p role="alert" className="text-sm text-danger">
            {renameState.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-5">
      <button type="button" onClick={() => setRenaming(true)} className={linkButton}>
        Rename
      </button>
      <form action={archiveAction}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={archivePending} className={linkButton}>
          {archived ? "Restore" : "Archive"}
        </button>
      </form>
      {archiveState.error && (
        <span role="alert" className="text-sm text-danger">
          {archiveState.error}
        </span>
      )}
    </div>
  );
}
