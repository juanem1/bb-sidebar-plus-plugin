import type { BbPluginApi } from "@get-bb/plugin-sdk";
import {
  PROJECT_VISIBILITY_CHANNEL,
  PROJECT_VISIBILITY_KV_KEY,
  createInitialProjectVisibilityState,
  parseStoredPreferences,
  projectVisibilityStateSchema,
  type ProjectVisibilityResult,
  type ProjectVisibilityState,
} from "./sidebar-preferences";
import { sidebarRpcContract } from "./sidebar-rpc";

class SidebarPreferencesError extends Error {
  override name: string = "SidebarPreferencesError";
}

type ProjectListResult = Awaited<ReturnType<BbPluginApi["sdk"]["projects"]["list"]>>;

type PreferenceChange = (current: ProjectVisibilityState) => ProjectVisibilityState;

function moveBefore(ids: readonly string[], projectId: string, beforeProjectId: string | null): string[] {
  if (!ids.includes(projectId) || (beforeProjectId !== null && !ids.includes(beforeProjectId))) {
    throw new SidebarPreferencesError("The move target is no longer in this section. Refresh and try again.");
  }
  if (projectId === beforeProjectId) return [...ids];
  const remaining: string[] = ids.filter((id) => id !== projectId);
  remaining.splice(beforeProjectId === null ? remaining.length : remaining.indexOf(beforeProjectId), 0, projectId);
  return remaining;
}

