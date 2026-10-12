import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PluginSidebarPullRequest, PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { UrlLink, experimental_useSidebarThreadPullRequest } from "@get-bb/plugin-sdk/app";
import { usePortalScopeProps } from "./lib/portal-scope";
import { Icon } from "./ui/icon";
import { ThreadActions } from "./thread-actions";

type PullRequestBadgePresentation = {
  label: string;
  icon: string;
  textClassName: string;
  chipClassName: string;
};

type CardPosition = {
  top: number;
  left: number;
};

const OPEN_DELAY_MS: number = 150;
const CLOSE_DELAY_MS: number = 150;
const CARD_DEFAULT_WIDTH_PX: number = 224;
const CARD_MAX_WIDTH_PX: number = 320;
const TRIGGER_GAP_PX: number = 8;
const VIEWPORT_MARGIN_PX: number = 8;

/**
 * Mirrors the host's native PR state presentation so plugin rows match bb's own sidebar.
 */
const PULL_REQUEST_STATE_PRESENTATIONS: Record<PluginSidebarPullRequest["state"], PullRequestBadgePresentation> = {
  open: { label: "Open", icon: "GitPullRequestArrow", textClassName: "text-success", chipClassName: "border-success/40 bg-success/10" },
  draft: { label: "Draft", icon: "GitPullRequestDraft", textClassName: "text-muted-foreground", chipClassName: "border-border bg-muted" },
  merged: { label: "Merged", icon: "GitMerge", textClassName: "text-pr-merged", chipClassName: "border-pr-merged/40 bg-pr-merged/10" },
  closed: { label: "Closed", icon: "GitPullRequestClosed", textClassName: "text-destructive", chipClassName: "border-destructive/40 bg-destructive/10" },
};

/**
 * Mirrors the host's native check rollup presentation. The SDK exposes only the
 * aggregated GitHub checks state, not individual check runs or counts.
 */
const CHECKS_STATE_PRESENTATIONS: Record<PluginSidebarPullRequest["experimental_checks"]["state"], PullRequestBadgePresentation> = {
  passing: { label: "Passing", icon: "CircleCheck", textClassName: "text-success", chipClassName: "border-success/40 bg-success/10" },
  failing: { label: "Failing", icon: "CircleX", textClassName: "text-destructive", chipClassName: "border-destructive/40 bg-destructive/10" },
  pending: { label: "Pending", icon: "Clock", textClassName: "text-attention", chipClassName: "border-attention/40 bg-attention/10" },
  no_checks: { label: "None", icon: "Circle", textClassName: "text-muted-foreground", chipClassName: "border-border bg-muted" },
  unknown: { label: "Unknown", icon: "AlertTriangle", textClassName: "text-warning-text", chipClassName: "border-warning/40 bg-warning/10" },
};

function computeCardPosition(trigger: HTMLElement): CardPosition {
  const triggerRect: DOMRect = trigger.getBoundingClientRect();
  const left: number = triggerRect.right + TRIGGER_GAP_PX;
  const top: number = Math.max(VIEWPORT_MARGIN_PX, triggerRect.top);
  return { top, left };
}

function PullRequestBadge({ caption, presentation }: { caption: string; presentation: PullRequestBadgePresentation }): ReactElement {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${presentation.chipClassName} ${presentation.textClassName}`}>
      <Icon name={presentation.icon} aria-hidden="true" className="size-3.5 shrink-0" />
      {caption}: {presentation.label}
    </span>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }): ReactElement {
  return (
    <p className="flex min-w-0 items-start gap-2 text-sm" title={value}>
      <Icon name={icon} aria-label={label} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{value}</span>
    </p>
  );
}

function PullRequestDetails({ pullRequest }: { pullRequest: PluginSidebarPullRequest }): ReactElement {
  const statePresentation: PullRequestBadgePresentation = PULL_REQUEST_STATE_PRESENTATIONS[pullRequest.state];
  const checksPresentation: PullRequestBadgePresentation | undefined = CHECKS_STATE_PRESENTATIONS[pullRequest.experimental_checks.state];
  return (
    <section aria-label={`Pull request #${pullRequest.number}`} className="-mt-0.5 border-t border-border pt-1">
      <header className="flex items-center gap-2">
        <Icon name={statePresentation.icon} aria-hidden="true" className={`size-4 shrink-0 ${statePresentation.textClassName}`} />
        <span className="flex-1 text-sm font-semibold text-muted-foreground">PR #{pullRequest.number}</span>
        <UrlLink
          aria-label="Open pull request in browser"
          className="flex shrink-0 items-center rounded p-1 text-muted-foreground hover:bg-state-hover hover:text-foreground"
          href={pullRequest.url}
          title="Open pull request in browser"
        >
          <Icon name="ExternalLink" aria-hidden="true" className="size-4" />
        </UrlLink>
      </header>
      <div className="mt-2 border-l border-border pl-3">
        <p className="text-sm font-semibold text-foreground">{pullRequest.title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <PullRequestBadge caption="State" presentation={statePresentation} />
          {checksPresentation === undefined ? null : <PullRequestBadge caption="Checks" presentation={checksPresentation} />}
        </div>
      </div>
    </section>
  );
}

