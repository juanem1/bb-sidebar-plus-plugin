import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginThreadListProps,
} from "@get-bb/plugin-sdk/app";
import {
  ThreadTitle,
  definePluginApp,
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreads,
  experimental_useSidebarThreadSplit,
} from "@get-bb/plugin-sdk/app";
import { HiddenProjectRow, ProjectControls } from "./project-controls";
import { useProjectVisibility } from "./use-project-visibility";
import { SidebarHeader } from "./sidebar-header";
import { ProjectOrder, type ProjectDragHandleProps } from "./project-order";
import { Icon } from "./ui/icon";
import { SlidingContent } from "./ui/sliding-content";

const ACTIVE_RUNTIME_STATUSES: Record<PluginSidebarThread["runtimeStatus"], boolean> = {
  active: true,
  provisioning: true,
  starting: true,
  stopping: true,
  error: false,
  idle: false,
  pending: false,
  "waiting-for-host": false,
};

const WORKING_INDICATOR_KINDS: Record<PluginSidebarThread["indicator"], boolean> = {
  "unread-error": false,
  "waiting-for-input": false,
  "working-draft": true,
  workflow: true,
  "background-agent": true,
  "background-command": true,
  "plan-mode": true,
  goal: true,
  runtime: true,
  "queued-failed": false,
  draft: false,
  "unread-success": false,
  "queued-waiting": false,
  none: false,
};

const ATTENTION_INDICATOR_CLASS_NAMES: Record<PluginSidebarThread["indicator"], string> = {
  "unread-error": "bg-destructive",
  "waiting-for-input": "bg-warning",
  "working-draft": "bg-sidebar-ring",
  workflow: "bg-sidebar-ring",
  "background-agent": "bg-sidebar-ring",
  "background-command": "bg-sidebar-ring",
  "plan-mode": "bg-sidebar-ring",
  goal: "bg-sidebar-ring",
  runtime: "bg-sidebar-ring",
  "queued-failed": "bg-destructive",
  draft: "bg-sidebar-ring",
  "unread-success": "bg-success",
  "queued-waiting": "bg-sidebar-ring",
  none: "bg-transparent",
};

function compareThreadsByUpdatedAtDescending(
  left: PluginSidebarThread,
  right: PluginSidebarThread,
): number {
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  return left.id.localeCompare(right.id);
}

function isWorkingThread(thread: PluginSidebarThread): boolean {
  return (
    (ACTIVE_RUNTIME_STATUSES[thread.runtimeStatus] ?? false) ||
    thread.activity.workflows > 0 ||
    thread.activity.backgroundAgents > 0 ||
    thread.activity.backgroundCommands > 0 ||
    thread.activity.planMode > 0 ||
    thread.activity.goals > 0
  );
}

function hasWorkingIndicator(thread: PluginSidebarThread): boolean {
  return isWorkingThread(thread) || (WORKING_INDICATOR_KINDS[thread.indicator] ?? false);
}

function hasAttentionIndicator(thread: PluginSidebarThread): boolean {
  return (
    thread.indicator !== "none" &&
    (WORKING_INDICATOR_KINDS[thread.indicator] ?? false) === false
  );
}

function getStatusAccessibilityLabel(thread: PluginSidebarThread): string | null {
  const spinnerVisible = hasWorkingIndicator(thread);
  const attentionVisible = hasAttentionIndicator(thread);
  const indicatorLabel = thread.indicatorLabel;

  if (spinnerVisible && attentionVisible && indicatorLabel !== null) {
    return `Thread working. ${indicatorLabel}`;
  }
  if (spinnerVisible) {
    return indicatorLabel ?? "Thread working";
  }
  if (attentionVisible) {
    return indicatorLabel;
  }
  return null;
}

function getVisibleThreadsByProjectId(
  threads: readonly PluginSidebarThread[],
): ReadonlyMap<string, readonly PluginSidebarThread[]> {
  const visibleThreads = threads.filter((thread) => thread.isHidden === false);
  const groupedThreads = new Map<string, PluginSidebarThread[]>();

  for (const thread of visibleThreads) {
    const projectThreads = groupedThreads.get(thread.projectId);
    if (projectThreads === undefined) {
      groupedThreads.set(thread.projectId, [thread]);
      continue;
    }
    projectThreads.push(thread);
  }

  for (const projectThreads of groupedThreads.values()) {
    projectThreads.sort(compareThreadsByUpdatedAtDescending);
  }

  return groupedThreads;
}