export default async function plugin(bb: BbPluginApi): Promise<void> {
  let mutationQueue: Promise<void> = Promise.resolve();

  async function readState(): Promise<ProjectVisibilityState> {
    let stored: unknown;
    try {
      stored = await bb.storage.kv.get<unknown>(PROJECT_VISIBILITY_KV_KEY);
    } catch (cause: unknown) {
      bb.log.error(JSON.stringify({ event: "sidebar_preferences_read_failed", key: PROJECT_VISIBILITY_KV_KEY, cause: String(cause) }));
      throw new SidebarPreferencesError("Sidebar Plus could not read your preferences. Reconnect and retry; your data has not been reset.");
    }
    if (stored === undefined) return createInitialProjectVisibilityState();
    try {
      return parseStoredPreferences(stored);
    } catch (cause: unknown) {
      bb.log.error(JSON.stringify({ event: "sidebar_preferences_invalid", key: PROJECT_VISIBILITY_KV_KEY, cause: String(cause) }));
      throw new SidebarPreferencesError("Saved Sidebar Plus preferences are invalid. Ask the maintainer to repair the preference key; your data has not been reset.");
    }
  }

  async function commitState(current: ProjectVisibilityState, changed: ProjectVisibilityState): Promise<ProjectVisibilityState> {
    const snapshot: ProjectVisibilityState = projectVisibilityStateSchema.parse({ ...changed, revision: current.revision + 1 });
    try {
      await bb.storage.kv.set(PROJECT_VISIBILITY_KV_KEY, snapshot);
    } catch (cause: unknown) {
      bb.log.error(JSON.stringify({ event: "sidebar_preferences_write_failed", revision: snapshot.revision, cause: String(cause) }));
      throw new SidebarPreferencesError("Sidebar Plus could not save your preferences. Retry the action; the change was not saved.");
    }
    try {
      bb.realtime.publish(PROJECT_VISIBILITY_CHANNEL, { snapshot });
    } catch (cause: unknown) {
      bb.log.error(JSON.stringify({ event: "sidebar_preferences_publish_failed", revision: snapshot.revision, cause: String(cause) }));
      throw new SidebarPreferencesError("Preferences were saved, but could not reach other windows. Reconnect those windows to refresh them.");
    }
    return snapshot;
  }

  async function listProjects(): Promise<ProjectListResult> {
    try {
      return await bb.sdk.projects.list({ includePersonal: true });
    } catch (cause: unknown) {
      bb.log.error(JSON.stringify({ event: "sidebar_projects_list_failed", params: { includePersonal: true }, cause: String(cause) }));
      throw new SidebarPreferencesError("Sidebar Plus could not load the current projects. Reconnect and retry the action.");
    }
  }

  async function synchronize(current: ProjectVisibilityState): Promise<ProjectVisibilityState> {
    const projects: ProjectListResult = await listProjects();
    const ids: string[] = projects.map((project) => project.id);
    const existing: ReadonlySet<string> = new Set(ids);
    const order: string[] = current.projectOrder.filter((id) => existing.has(id));
    const known: ReadonlySet<string> = new Set(order);
    order.push(...ids.filter((id) => !known.has(id)));
    const snapshot: ProjectVisibilityState = {
      ...current,
      projectOrder: order,
      pinnedProjectIds: current.pinnedProjectIds.filter((id) => existing.has(id)),
      hiddenProjectIds: current.hiddenProjectIds.filter((id) => existing.has(id)),
      collapsedProjectIds: current.collapsedProjectIds.filter((id) => existing.has(id)),
    };
    if (JSON.stringify(snapshot) === JSON.stringify(current)) return current;
    return commitState(current, snapshot);
  }

  function enqueue(operation: () => Promise<ProjectVisibilityResult>): Promise<ProjectVisibilityResult> {
    const result: Promise<ProjectVisibilityResult> = mutationQueue.then(operation);
    // The caller receives the rejection; the queue stays usable after a failed request.
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function update(change: PreferenceChange): Promise<ProjectVisibilityResult> {
    return enqueue(async () => {
      const current: ProjectVisibilityState = await synchronize(await readState());
      return { snapshot: await commitState(current, change(current)) };
    });
  }

  function validateProject(current: ProjectVisibilityState, projectId: string): void {
    if (!current.projectOrder.includes(projectId)) {
      throw new SidebarPreferencesError("This project no longer exists. Refresh the sidebar and try again.");
    }
  }

  function pinProject(projectId: string): Promise<ProjectVisibilityResult> {
    return update((current) => {
      validateProject(current, projectId);
      return { ...current, pinnedProjectIds: current.pinnedProjectIds.includes(projectId) ? current.pinnedProjectIds : [...current.pinnedProjectIds, projectId], hiddenProjectIds: current.hiddenProjectIds.filter((id) => id !== projectId) };
    });
  }

  function unpinProject(projectId: string): Promise<ProjectVisibilityResult> {
    return update((current) => {
      validateProject(current, projectId);
      return { ...current, pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId) };
    });
  }

  function hideProject(projectId: string): Promise<ProjectVisibilityResult> {
    return update((current) => {
      validateProject(current, projectId);
      return { ...current, pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId), hiddenProjectIds: current.hiddenProjectIds.includes(projectId) ? current.hiddenProjectIds : [...current.hiddenProjectIds, projectId] };
    });
  }

  function showProject(projectId: string): Promise<ProjectVisibilityResult> {
    return update((current) => {
      validateProject(current, projectId);
      return { ...current, pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId), hiddenProjectIds: current.hiddenProjectIds.filter((id) => id !== projectId) };
    });
  }

  function moveProject(projectId: string, beforeProjectId: string | null): Promise<ProjectVisibilityResult> {
    return update((current) => {
      const excluded: ReadonlySet<string> = new Set([...current.hiddenProjectIds, ...current.pinnedProjectIds]);
      const ordinary: string[] = current.projectOrder.filter((id) => !excluded.has(id));
      const moved: string[] = moveBefore(ordinary, projectId, beforeProjectId);
      let index: number = 0;
      return { ...current, sorting: "manual", projectOrder: current.projectOrder.map((id) => excluded.has(id) ? id : moved[index++]!) };
    });
  }

  function movePinnedProject(projectId: string, beforeProjectId: string | null): Promise<ProjectVisibilityResult> {
    return update((current) => ({ ...current, pinnedProjectIds: moveBefore(current.pinnedProjectIds, projectId, beforeProjectId) }));
  }

  function sortProjectsByName(): Promise<ProjectVisibilityResult> {
    return enqueue(async () => {
      const current: ProjectVisibilityState = await synchronize(await readState());
      const projects: ProjectListResult = await listProjects();
      const names: ReadonlyMap<string, string> = new Map(projects.map((project) => [project.id, project.name]));
      const excluded: ReadonlySet<string> = new Set([...current.pinnedProjectIds, ...current.hiddenProjectIds]);
      const sorted: string[] = current.projectOrder.filter((id) => !excluded.has(id));
      sorted.sort((left, right) => {
        const leftName: string | undefined = names.get(left);
        const rightName: string | undefined = names.get(right);
        if (leftName === undefined || rightName === undefined) throw new SidebarPreferencesError("Projects changed while sorting. Retry Sort by name.");
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" }) || left.localeCompare(right);
      });
      let index: number = 0;
      return { snapshot: await commitState(current, { ...current, sorting: "name", projectOrder: current.projectOrder.map((id) => excluded.has(id) ? id : sorted[index++]!) }) };
    });
  }

  bb.rpc.register(sidebarRpcContract, {
    getProjectVisibility: () => enqueue(async () => ({ snapshot: await synchronize(await readState()) })),
    syncProjects: () => enqueue(async () => ({ snapshot: await synchronize(await readState()) })),
    pinProject: ({ projectId }) => pinProject(projectId),
    unpinProject: ({ projectId }) => unpinProject(projectId),
    hideProject: ({ projectId }) => hideProject(projectId),
    showProject: ({ projectId }) => showProject(projectId),
    moveProject: ({ projectId, beforeProjectId }) => moveProject(projectId, beforeProjectId),
    movePinnedProject: ({ projectId, beforeProjectId }) => movePinnedProject(projectId, beforeProjectId),
    sortProjectsByName: () => sortProjectsByName(),
    selectManualOrder: () => update((current) => ({ ...current, sorting: "manual" })),
    setGrouping: ({ grouping }) => update((current) => ({ ...current, grouping })),
    setShowSearch: ({ showSearch }) => update((current) => ({ ...current, showSearch })),
    collapseProject: ({ projectId }) => update((current) => {
      validateProject(current, projectId);
      return { ...current, collapsedProjectIds: current.collapsedProjectIds.includes(projectId) ? current.collapsedProjectIds : [...current.collapsedProjectIds, projectId] };
    }),
    expandProject: ({ projectId }) => update((current) => ({ ...current, collapsedProjectIds: current.collapsedProjectIds.filter((id) => id !== projectId) })),
  });

  bb.log.info(JSON.stringify({ event: "sidebar_plus_loaded", pluginId: bb.pluginId }));
  bb.onDispose(() => bb.log.info(JSON.stringify({ event: "sidebar_plus_disposed", pluginId: bb.pluginId })));
}
