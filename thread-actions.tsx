import { useState, type ReactElement } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { experimental_useSidebarThreadActions, experimental_useSidebarThreadSplit } from "@get-bb/plugin-sdk/app";
import { Icon } from "./ui/icon";

const menuItemClass: string = "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-[0.3125rem] text-left text-xs hover:bg-state-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

interface ThreadActionsProps {
  thread: PluginSidebarThread;
  onClose: () => void;
}

/** Thread actions use the host flows, including archive and delete confirmations. */
export function ThreadActions({ thread, onClose }: ThreadActionsProps): ReactElement {
  const actions = experimental_useSidebarThreadActions();
  const split = experimental_useSidebarThreadSplit(thread.id);
  const [renaming, setRenaming] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(thread.title ?? "");
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  async function submit(request: () => Promise<void>): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await request();
      onClose();
    } catch (cause: unknown) {
      if (!(cause instanceof Error)) throw cause;
      setError(cause);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Thread actions" className="mt-3 border-t border-border pt-2">
      <button className={menuItemClass} disabled={pending || !split.isAvailable} type="button" onClick={() => {
        actions.open(thread.id, { split: true });
        onClose();
      }}>
        <Icon name="PanelLeft" aria-hidden="true" className="size-4 shrink-0" />
        Open in split
      </button>
      <button className={menuItemClass} disabled={pending} type="button" onClick={() => {
        void submit(() => actions.setRead(thread.id, thread.isUnread));
      }}>
        <Icon name={thread.isUnread ? "MailOpen" : "Mail"} aria-hidden="true" className="size-4 shrink-0" />
        {thread.isUnread ? "Mark read" : "Mark unread"}
      </button>
      <button className={menuItemClass} disabled={pending} type="button" onClick={() => {
        void submit(() => actions.setPinned(thread.id, !thread.isPinned));
      }}>
        <Icon name={thread.isPinned ? "PinOff" : "Pin"} aria-hidden="true" className="size-4 shrink-0" />
        {thread.isPinned ? "Unpin" : "Pin"}
      </button>
      {renaming ? (
        <form className="my-1 flex flex-col gap-2 px-2" onSubmit={(event) => {
          event.preventDefault();
          const nextTitle: string = title.trim();
          if (nextTitle.length === 0 || pending) return;
          void submit(() => actions.rename(thread.id, nextTitle));
        }}>
          <input aria-label="Thread name" autoFocus className="w-full rounded border border-input bg-background px-2 py-1 text-sm" disabled={pending} value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="flex gap-2">
            <button className="cursor-pointer text-xs disabled:opacity-50" disabled={pending || title.trim().length === 0} type="submit">Save</button>
            <button className="cursor-pointer text-xs disabled:opacity-50" disabled={pending} type="button" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className={menuItemClass} disabled={pending} type="button" onClick={() => setRenaming(true)}>
          <Icon name="Pencil" aria-hidden="true" className="size-4 shrink-0" />
          Rename
        </button>
      )}
      <div className="my-1 border-t border-border" />
      <button className={menuItemClass} disabled={pending} type="button" onClick={() => {
        actions.archive(thread.id);
        onClose();
      }}>
        <Icon name="Archive" aria-hidden="true" className="size-4 shrink-0" />
        Archive
      </button>
      <button className={`${menuItemClass} text-destructive hover:text-destructive`} disabled={pending} type="button" onClick={() => {
        actions.requestDelete(thread.id);
        onClose();
      }}>
        <Icon name="Trash2" aria-hidden="true" className="size-4 shrink-0" />
        Delete
      </button>
      {error === null ? null : <p role="alert" className="mt-2 px-2 text-xs text-destructive">Could not update this thread. Please try again.</p>}
    </section>
  );
}
