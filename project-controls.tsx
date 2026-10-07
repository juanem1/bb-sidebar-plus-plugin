import type { ReactElement } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { experimental_useSidebarThreadActions } from "@get-bb/plugin-sdk/app";
import type { ProjectVisibilityController } from "./use-project-visibility";

interface ProjectControlsProps {
  project: PluginSidebarProject;
  pinned: boolean;
  visibility: ProjectVisibilityController;
  onNavigate: () => void;
}

export function ProjectControls({ project, pinned, visibility, onNavigate }: ProjectControlsProps): ReactElement {
  const actions = experimental_useSidebarThreadActions();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <button
        aria-label={`New thread in ${project.name}`}
        title="New thread"
        className="rounded px-2 py-1 text-xs hover:bg-sidebar-accent"
        onClick={() => {
          actions.openNewThread({ projectId: project.id, focusPrompt: true });
          onNavigate();
        }}
        type="button"
      >
        +
      </button>
      <details className="relative">
        <summary
          aria-label={`Actions for ${project.name}`}
          className="cursor-pointer list-none rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent"
        >
          More
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
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground" title={project.name}>
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
