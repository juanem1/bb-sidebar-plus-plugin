import { useCallback, useEffect, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import {
  PROJECT_VISIBILITY_CHANNEL,
  projectVisibilitySignalSchema,
  projectVisibilityStateSchema,
  type ProjectVisibilityState,
} from "./sidebar-preferences";
import { sidebarRpcContract } from "./sidebar-rpc";

export interface ProjectVisibilityController {
  error: string | null;
  loading: boolean;
  state: ProjectVisibilityState | null;
  hideProject(projectId: string): Promise<void>;
  pinProject(projectId: string): Promise<void>;
  showProject(projectId: string): Promise<void>;
  unpinProject(projectId: string): Promise<void>;
}

export function useProjectVisibility(): ProjectVisibilityController {
  const rpc = useRpc<typeof sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [state, setState] = useState<ProjectVisibilityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const loadState = async (): Promise<void> => {
      try {
        const result = await rpc.call("getProjectVisibility", null);
        const snapshot = projectVisibilityStateSchema.parse(result.snapshot);
        if (mounted) {
          setState(snapshot);
          setError(null);
        }
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (mounted) {
          setError(`Could not load project visibility preferences: ${message}`);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void loadState();
    return () => {
      mounted = false;
    };
  }, [connectionState]);

  useRealtime(PROJECT_VISIBILITY_CHANNEL, (payload: unknown) => {
    const parsedSignal = projectVisibilitySignalSchema.safeParse(payload);
    if (!parsedSignal.success) {
      setError("Received an invalid Sidebar Plus visibility update. Reload the plugin or contact its maintainer.");
      return;
    }
    setState((current) => {
      if (current !== null && parsedSignal.data.snapshot.revision <= current.revision) {
        return current;
      }
      return parsedSignal.data.snapshot;
    });
    setError(null);
  });

  const runMutation = useCallback(async (
    method: "hideProject" | "pinProject" | "showProject" | "unpinProject",
    projectId: string,
  ): Promise<void> => {
    try {
      const result = await rpc.call(method, { projectId });
      const snapshot = projectVisibilityStateSchema.parse(result.snapshot);
      setState((current) => current === null || snapshot.revision > current.revision ? snapshot : current);
      setError(null);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const actionableMessage = `Could not update project ${projectId}; the change was not confirmed as saved. ${message}`;
      setError(actionableMessage);
      throw new Error(actionableMessage, { cause });
    }
  }, [rpc]);

  const hideProject = useCallback((projectId: string) => runMutation("hideProject", projectId), [runMutation]);
  const pinProject = useCallback((projectId: string) => runMutation("pinProject", projectId), [runMutation]);
  const showProject = useCallback((projectId: string) => runMutation("showProject", projectId), [runMutation]);
  const unpinProject = useCallback((projectId: string) => runMutation("unpinProject", projectId), [runMutation]);

  return { error, loading, state, hideProject, pinProject, showProject, unpinProject };
}
