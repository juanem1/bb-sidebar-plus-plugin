import type { BbPluginApi } from "@get-bb/plugin-sdk";
import {
  PROJECT_VISIBILITY_CHANNEL,
  PROJECT_VISIBILITY_KV_KEY,
  createInitialProjectVisibilityState,
  projectVisibilityStateSchema,
  projectVisibilitySignalSchema,
  type ProjectVisibilityState,
} from "./sidebar-preferences";
import { sidebarRpcContract } from "./sidebar-rpc";

type ProjectMemberships = Pick<
  ProjectVisibilityState,
  "pinnedProjectIds" | "hiddenProjectIds"
>;
type ProjectMembershipChange = (state: ProjectVisibilityState) => ProjectMemberships;

function createVisibilityError(message: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${message} ${detail}`);
}

export default async function plugin(bb: BbPluginApi): Promise<void> {
  let mutationQueue: Promise<void> = Promise.resolve();

  async function readVisibilityState(): Promise<ProjectVisibilityState> {
    let storedValue: unknown;
    try {
      storedValue = await bb.storage.kv.get<unknown>(PROJECT_VISIBILITY_KV_KEY);
    } catch (cause: unknown) {
      const error = createVisibilityError(
        "Could not read Sidebar Plus project visibility preferences.",
        cause,
      );
      bb.log.error(JSON.stringify({ event: "sidebar_plus_visibility_read_failed", error: error.message }));
      throw error;
    }

    if (storedValue === undefined) {
      return createInitialProjectVisibilityState();
    }

    const parsedState = projectVisibilityStateSchema.safeParse(storedValue);
    if (!parsedState.success) {
      const issues = parsedState.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      }));
      const error = new Error(
        `Saved Sidebar Plus project visibility preferences are invalid. Remove or repair key ${PROJECT_VISIBILITY_KV_KEY}; validation issues: ${JSON.stringify(issues)}`,
      );
      bb.log.error(JSON.stringify({ event: "sidebar_plus_visibility_state_invalid", issues }));
      throw error;
    }

    return parsedState.data;
  }

  async function persistVisibilityMutation(
    action: "pin" | "unpin" | "hide" | "show",
    projectId: string,
    changeMemberships: ProjectMembershipChange,
  ): Promise<{ snapshot: ProjectVisibilityState }> {
    const operation = mutationQueue.then(async () => {
      const current = await readVisibilityState();
      const memberships = changeMemberships(current);

      const snapshot = projectVisibilityStateSchema.parse({
        version: current.version,
        revision: current.revision + 1,
        ...memberships,
      });

      try {
        await bb.storage.kv.set(PROJECT_VISIBILITY_KV_KEY, snapshot);
      } catch (cause: unknown) {
        const error = createVisibilityError(
          `Could not ${action} project ${projectId}; Sidebar Plus did not save the change.`,
          cause,
        );
        bb.log.error(JSON.stringify({
          event: "sidebar_plus_visibility_write_failed",
          action,
          projectId,
          error: error.message,
        }));
        throw error;
      }

      const signal = projectVisibilitySignalSchema.parse({ action, projectId, snapshot });
      try {
        bb.realtime.publish(PROJECT_VISIBILITY_CHANNEL, signal);
      } catch (cause: unknown) {
        const error = createVisibilityError(
          `Project ${projectId} was saved, but other windows may not receive the ${action} update until they reconnect.`,
          cause,
        );
        bb.log.error(JSON.stringify({
          event: "sidebar_plus_visibility_broadcast_failed",
          action,
          projectId,
          revision: snapshot.revision,
          error: error.message,
        }));
        throw error;
      }
      return { snapshot };
    });

    mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  function pinProject(projectId: string): Promise<{ snapshot: ProjectVisibilityState }> {
    return persistVisibilityMutation("pin", projectId, (current) => ({
      pinnedProjectIds: [
        ...current.pinnedProjectIds.filter((id) => id !== projectId),
        projectId,
      ],
      hiddenProjectIds: current.hiddenProjectIds.filter((id) => id !== projectId),
    }));
  }

  function unpinProject(projectId: string): Promise<{ snapshot: ProjectVisibilityState }> {
    return persistVisibilityMutation("unpin", projectId, (current) => ({
      pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId),
      hiddenProjectIds: current.hiddenProjectIds,
    }));
  }

  function hideProject(projectId: string): Promise<{ snapshot: ProjectVisibilityState }> {
    return persistVisibilityMutation("hide", projectId, (current) => ({
      pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId),
      hiddenProjectIds: [
        ...current.hiddenProjectIds.filter((id) => id !== projectId),
        projectId,
      ],
    }));
  }

  function showProject(projectId: string): Promise<{ snapshot: ProjectVisibilityState }> {
    return persistVisibilityMutation("show", projectId, (current) => ({
      pinnedProjectIds: current.pinnedProjectIds.filter((id) => id !== projectId),
      hiddenProjectIds: current.hiddenProjectIds.filter((id) => id !== projectId),
    }));
  }

  bb.rpc.register(sidebarRpcContract, {
    getProjectVisibility: async () => ({ snapshot: await readVisibilityState() }),
    pinProject: async ({ projectId }) => pinProject(projectId),
    unpinProject: async ({ projectId }) => unpinProject(projectId),
    hideProject: async ({ projectId }) => hideProject(projectId),
    showProject: async ({ projectId }) => showProject(projectId),
  });

  bb.log.info(JSON.stringify({ event: "sidebar_plus_loaded", pluginId: bb.pluginId, scope: "sp-02" }));
  bb.onDispose(() => {
    bb.log.info(JSON.stringify({ event: "sidebar_plus_disposed", pluginId: bb.pluginId, scope: "sp-02" }));
  });
}