function StatusIndicator({ thread }: { thread: PluginSidebarThread }) {
  const statusLabel = getStatusAccessibilityLabel(thread);
  const spinnerVisible = hasWorkingIndicator(thread);
  const attentionVisible = hasAttentionIndicator(thread);

  if (statusLabel === null) {
    return <span aria-hidden="true" className="size-3 shrink-0" />;
  }

  return (
    <span
      aria-label={statusLabel}
      className="flex min-h-3 min-w-3 shrink-0 items-center justify-center gap-1"
      role="img"
      title={statusLabel}
    >
      {attentionVisible ? (
        <span
          aria-hidden="true"
          className={[
            "block size-2 rounded-full",
            ATTENTION_INDICATOR_CLASS_NAMES[thread.indicator] ?? "bg-sidebar-ring",
          ].join(" ")}
        />
      ) : null}
      {spinnerVisible ? (
        <span
          aria-hidden="true"
          className="block size-2 rounded-full border border-sidebar-ring border-t-transparent animate-spin"
        />
      ) : null}
    </span>
  );
}

/**
 * SDK 0.6.15 exposes agent identity, not the company of the last executed model.
 * Keep company metadata absent rather than infer it from providerId or model IDs.
 * https://github.com/get-bb/bb/tree/main/packages/plugin-sdk
 */
function ThreadRow({
  activeThreadId,
  onNavigate,
  thread,
}: {
  activeThreadId: string | null;
  onNavigate: () => void;
  thread: PluginSidebarThread;
}) {
  const actions = experimental_useSidebarThreadActions();
  const split = experimental_useSidebarThreadSplit(thread.id);
  const branchName = thread.environment?.branchName;
  const isActive = activeThreadId === thread.id;

  return (
    <li>
      <a
        {...split.splitProps}
        aria-current={isActive ? "page" : undefined}
        className={[
          "grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2 rounded-md px-1 py-2 outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground",
        ].join(" ")}
        data-sidebar-thread-id={thread.id}
        data-sidebar-thread-shortcut-target=""
        href={thread.href}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          actions.open(thread.id);
          window.setTimeout(() => {
            onNavigate();
          }, 0);
        }}
      >
        <StatusIndicator thread={thread} />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm font-normal"
            title={thread.displayTitle}
          >
            <ThreadTitle threadId={thread.id} />
          </span>
          {branchName === null || branchName === undefined ? null : (
            <span
              className="mt-0.5 block truncate text-xs text-muted-foreground"
              title={branchName}
            >
              {branchName}
            </span>
          )}
        </span>
      </a>
    </li>
  );
}

