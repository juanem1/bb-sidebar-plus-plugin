import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import {
  PROJECT_VISIBILITY_CHANNEL,
  projectVisibilityResultSchema,
  projectVisibilityStateSchema,
  type ProjectVisibilityResult,
  type ProjectVisibilityState,
} from "./sidebar-preferences";
import { sidebarRpcContract } from "./sidebar-rpc";

export interface ProjectVisibilityController {
  error: string | null;
  loading: boolean;
  pending: boolean;
  state: ProjectVisibilityState | null;
  hideProject(projectId: string): Promise<void>;
  pinProject(projectId: string): Promise<void>;
  showProject(projectId: string): Promise<void>;
  unpinProject(projectId: string): Promise<void>;
  moveProject(projectId: string, beforeProjectId: string | null): Promise<void>;
  movePinnedProject(projectId: string, beforeProjectId: string | null): Promise<void>;
  sortProjectsByName(): Promise<void>;
  selectManualOrder(): Promise<void>;
  setGrouping(grouping: ProjectVisibilityState["grouping"]): Promise<void>;
  setShowSearch(showSearch: boolean): Promise<void>;
  collapseProject(projectId: string): Promise<void>;
  expandProject(projectId: string): Promise<void>;
  syncProjects(): Promise<void>;
}

export function useProjectVisibility(): ProjectVisibilityController {
  const rpc = useRpc<typeof sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [state, setState] = useState<ProjectVisibilityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const requestSequence = useRef<number>(0);

  const acceptSnapshot = useCallback((snapshot: ProjectVisibilityState): void => {
    setState((current) => current === null || snapshot.revision > current.revision ? snapshot : current);
  }, []);

  /** RPC rejections become visible UI errors before the event promise resolves. */
  const submit = useCallback(async (request: () => Promise<ProjectVisibilityResult>): Promise<void> => {
    const sequence: number = ++requestSequence.current;
    setPendingCount((count) => count + 1);
    try {
      const result: ProjectVisibilityResult = await request();
      acceptSnapshot(projectVisibilityStateSchema.parse(result.snapshot));
      if (sequence === requestSequence.current) setError(null);
    } catch (cause: unknown) {
      if (sequence === requestSequence.current) {
        const message: string = cause instanceof Error ? cause.message : "The preference request failed.";
        setError(`Sidebar Plus could not confirm this action. ${message}`);
      }
    } finally {
      setPendingCount((count) => count - 1);
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    let mounted: boolean = true;
    setLoading(true);
    const sequence: number = requestSequence.current;
    async function loadState(): Promise<void> {
      try {
        const result: ProjectVisibilityResult = await rpc.call("getProjectVisibility", null);
        if (mounted) {
          acceptSnapshot(projectVisibilityStateSchema.parse(result.snapshot));
          if (sequence === requestSequence.current) setError(null);
        }
      } catch (cause: unknown) {
        if (mounted && sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Could not load Sidebar Plus preferences.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadState();
    return () => { mounted = false; };
  }, [connectionState, rpc, acceptSnapshot]);

  useRealtime(PROJECT_VISIBILITY_CHANNEL, (payload: unknown): void => {
    const signal = projectVisibilityResultSchema.safeParse(payload);
    if (!signal.success) {
      setError("Received an invalid Sidebar Plus update. Reconnect or contact the maintainer.");
      return;
    }
    acceptSnapshot(signal.data.snapshot);
  });

  return {
    error,
    loading,
    pending: pendingCount > 0,
    state,
    hideProject: (projectId) => submit(() => rpc.call("hideProject", { projectId })),
    pinProject: (projectId) => submit(() => rpc.call("pinProject", { projectId })),
    showProject: (projectId) => submit(() => rpc.call("showProject", { projectId })),
    unpinProject: (projectId) => submit(() => rpc.call("unpinProject", { projectId })),
    moveProject: (projectId, beforeProjectId) => submit(() => rpc.call("moveProject", { projectId, beforeProjectId })),
    movePinnedProject: (projectId, beforeProjectId) => submit(() => rpc.call("movePinnedProject", { projectId, beforeProjectId })),
    sortProjectsByName: () => submit(() => rpc.call("sortProjectsByName", null)),
    selectManualOrder: () => submit(() => rpc.call("selectManualOrder", null)),
    setGrouping: (grouping) => submit(() => rpc.call("setGrouping", { grouping })),
    setShowSearch: (showSearch) => submit(() => rpc.call("setShowSearch", { showSearch })),
    collapseProject: (projectId) => submit(() => rpc.call("collapseProject", { projectId })),
    expandProject: (projectId) => submit(() => rpc.call("expandProject", { projectId })),
    syncProjects: () => submit(() => rpc.call("syncProjects", null)),
  };
}
