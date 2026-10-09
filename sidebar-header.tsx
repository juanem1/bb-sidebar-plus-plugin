import type { ReactElement, RefObject } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { ProjectControls } from "./project-controls";
import { ProjectOrder, type ProjectDragHandleProps } from "./project-order";
import type { ProjectVisibilityController } from "./use-project-visibility";
import { useDismissibleMenu } from "./hooks/useDismissibleMenu";
import { Icon } from "./ui/icon";

interface SidebarHeaderProps {
  visibility: ProjectVisibilityController;
  projects: readonly PluginSidebarProject[];
  onNavigate: () => void;
  collapsed: boolean;
  onToggle: () => void;
  contentId: string;
}

export function SidebarHeader({ visibility, projects, onNavigate, collapsed, onToggle, contentId }: SidebarHeaderProps): ReactElement {
  const menuRef: RefObject<HTMLDetailsElement | null> = useDismissibleMenu();
  const state = visibility.state;
  if (state === null) throw new Error("SidebarHeader requires loaded preferences.");
  const pinned: ReadonlySet<string> = new Set(state.pinnedProjectIds);
  const ordinaryProjects: PluginSidebarProject[] = projects.filter((project) => !pinned.has(project.id));
  const projectById: ReadonlyMap<string, PluginSidebarProject> = new Map(projects.map((project) => [project.id, project]));
  const pinnedProjects: PluginSidebarProject[] = [];
  for (const id of state.pinnedProjectIds) {
    const project: PluginSidebarProject | undefined = projectById.get(id);
    if (project !== undefined) pinnedProjects.push(project);
  }
  function renderManagementRow(project: PluginSidebarProject, dragHandleProps: ProjectDragHandleProps): ReactElement {
    return (
      <div className="flex items-center gap-1 rounded-md py-1 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <button {...dragHandleProps} aria-label={`Reorder ${project.name}. Use Up or Down arrow keys, or drag.`} className={`${dragHandleProps.className} min-w-0 flex-1 truncate text-left text-xs`} type="button">{project.name}</button>
        <ProjectControls project={project} pinned={pinned.has(project.id)} visibility={visibility} onNavigate={onNavigate} />
      </div>
    );
  }
  const controlClass: string = "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-sidebar-accent";
  return (
    <header className="relative flex items-center gap-1 px-1 py-1">
      <h1 className="min-w-0 flex-1 text-sm font-bold text-muted-foreground">
        <button aria-expanded={!collapsed} aria-controls={contentId} className="flex w-full cursor-pointer items-center gap-2 text-left" onClick={onToggle} type="button">
          <span className="flex items-center gap-1">Projects<Icon name="ChevronRight" aria-hidden="true" className={collapsed ? "size-4 shrink-0" : "size-4 shrink-0 rotate-90"} /></span>
        </button>
      </h1>
      <details ref={menuRef} className="relative">
        <summary aria-label="Sidebar options" title="Sidebar options" className="flex cursor-pointer list-none items-center rounded p-1 hover:bg-sidebar-accent"><Icon name="SlidersHorizontal" aria-hidden="true" className="size-4" /></summary>
        <div className="absolute right-0 z-20 mt-1 w-64 max-w-[80vw] rounded-md border border-sidebar-border bg-sidebar p-2 shadow-lg">
          <fieldset disabled={visibility.pending} className="flex flex-col gap-1">
            <legend className="px-2 text-xs font-semibold">Sidebar options</legend>
            <label className={controlClass}>Group by<select value={state.grouping} onChange={(event) => { void visibility.setGrouping(event.target.value === "none" ? "none" : "project"); }}><option value="project">By project</option><option value="none">None</option></select></label>
            <label className={controlClass}>Project order<select value={state.sorting} onChange={(event) => { void (event.target.value === "name" ? visibility.sortProjectsByName() : visibility.selectManualOrder()); }}><option value="name">By name</option><option value="manual">Manual</option></select></label>
            <button className={controlClass} type="button" onClick={() => { void visibility.sortProjectsByName(); }}>Sort by name</button>
            <label className={controlClass}>Show search<input type="checkbox" checked={state.showSearch} onChange={(event) => { void visibility.setShowSearch(event.target.checked); }} /></label>
          </fieldset>
          {state.grouping === "none" ? (
            <details className="mt-2 border-t border-sidebar-border pt-2">
              <summary className="cursor-pointer text-xs font-semibold">Manage projects</summary>
              <div data-project-order-scroll="" className="max-h-72 overflow-y-auto">
                {pinnedProjects.length > 0 ? (
                  <section aria-label="Manage pinned projects">
                    <h2 className="my-2 text-xs font-semibold">Pinned</h2>
                    <ProjectOrder projects={pinnedProjects} pending={visibility.pending} move={visibility.movePinnedProject} render={renderManagementRow} />
                  </section>
                ) : null}
                <section aria-label="Manage ordinary projects">
                  <h2 className="my-2 text-xs font-semibold">Projects</h2>
                  <ProjectOrder projects={ordinaryProjects} pending={visibility.pending} move={visibility.moveProject} render={renderManagementRow} />
                </section>
              </div>
            </details>
          ) : null}
        </div>
      </details>
    </header>
  );
}