/**
 * Hover card for a thread row: project, branch, host actions, and optional PR details.
 */
export function ThreadDetailsCard({
  thread,
  projectName,
  branchName,
  position,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: {
  thread: PluginSidebarThread;
  projectName: string | undefined;
  branchName: string | null | undefined;
  position: CardPosition;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClose: () => void;
}): ReactElement {
  const portalScopeProps = usePortalScopeProps();
  const { pullRequest } = experimental_useSidebarThreadPullRequest(thread.id);
  const visiblePullRequest: PluginSidebarPullRequest | null = pullRequest !== null && PULL_REQUEST_STATE_PRESENTATIONS[pullRequest.state] !== undefined ? pullRequest : null;
  const cardRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const card: HTMLDivElement | null = cardRef.current;
    if (card === null) return;
    const observer: ResizeObserver = new ResizeObserver(() => {
      const viewportWidth: number = card.ownerDocument.documentElement.clientWidth;
      const viewportHeight: number = card.ownerDocument.documentElement.clientHeight;
      card.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(position.left, viewportWidth - card.offsetWidth - VIEWPORT_MARGIN_PX))}px`;
      card.style.top = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(position.top, viewportHeight - card.offsetHeight - VIEWPORT_MARGIN_PX))}px`;
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [position.top, position.left]);

  return createPortal(
    <div
      {...portalScopeProps}
      ref={cardRef}
      data-thread-details-card=""
      aria-label="Thread details"
      className="fixed z-50 flex flex-col gap-1.5 overflow-y-auto rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg"
      role="dialog"
      style={{ top: position.top, left: position.left, width: visiblePullRequest === null ? CARD_DEFAULT_WIDTH_PX : CARD_MAX_WIDTH_PX, maxWidth: `min(${CARD_MAX_WIDTH_PX}px, calc(100vw - ${VIEWPORT_MARGIN_PX * 2}px))`, maxHeight: `calc(100vh - ${VIEWPORT_MARGIN_PX * 2}px)` }}
      // Portaled DOM still bubbles React events to the thread row; keep card interactions local.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(event.currentTarget.ownerDocument.activeElement)) onPointerLeave();
      }}
      onFocus={onPointerEnter}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPointerLeave();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {projectName === undefined ? null : <DetailRow icon="Folder" label="Project" value={projectName} />}
      {branchName === null || branchName === undefined ? null : <DetailRow icon="GitBranch" label="Branch" value={branchName} />}
      <ThreadActions thread={thread} onClose={onClose} />
      {visiblePullRequest === null ? null : <PullRequestDetails pullRequest={visiblePullRequest} />}
    </div>,
    document.body,
  );
}

export interface ThreadDetailsHover {
  triggerRef: RefObject<HTMLAnchorElement | null>;
  position: CardPosition | null;
  scheduleOpen: () => void;
  scheduleClose: () => void;
  keepOpen: () => void;
  close: () => void;
}

/** Delayed open/close state for the thread details card, anchored to the thread row. */
export function useThreadDetailsHover(): ThreadDetailsHover {
  const triggerRef: RefObject<HTMLAnchorElement | null> = useRef<HTMLAnchorElement | null>(null);
  const timerRef: RefObject<number | null> = useRef<number | null>(null);
  const [position, setPosition] = useState<CardPosition | null>(null);

  function keepOpen(): void {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function scheduleOpen(): void {
    keepOpen();
    timerRef.current = window.setTimeout(() => {
      const trigger: HTMLAnchorElement | null = triggerRef.current;
      if (trigger === null) return;
      setPosition(computeCardPosition(trigger));
    }, OPEN_DELAY_MS);
  }

  function scheduleClose(): void {
    keepOpen();
    timerRef.current = window.setTimeout(() => setPosition(null), CLOSE_DELAY_MS);
  }

  function close(): void {
    keepOpen();
    setPosition(null);
  }

  useEffect(() => keepOpen, []);

  useEffect(() => {
    if (position === null) return;
    function close(event: Event): void {
      if (event.target instanceof HTMLElement && event.target.closest("[data-thread-details-card]") !== null) return;
      setPosition(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  return { triggerRef, position, scheduleOpen, scheduleClose, keepOpen, close };
}

/** The PR state glyph shown at the right of a thread title. */
export function PullRequestIcon({ threadId }: { threadId: string }): ReactElement | null {
  const { pullRequest } = experimental_useSidebarThreadPullRequest(threadId);
  if (pullRequest === null) return null;
  // Newer hosts may add PR states; draw nothing for one this plugin does not know.
  const presentation: PullRequestBadgePresentation | undefined = PULL_REQUEST_STATE_PRESENTATIONS[pullRequest.state];
  if (presentation === undefined) return null;
  return (
    <span aria-label={`Pull request #${pullRequest.number}: ${presentation.label}`} className="flex shrink-0 items-center" role="img">
      <Icon name={presentation.icon} aria-hidden="true" className={`size-4 shrink-0 ${presentation.textClassName}`} />
    </span>
  );
}
