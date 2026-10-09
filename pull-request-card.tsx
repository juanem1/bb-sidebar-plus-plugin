import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PluginSidebarPullRequest } from "@get-bb/plugin-sdk/app";
import { UrlLink, experimental_useSidebarThreadPullRequest } from "@get-bb/plugin-sdk/app";
import { usePortalScopeProps } from "./lib/portal-scope";
import { Icon } from "./ui/icon";

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
const CARD_WIDTH_PX: number = 320;
const TRIGGER_GAP_PX: number = 8;
const VIEWPORT_MARGIN_PX: number = 8;
const CARD_VERTICAL_OFFSET_PX: number = 24;

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
  const documentElement: HTMLElement = trigger.ownerDocument.documentElement;
  const maxLeft: number = Math.max(VIEWPORT_MARGIN_PX, documentElement.clientWidth - CARD_WIDTH_PX - VIEWPORT_MARGIN_PX);
  const left: number = Math.min(triggerRect.right + TRIGGER_GAP_PX, maxLeft);
  const top: number = Math.max(VIEWPORT_MARGIN_PX, triggerRect.top - CARD_VERTICAL_OFFSET_PX);
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

function PullRequestCard({
  pullRequest,
  position,
  onPointerEnter,
  onPointerLeave,
}: {
  pullRequest: PluginSidebarPullRequest;
  position: CardPosition;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}): ReactElement {
  const portalScopeProps = usePortalScopeProps();
  const statePresentation: PullRequestBadgePresentation = PULL_REQUEST_STATE_PRESENTATIONS[pullRequest.state];
  const checksPresentation: PullRequestBadgePresentation | undefined = CHECKS_STATE_PRESENTATIONS[pullRequest.experimental_checks.state];
  return createPortal(
    <div
      {...portalScopeProps}
      aria-label={`Pull request #${pullRequest.number}`}
      className="fixed z-50 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
      role="dialog"
      style={{ top: position.top, left: position.left, width: CARD_WIDTH_PX }}
      // Portaled DOM still bubbles React events to the thread row anchor; keep card interactions local.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
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
        <p className="text-base font-semibold text-foreground">{pullRequest.title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <PullRequestBadge caption="State" presentation={statePresentation} />
          {checksPresentation === undefined ? null : <PullRequestBadge caption="Checks" presentation={checksPresentation} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The PR state glyph on a thread row. Hovering it reveals a card with the PR
 * title, state, checks, and a link that opens the PR using BB's URL preference.
 */
export function PullRequestIndicator({ threadId }: { threadId: string }): ReactElement | null {
  const { pullRequest } = experimental_useSidebarThreadPullRequest(threadId);
  const triggerRef: RefObject<HTMLSpanElement | null> = useRef<HTMLSpanElement | null>(null);
  const timerRef: RefObject<number | null> = useRef<number | null>(null);
  const [position, setPosition] = useState<CardPosition | null>(null);

  function clearTimer(): void {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function scheduleOpen(): void {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      const trigger: HTMLSpanElement | null = triggerRef.current;
      if (trigger === null) return;
      setPosition(computeCardPosition(trigger));
    }, OPEN_DELAY_MS);
  }

  function scheduleClose(): void {
    clearTimer();
    timerRef.current = window.setTimeout(() => setPosition(null), CLOSE_DELAY_MS);
  }

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (position === null) return;
    function close(): void {
      setPosition(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  if (pullRequest === null) return null;
  // Newer hosts may add PR states; draw nothing for one this plugin does not know.
  const presentation: PullRequestBadgePresentation | undefined = PULL_REQUEST_STATE_PRESENTATIONS[pullRequest.state];
  if (presentation === undefined) return null;
  const label: string = `Pull request #${pullRequest.number}: ${presentation.label}`;

  return (
    <>
      <span
        ref={triggerRef}
        aria-label={label}
        className="flex shrink-0 items-center"
        role="img"
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
      >
        <Icon name={presentation.icon} aria-hidden="true" className={`size-4 shrink-0 ${presentation.textClassName}`} />
      </span>
      {position === null ? null : (
        <PullRequestCard pullRequest={pullRequest} position={position} onPointerEnter={clearTimer} onPointerLeave={scheduleClose} />
      )}
    </>
  );
}
