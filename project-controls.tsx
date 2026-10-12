import { useRef, useState, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { experimental_useSidebarThreadActions, useSdk } from "@get-bb/plugin-sdk/app";
import type { ProjectVisibilityController } from "./use-project-visibility";
import { useDismissibleMenu } from "./hooks/useDismissibleMenu";
import { useRightMenuPanel } from "./hooks/useRightMenuPanel";
import { useHoverMenu } from "./hooks/useHoverMenu";
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
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactElement;
  project: PluginSidebarProject;
  pinned: boolean;
  visibility: ProjectVisibilityController;
  onNavigate: () => void;
}

export function ProjectControls({ anchorRef, children, project, pinned, visibility, onNavigate }: ProjectControlsProps): ReactElement {
  const actions = experimental_useSidebarThreadActions();
  const sdk = useSdk();
  const [renaming, setRenaming] = useState<boolean>(false);
  const [name, setName] = useState<string>(project.name);
  const [renamePending, setRenamePending] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  // Escape unmounts the focused input; this keeps a removal-triggered blur from saving.
  const renameCancelled: RefObject<boolean> = useRef<boolean>(false);
  const portalScopeProps = usePortalScopeProps();
  const panelRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const menuRef: RefObject<HTMLDetailsElement | null> = useDismissibleMenu(panelRef);
  useRightMenuPanel(menuRef, panelRef, anchorRef);
  useHoverMenu(menuRef, panelRef);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <details ref={menuRef} className="relative min-w-0 flex-1">
        <summary
          aria-label={`Actions for ${project.name}`}
          className="flex cursor-pointer list-none items-center"
        >
          {children}
        </summary>
        {createPortal(<div {...portalScopeProps} ref={panelRef} className="fixed z-50 min-w-32 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            className={menuItemClass}
            disabled={visibility.pending}
            onClick={() => { void (pinned ? visibility.unpinProject(project.id) : visibility.pinProject(project.id)); }}
            type="button"
          >
            <Icon name={pinned ? "PinOff" : "Pin"} aria-hidden="true" className="size-4 shrink-0" />
            {pinned ? "Unpin" : "Pin project"}
          </button>
          <button
            className={menuItemClass}
            disabled={visibility.pending}
            onClick={() => { void visibility.hideProject(project.id); }}
            type="button"
          >
            <Icon name="EyeOff" aria-hidden="true" className="size-4 shrink-0" />
            Hide from list
          </button>
          <div role="separator" className="my-1 border-t border-border" />
          <button
            className={menuItemClass}
            onClick={() => {
              if (menuRef.current !== null) menuRef.current.open = false;
              openProjectSettings(project.id);
              onNavigate();
            }}
            type="button"
          >
            <Icon name="Settings" aria-hidden="true" className="size-4 shrink-0" />
            Project settings
          </button>
          {renaming ? (
            <div className="my-1 flex flex-col gap-2 px-2">
              <input
                aria-label="Project name"
                autoFocus
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                disabled={renamePending}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  // Enter commits through blur so saving has a single path.
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    renameCancelled.current = true;
                    setRenaming(false);
                  }
                }}
                onBlur={() => {
                  const nextName: string = name.trim();
                  if (renameCancelled.current || nextName.length === 0 || nextName === project.name) {
                    setRenaming(false);
                    return;
                  }
                  setRenamePending(true);
                  setRenameError(null);
                  sdk.projects.update({ projectId: project.id, name: nextName }).then(() => {
                    setRenaming(false);
                    if (menuRef.current !== null) menuRef.current.open = false;
                  }, (cause: unknown) => {
                    setRenameError(cause instanceof Error ? cause.message : "Unknown error.");
                  }).finally(() => setRenamePending(false));
                }}
              />
              {renameError === null ? null : <p role="alert" className="text-xs text-destructive">Could not rename this project. {renameError}</p>}
            </div>
          ) : (
            <button className={menuItemClass} type="button" onClick={() => {
              renameCancelled.current = false;
              setName(project.name);
              setRenameError(null);
              setRenaming(true);
            }}>
              <Icon name="Edit" aria-hidden="true" className="size-4 shrink-0" />
              Rename
            </button>
          )}
          <div role="separator" className="my-1 border-t border-border" />
          <button
            className={`${menuItemClass} text-destructive hover:text-destructive`}
            onClick={() => {
              if (menuRef.current !== null) menuRef.current.open = false;
              // The SDK exposes no host confirmation for project deletion, and it removes every thread.
              if (!window.confirm(`Remove "${project.name}" and all its threads? This cannot be undone.`)) return;
              sdk.projects.delete({ projectId: project.id }).catch((cause: unknown) => {
                const message: string = cause instanceof Error ? cause.message : "Unknown error.";
                window.alert(`Could not remove "${project.name}". ${message}`);
              });
            }}
            type="button"
          >
            <Icon name="Trash2" aria-hidden="true" className="size-4 shrink-0" />
            Remove
          </button>
        </div>, document.body)}
      </details>
      <button
        aria-label={`New thread in ${project.name}`}
        title="New thread"
        className="flex shrink-0 cursor-pointer items-center rounded px-2 py-1 hover:bg-sidebar-accent"
        onClick={() => {
          actions.openNewThread({ projectId: project.id, focusPrompt: true });
          onNavigate();
        }}
        type="button"
      >
        <Icon name="MessageSquarePlus" aria-hidden="true" className="size-4" />
      </button>
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
