import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import type { ProjectVisibilityController } from "./use-project-visibility";

interface ProjectControlsProps {
  project: PluginSidebarProject;
  pinned: boolean;
  visibility: ProjectVisibilityController;
}

function invokeVisibilityAction(action: Promise<void>): void {
  void action.catch(() => undefined);
}

export function ProjectControls({ project, pinned, visibility }: ProjectControlsProps) {
  return (
    <details className="relative ml-auto shrink-0">
      <summary
        aria-label={`Actions for ${project.name}`}
        className="cursor-pointer list-none rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        More
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-32 rounded-md border border-sidebar-border bg-sidebar p-1 shadow-lg">
        <button
          className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent"
          onClick={() => invokeVisibilityAction(
            pinned ? visibility.unpinProject(project.id) : visibility.pinProject(project.id),
          )}
          type="button"
        >
          {pinned ? "Unpin" : "Pin"}
        </button>
        <button
          className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent"
          onClick={() => invokeVisibilityAction(visibility.hideProject(project.id))}
          type="button"
        >
          Hide
        </button>
      </div>
    </details>
  );
}

interface HiddenProjectRowProps {
  project: PluginSidebarProject;
  visibility: ProjectVisibilityController;
}

export function HiddenProjectRow({ project, visibility }: HiddenProjectRowProps) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground" title={project.name}>
        {project.name}
      </span>
      <button
        className="shrink-0 rounded px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-accent"
        onClick={() => invokeVisibilityAction(visibility.showProject(project.id))}
        type="button"
      >
        Show
      </button>
    </li>
  );
}
