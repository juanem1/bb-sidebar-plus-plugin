import { useEffect, useRef, useState, type ReactElement } from "react";
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
import { ProjectOrder } from "./project-order";

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
          "flex items-start gap-3 rounded-md px-3 py-2 outline-none transition-colors",
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
            className="block truncate text-sm font-medium"
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
  handle,
}: {
  activeThreadId: string | null;
  onNavigate: () => void;
  project: PluginSidebarProject;
  pinned: boolean;
  threads: readonly PluginSidebarThread[];
  visibility: ReturnType<typeof useProjectVisibility>;
  handle: ReactElement;
}): ReactElement {
  const collapsed: boolean = visibility.state?.collapsedProjectIds.includes(project.id) === true;
  return (
    <section className="rounded-lg bg-sidebar/40">
      <header className="flex items-center gap-1 px-2 py-2">
        {handle}
        <button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${project.name}`}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
          disabled={visibility.pending}
          onClick={() => { void (collapsed ? visibility.expandProject(project.id) : visibility.collapseProject(project.id)); }}
          type="button"
        >
          <span aria-hidden="true" className="mr-1">{collapsed ? "▸" : "▾"}</span>{project.name}
        </button>
        <ProjectControls project={project} pinned={pinned} visibility={visibility} onNavigate={onNavigate} />
      </header>
      {collapsed ? null : threads.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">No visible threads.</p>
      ) : (
        <ul className="p-2">
          {threads.map((thread) => <ThreadRow key={thread.id} activeThreadId={activeThreadId} onNavigate={onNavigate} thread={thread} />)}
        </ul>
      )}
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

  function renderPinned(project: PluginSidebarProject, handle: ReactElement): ReactElement {
    return <ProjectSection project={project} handle={handle} pinned={true} threads={threadsByProjectId.get(project.id) ?? []} visibility={visibility} activeThreadId={activeThreadId} onNavigate={onNavigate} />;
  }
  function renderOrdinary(project: PluginSidebarProject, handle: ReactElement): ReactElement {
    return <ProjectSection project={project} handle={handle} pinned={false} threads={threadsByProjectId.get(project.id) ?? []} visibility={visibility} activeThreadId={activeThreadId} onNavigate={onNavigate} />;
  }

  return (
    <div data-project-order-scroll="" className="flex min-h-full flex-col gap-3 px-3 py-3">
      {state.grouping === "project" && pinnedProjects.length > 0 ? (
        <section aria-label="Pinned projects" className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold">Pinned</h2>
          <ProjectOrder projects={pinnedProjects} pending={visibility.pending} move={visibility.movePinnedProject} render={renderPinned} />
        </section>
      ) : null}
      <SidebarHeader visibility={visibility} projects={visibleProjects} onNavigate={onNavigate} />
      {state.showSearch ? <input aria-label="Search projects" type="search" placeholder="Search projects…" className="w-full rounded border border-sidebar-border bg-sidebar px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
      {visibility.error !== null ? <p role="alert" className="rounded border border-destructive/50 p-2 text-xs text-destructive">{visibility.error}</p> : null}
      {state.grouping === "none" ? (
        flatThreads.length === 0 ? <p className="px-1 text-sm text-muted-foreground">No visible threads in matching projects.</p> : <ul aria-label="Threads">{flatThreads.map((thread) => <ThreadRow key={thread.id} thread={thread} activeThreadId={activeThreadId} onNavigate={onNavigate} />)}</ul>
      ) : ordinaryProjects.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{projects.length === 0 ? "No projects found." : "No matching projects in Projects."}</p>
      ) : (
        <section aria-label="Projects"><ProjectOrder projects={ordinaryProjects} pending={visibility.pending} move={visibility.moveProject} render={renderOrdinary} /></section>
      )}
      {hiddenProjects.length > 0 ? (
        <details className="border-t border-sidebar-border pt-2">
          <summary className="cursor-pointer px-1 py-1 text-sm font-semibold">Hidden projects ({hiddenProjects.length})</summary>
          <ul className="mt-1">{hiddenProjects.map((project) => <HiddenProjectRow key={project.id} project={project} visibility={visibility} />)}</ul>
        </details>
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
