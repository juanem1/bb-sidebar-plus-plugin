import { useRef, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { experimental_useSidebarThreadActions } from "@get-bb/plugin-sdk/app";
import type { ProjectVisibilityController } from "./use-project-visibility";
import { useDismissibleMenu } from "./hooks/useDismissibleMenu";
import { useCenteredMenuPanel } from "./hooks/useCenteredMenuPanel";
import { usePortalScopeProps } from "./lib/portal-scope";
import { Icon } from "./ui/icon";

// Mirrors the host dropdown menu item styling so plugin menus match native BB menus.
const menuItemClass: string = "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-[0.3125rem] text-left text-xs hover:bg-state-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

interface HostHistoryState {
  idx?: number;
}

// shortcut: the plugin SDK has no route to a project's settings page (`toProject` opens the
// new-thread composer), so this drives the host's React Router browser history directly.
// Replace with an SDK navigation call once bb exposes one.
function openProjectSettings(projectId: string): void {
  const current: HostHistoryState | null = window.history.state as HostHistoryState | null;
  const state = { usr: null, key: Math.random().toString(36).slice(2, 10), idx: (current?.idx ?? 0) + 1 };
  window.history.pushState(state, "", `/settings/projects/${encodeURIComponent(projectId)}`);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

interface ProjectControlsProps {
  project: PluginSidebarProject;
  pinned: boolean;
  visibility: ProjectVisibilityController;
  onNavigate: () => void;
}

export function ProjectControls({ project, pinned, visibility, onNavigate }: ProjectControlsProps): ReactElement {
  const actions = experimental_useSidebarThreadActions();
  const portalScopeProps = usePortalScopeProps();
  const panelRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const menuRef: RefObject<HTMLDetailsElement | null> = useDismissibleMenu(panelRef);
  useCenteredMenuPanel(menuRef, panelRef);
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <button
        aria-label={`New thread in ${project.name}`}
        title="New thread"
        className="flex cursor-pointer items-center rounded px-2 py-1 hover:bg-sidebar-accent"
        onClick={() => {
          actions.openNewThread({ projectId: project.id, focusPrompt: true });
          onNavigate();
        }}
        type="button"
      >
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <details ref={menuRef} className="relative">
        <summary
          aria-label={`Actions for ${project.name}`}
          className="flex cursor-pointer list-none items-center rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent"
        >
          <Icon name="MoreHorizontal" aria-hidden="true" className="size-4" />
        </summary>
        {createPortal(<div {...portalScopeProps} ref={panelRef} className="fixed z-50 min-w-32 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            className={menuItemClass}
            disabled={visibility.pending}
            onClick={() => { void (pinned ? visibility.unpinProject(project.id) : visibility.pinProject(project.id)); }}
            type="button"
          >
            <Icon name={pinned ? "PinOff" : "Pin"} aria-hidden="true" className="size-4 shrink-0" />
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            className={menuItemClass}
            disabled={visibility.pending}
            onClick={() => { void visibility.hideProject(project.id); }}
            type="button"
          >
            <Icon name="EyeOff" aria-hidden="true" className="size-4 shrink-0" />
            Hide
          </button>
          <button
            className={menuItemClass}
            onClick={() => {
              if (menuRef.current !== null) menuRef.current.open = false;
              openProjectSettings(project.id);
              onNavigate();
            }}
            type="button"
          >
            <Icon name="Info" aria-hidden="true" className="size-4 shrink-0" />
            Details
          </button>
        </div>, document.body)}
      </details>
    </div>
  );
}

interface HiddenProjectRowProps {
  project: PluginSidebarProject;
  visibility: ProjectVisibilityController;
}

export function HiddenProjectRow({ project, visibility }: HiddenProjectRowProps): ReactElement {
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <Icon name="Folder" aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm" title={project.name}>
        {project.name}
      </span>
      <button
        className="shrink-0 cursor-pointer rounded px-2 py-1 text-xs hover:bg-sidebar-accent"
        disabled={visibility.pending}
        onClick={() => { void visibility.showProject(project.id); }}
        type="button"
      >
        Show
      </button>
    </li>
  );
}