function ProjectSection({
  activeThreadId,
  onNavigate,
  project,
  pinned,
  threads,
  visibility,
  dragHandleProps,
}: {
  activeThreadId: string | null;
  onNavigate: () => void;
  project: PluginSidebarProject;
  pinned: boolean;
  threads: readonly PluginSidebarThread[];
  visibility: ReturnType<typeof useProjectVisibility>;
  dragHandleProps: ProjectDragHandleProps;
}): ReactElement {
  const collapsed: boolean = visibility.state?.collapsedProjectIds.includes(project.id) === true;
  const contentId: string = useId();
  return (
    <section className="rounded-lg bg-sidebar/40">
      <header className="flex items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <button
          {...dragHandleProps}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${project.name}`}
          className={`${dragHandleProps.className} flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-normal`}
          onClick={() => { void (collapsed ? visibility.expandProject(project.id) : visibility.collapseProject(project.id)); }}
          type="button"
        >
          <Icon name={collapsed ? "Folder" : "FolderOpen"} aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{project.name}</span>
        </button>
        <ProjectControls project={project} pinned={pinned} visibility={visibility} onNavigate={onNavigate} />
      </header>
      <SlidingContent collapsed={collapsed} contentId={contentId}>
        {threads.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">No visible threads.</p>
        ) : (
          <ul className="py-2">
            {threads.map((thread) => <ThreadRow key={thread.id} activeThreadId={activeThreadId} onNavigate={onNavigate} thread={thread} />)}
          </ul>
        )}
      </SlidingContent>
    </section>
  );
}

function orderProjects(projects: readonly PluginSidebarProject[], ids: readonly string[]): PluginSidebarProject[] {
  const byId: ReadonlyMap<string, PluginSidebarProject> = new Map(projects.map((project) => [project.id, project]));
  const ordered: PluginSidebarProject[] = [];
  for (const id of ids) {
    const project: PluginSidebarProject | undefined = byId.get(id);
    if (project !== undefined) ordered.push(project);
  }
  const saved: ReadonlySet<string> = new Set(ids);
  ordered.push(...projects.filter((project) => !saved.has(project.id)));
  return ordered;
}

function SidebarPlusThreadList({ activeThreadId, onNavigate }: PluginThreadListProps): ReactElement {
  const { projects, status, threads } = experimental_useSidebarThreads();
  const visibility = useProjectVisibility();
  const [query, setQuery] = useState<string>("");
  const [pinnedCollapsed, setPinnedCollapsed] = useState<boolean>(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState<boolean>(false);
  const [hiddenCollapsed, setHiddenCollapsed] = useState<boolean>(true);
  const pinnedContentId: string = useId();
  const projectsContentId: string = useId();
  const hiddenContentId: string = useId();
  const lastProjects = useRef<string | null>(null);
  const projectKey: string = JSON.stringify(projects.map((project) => project.id).sort());

  useEffect(() => {
    if (status !== "ready" || visibility.state === null || projectKey === lastProjects.current) return;
    lastProjects.current = projectKey;
    void visibility.syncProjects();
  }, [status, projectKey, visibility.state, visibility.syncProjects]);

  if (status === "loading" || (visibility.loading && visibility.state === null)) {
    return <p role="status" className="px-3 py-4 text-sm text-muted-foreground">Loading projects…</p>;
  }
  if (status === "error") {
    return <p role="alert" className="px-3 py-4 text-sm text-destructive">Sidebar Plus could not load the sidebar thread data.</p>;
  }
  if (visibility.state === null) {
    return <p role="alert" className="px-3 py-4 text-sm text-destructive">{visibility.error ?? "Project preferences are unavailable. Reconnect or contact the maintainer."}</p>;
  }

  const state = visibility.state;
  const hiddenIds: ReadonlySet<string> = new Set(state.hiddenProjectIds);
  const pinnedIds: ReadonlySet<string> = new Set(state.pinnedProjectIds);
  const search: string = state.showSearch ? query.trim().toLocaleLowerCase() : "";
  const visibleProjects: PluginSidebarProject[] = orderProjects(projects.filter((project) => !hiddenIds.has(project.id)), state.projectOrder);
  const matchingProjects: PluginSidebarProject[] = visibleProjects.filter((project) => project.name.toLocaleLowerCase().includes(search));
  const pinnedProjects: PluginSidebarProject[] = orderProjects(matchingProjects.filter((project) => pinnedIds.has(project.id)), state.pinnedProjectIds);
  const ordinaryProjects: PluginSidebarProject[] = matchingProjects.filter((project) => !pinnedIds.has(project.id));
  const hiddenProjects: PluginSidebarProject[] = orderProjects(projects.filter((project) => hiddenIds.has(project.id)), state.projectOrder);
  const threadsByProjectId: ReadonlyMap<string, readonly PluginSidebarThread[]> = getVisibleThreadsByProjectId(threads);
  const matchingIds: ReadonlySet<string> = new Set(matchingProjects.map((project) => project.id));
  const flatThreads: PluginSidebarThread[] = threads.filter((thread) => !thread.isHidden && matchingIds.has(thread.projectId)).sort(compareThreadsByUpdatedAtDescending);

  function renderPinned(project: PluginSidebarProject, dragHandleProps: ProjectDragHandleProps): ReactElement {
    return <ProjectSection project={project} dragHandleProps={dragHandleProps} pinned={true} threads={threadsByProjectId.get(project.id) ?? []} visibility={visibility} activeThreadId={activeThreadId} onNavigate={onNavigate} />;
  }
  function renderOrdinary(project: PluginSidebarProject, dragHandleProps: ProjectDragHandleProps): ReactElement {
    return <ProjectSection project={project} dragHandleProps={dragHandleProps} pinned={false} threads={threadsByProjectId.get(project.id) ?? []} visibility={visibility} activeThreadId={activeThreadId} onNavigate={onNavigate} />;
  }

  return (
    <div data-project-order-scroll="" className="flex min-h-full flex-col gap-3 px-3 py-3">
      {state.grouping === "project" && pinnedProjects.length > 0 ? (
        <section aria-label="Pinned projects">
          <h2 className="px-1 py-1 text-sm font-bold text-muted-foreground">
            <button aria-expanded={!pinnedCollapsed} aria-controls={pinnedContentId} className="flex w-full cursor-pointer items-center gap-2 text-left" onClick={() => setPinnedCollapsed(!pinnedCollapsed)} type="button">
              <span className="flex items-center gap-1">Pinned<Icon name="ChevronRight" aria-hidden="true" className={pinnedCollapsed ? "size-4 shrink-0" : "size-4 shrink-0 rotate-90"} /></span>
            </button>
          </h2>
          <SlidingContent collapsed={pinnedCollapsed} contentId={pinnedContentId}>
            <div className="pt-1"><ProjectOrder projects={pinnedProjects} pending={visibility.pending} move={visibility.movePinnedProject} render={renderPinned} /></div>
          </SlidingContent>
        </section>
      ) : null}
      {state.grouping === "project" && pinnedProjects.length > 0 ? <div role="separator" className="border-t border-sidebar-border" /> : null}
      <section aria-label="Projects section">
        <SidebarHeader visibility={visibility} projects={visibleProjects} onNavigate={onNavigate} collapsed={projectsCollapsed} onToggle={() => setProjectsCollapsed(!projectsCollapsed)} contentId={projectsContentId} />
        {state.showSearch ? <input aria-label="Search projects" type="search" placeholder="Search projects…" className="mt-3 w-full rounded border border-sidebar-border bg-sidebar px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
        {visibility.error !== null ? <p role="alert" className="mt-3 rounded border border-destructive/50 p-2 text-xs text-destructive">{visibility.error}</p> : null}
        <SlidingContent collapsed={projectsCollapsed} contentId={projectsContentId}>
          <div className="pt-1">
            {state.grouping === "none" ? (
              flatThreads.length === 0 ? <p className="px-1 text-sm text-muted-foreground">No visible threads in matching projects.</p> : <ul aria-label="Threads">{flatThreads.map((thread) => <ThreadRow key={thread.id} thread={thread} activeThreadId={activeThreadId} onNavigate={onNavigate} />)}</ul>
            ) : ordinaryProjects.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">{projects.length === 0 ? "No projects found." : "No matching projects in Projects."}</p>
            ) : (
              <section aria-label="Projects"><ProjectOrder projects={ordinaryProjects} pending={visibility.pending} move={visibility.moveProject} render={renderOrdinary} /></section>
            )}
          </div>
        </SlidingContent>
      </section>
      {hiddenProjects.length > 0 ? <div role="separator" className="border-t border-sidebar-border" /> : null}
      {hiddenProjects.length > 0 ? (
        <section aria-label="Hidden projects">
          <h2 className="px-1 py-1 text-sm font-bold text-muted-foreground">
            <button aria-expanded={!hiddenCollapsed} aria-controls={hiddenContentId} className="flex w-full cursor-pointer items-center gap-2 text-left" onClick={() => setHiddenCollapsed(!hiddenCollapsed)} type="button">
              <span className="flex items-center gap-1">Hidden projects ({hiddenProjects.length})<Icon name="ChevronRight" aria-hidden="true" className={hiddenCollapsed ? "size-4 shrink-0" : "size-4 shrink-0 rotate-90"} /></span>
            </button>
          </h2>
          <SlidingContent collapsed={hiddenCollapsed} contentId={hiddenContentId}>
            <ul className="pt-1">{hiddenProjects.map((project) => <HiddenProjectRow key={project.id} project={project} visibility={visibility} />)}</ul>
          </SlidingContent>
        </section>
      ) : null}
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_threadList({
    id: "sidebar-plus",
    title: "Sidebar Plus",
    description: "Project-grouped sidebar threads with live branch and status metadata.",
    component: SidebarPlusThreadList,
  });
});
