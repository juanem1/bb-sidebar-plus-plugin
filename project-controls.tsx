import type { ReactElement, RefObject } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { experimental_useSidebarThreadActions } from "@get-bb/plugin-sdk/app";
import type { ProjectVisibilityController } from "./use-project-visibility";
import { useDismissibleMenu } from "./hooks/useDismissibleMenu";
import { Icon } from "./ui/icon";

interface ProjectControlsProps {
  project: PluginSidebarProject;
  pinned: boolean;
  visibility: ProjectVisibilityController;
  onNavigate: () => void;
}

export function ProjectControls({ project, pinned, visibility, onNavigate }: ProjectControlsProps): ReactElement {
  const actions = experimental_useSidebarThreadActions();
  const menuRef: RefObject<HTMLDetailsElement | null> = useDismissibleMenu();
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
        <div className="absolute right-0 z-20 mt-1 min-w-32 rounded-md border border-sidebar-border bg-sidebar p-1 shadow-lg">
          <button
            className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent"
            disabled={visibility.pending}
            onClick={() => { void (pinned ? visibility.unpinProject(project.id) : visibility.pinProject(project.id)); }}
            type="button"
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent"
            disabled={visibility.pending}
            onClick={() => { void visibility.hideProject(project.id); }}
            type="button"
          >
            Hide
          </button>
        </div>
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
        className="shrink-0 rounded px-2 py-1 text-xs hover:bg-sidebar-accent"
        disabled={visibility.pending}
        onClick={() => { void visibility.showProject(project.id); }}
        type="button"
      >
        Show
      </button>
    </li>
  );
}
