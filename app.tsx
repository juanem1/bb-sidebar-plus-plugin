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
} from "@get-bb/plugin-sdk/app";
import { HiddenProjectRow, ProjectControls } from "./project-controls";
import { useProjectVisibility } from "./use-project-visibility";

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
  const branchName = thread.environment?.branchName;
  const isActive = activeThreadId === thread.id;

  return (
    <li>
      <a
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
}: {
  activeThreadId: string | null;
  onNavigate: () => void;
  project: PluginSidebarProject;
  pinned: boolean;
  threads: readonly PluginSidebarThread[];
  visibility: ReturnType<typeof useProjectVisibility>;
}) {
  return (
    <section className="rounded-lg bg-sidebar/40">
      <header className="flex items-center gap-2 px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground">
          {project.name}
        </h2>
        <ProjectControls project={project} pinned={pinned} visibility={visibility} />
      </header>
      {threads.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No visible threads.
        </p>
      ) : (
        <ul className="p-2">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              activeThreadId={activeThreadId}
              onNavigate={onNavigate}
              thread={thread}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SidebarPlusThreadList({
  activeThreadId,
  onNavigate,
}: PluginThreadListProps) {
  const { projects, status, threads } = experimental_useSidebarThreads();
  const visibility = useProjectVisibility();
  const threadsByProjectId = getVisibleThreadsByProjectId(threads);

  if (status === "loading") {
    return (
      <div className="px-3 py-4">
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-3 py-4">
        <p className="text-sm text-destructive">
          Sidebar Plus could not load the sidebar thread data.
        </p>
      </div>
    );
  }

  if (visibility.loading && visibility.state === null) {
    return (
      <div className="px-3 py-4" role="status">
        <p className="text-sm text-muted-foreground">Loading project preferences…</p>
      </div>
    );
  }

  if (visibility.error !== null || visibility.state === null) {
    return (
      <div className="px-3 py-4" role="alert">
        <p className="text-sm text-destructive">
          {visibility.error ?? "Project preferences are unavailable. Reload the plugin or contact its maintainer."}
        </p>
      </div>
    );
  }

  const pinnedProjectIds = new Set(visibility.state.pinnedProjectIds);
  const hiddenProjectIds = new Set(visibility.state.hiddenProjectIds);
  const pinnedProjects = projects.filter(
    (project) => pinnedProjectIds.has(project.id) && !hiddenProjectIds.has(project.id),
  );
  const ordinaryProjects = projects.filter(
    (project) => !pinnedProjectIds.has(project.id) && !hiddenProjectIds.has(project.id),
  );
  const hiddenProjects = projects.filter((project) => hiddenProjectIds.has(project.id));

  function renderProjects(projectsToRender: readonly PluginSidebarProject[], pinned: boolean) {
    return projectsToRender.map((project) => (
      <ProjectSection
        key={project.id}
        activeThreadId={activeThreadId}
        onNavigate={onNavigate}
        project={project}
        pinned={pinned}
        threads={threadsByProjectId.get(project.id) ?? []}
        visibility={visibility}
      />
    ));
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-3 py-3">
      {pinnedProjects.length > 0 ? (
        <section aria-label="Pinned projects" className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-sidebar-foreground">
            Pinned
          </h2>
          {renderProjects(pinnedProjects, true)}
        </section>
      ) : null}
      <div className="px-1">
        <h1 className="text-sm font-semibold text-sidebar-foreground">
          Projects
        </h1>
      </div>
      {ordinaryProjects.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {projects.length === 0 ? "No projects found." : "No projects in Projects."}
        </p>
      ) : (
        <section aria-label="Projects" className="flex flex-col gap-2">
          {renderProjects(ordinaryProjects, false)}
        </section>
      )}
      {hiddenProjects.length > 0 ? (
        <details className="border-t border-sidebar-border pt-2">
          <summary className="cursor-pointer px-1 py-1 text-sm font-semibold text-sidebar-foreground">
            Hidden projects ({hiddenProjects.length})
          </summary>
          <ul className="mt-1">
            {hiddenProjects.map((project) => (
              <HiddenProjectRow key={project.id} project={project} visibility={visibility} />
            ))}
          </ul>
        </details>
      ) : null}
      {visibility.error !== null ? (
        <p className="rounded border border-destructive/50 p-2 text-xs text-destructive" role="alert">
          {visibility.error}
        </p>
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
