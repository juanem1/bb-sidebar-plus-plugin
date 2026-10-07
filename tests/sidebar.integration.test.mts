import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { ProjectVisibilityState } from "../sidebar-preferences";

interface ProjectRecord { id: string; name: string }
interface RpcMethod { input: z.ZodType; output: z.ZodType }
interface PluginModule { default: (bb: BbPluginApi) => Promise<void> }
type RpcHandler = (input: unknown) => Promise<unknown>;

const moduleUrl: string = pathToFileURL(join(process.cwd(), "dist/server.js")).href;
const pluginModule: PluginModule = await import(moduleUrl) as PluginModule;

/** Minimal host adapter runs the built plugin with real SQLite and its own RPC schemas. */
class SidebarHost {
  readonly database: DatabaseSync;
  readonly logs: string[] = [];
  readonly windows: ProjectVisibilityState[][] = [[], []];
  projects: ProjectRecord[] = [{ id: "c", name: "Charlie" }, { id: "a", name: "Alpha" }, { id: "b", name: "Bravo" }];
  private methods: Readonly<Record<string, RpcMethod>> = {};
  private handlers: Readonly<Record<string, RpcHandler>> = {};

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  async start(): Promise<void> {
    // Only the surfaces this plugin actually consumes are implemented; no live BB state is touched.
    const api = {
      pluginId: "sidebar-plus",
      sdk: { projects: { list: async (): Promise<ProjectRecord[]> => [...this.projects] } },
      storage: { kv: {
        get: async (key: string): Promise<unknown> => {
          const row = this.database.prepare("SELECT value FROM preferences WHERE key = ?").get(key);
          return row === undefined ? undefined : JSON.parse(String(row.value)) as unknown;
        },
        set: async (key: string, value: unknown): Promise<void> => {
          this.database.prepare("INSERT INTO preferences VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
        },
      } },
      rpc: { register: (methods: Readonly<Record<string, RpcMethod>>, handlers: Readonly<Record<string, RpcHandler>>): void => {
        this.methods = methods;
        this.handlers = handlers;
      } },
      realtime: { publish: (channel: string, payload: { snapshot: ProjectVisibilityState }): void => {
        assert.equal(channel, "project-visibility-changed");
        for (const window of this.windows) window.push(structuredClone(payload.snapshot));
      } },
      log: {
        info: (message: string): void => { this.logs.push(message); },
        error: (message: string): void => { this.logs.push(message); },
      },
      onDispose: (_dispose: () => void): void => {},
    };
    await pluginModule.default(api as unknown as BbPluginApi);
  }

  async call(name: string, input: unknown): Promise<ProjectVisibilityState> {
    const method: RpcMethod | undefined = this.methods[name];
    const handler: RpcHandler | undefined = this.handlers[name];
    assert.ok(method, `Missing RPC schema: ${name}`);
    assert.ok(handler, `Missing RPC handler: ${name}`);
    const result: unknown = await handler(method.input.parse(input));
    const validated: unknown = method.output.parse(result);
    return (validated as { snapshot: ProjectVisibilityState }).snapshot;
  }

  seed(value: unknown): void {
    this.database.prepare("INSERT INTO preferences VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("sidebar-plus:project-visibility", JSON.stringify(value));
  }
}

async function withHost(run: (host: SidebarHost, path: string) => Promise<void>): Promise<void> {
  const directory: string = await mkdtemp(join(tmpdir(), "sidebar-plus-integration-"));
  const path: string = join(directory, "preferences.sqlite");
  const host: SidebarHost = new SidebarHost(path);
  try {
    await host.start();
    await run(host, path);
  } finally {
    host.database.close();
    await rm(directory, { recursive: true, force: true });
  }
}

await test("first use preserves native order and appends new projects after manual ordering", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    assert.deepEqual((await host.call("getProjectVisibility", null)).projectOrder, ["c", "a", "b"]);
    await host.call("moveProject", { projectId: "b", beforeProjectId: "c" });
    host.projects.unshift({ id: "d", name: "Aardvark" });
    const state: ProjectVisibilityState = await host.call("syncProjects", null);
    assert.deepEqual(state.projectOrder, ["b", "c", "a", "d"]);
    assert.equal(state.sorting, "manual");
  });
});

await test("name sorting affects ordinary projects only, never pinned order", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    host.projects.push({ id: "d", name: "Delta" });
    await host.call("pinProject", { projectId: "d" });
    await host.call("pinProject", { projectId: "b" });
    await host.call("movePinnedProject", { projectId: "b", beforeProjectId: "d" });
    const state: ProjectVisibilityState = await host.call("sortProjectsByName", null);
    assert.deepEqual(state.pinnedProjectIds, ["b", "d"]);
    assert.deepEqual(state.projectOrder, ["a", "c", "b", "d"]);
    host.projects.unshift({ id: "e", name: "Aardvark" });
    assert.deepEqual((await host.call("syncProjects", null)).projectOrder, ["a", "c", "b", "d", "e"]);
  });
});

await test("hide and show never restore a pin or lose ordinary saved positions", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    await host.call("pinProject", { projectId: "a" });
    const hidden: ProjectVisibilityState = await host.call("hideProject", { projectId: "a" });
    assert.deepEqual(hidden.pinnedProjectIds, []);
    assert.deepEqual(hidden.hiddenProjectIds, ["a"]);
    const shown: ProjectVisibilityState = await host.call("showProject", { projectId: "a" });
    assert.deepEqual(shown.pinnedProjectIds, []);
    assert.deepEqual(shown.hiddenProjectIds, []);
    assert.deepEqual(shown.projectOrder, ["c", "a", "b"]);
  });
});

await test("validated v1 preferences migrate without losing pin and hide membership", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    host.seed({ version: 1, revision: 7, pinnedProjectIds: ["b"], hiddenProjectIds: ["a"] });
    const state: ProjectVisibilityState = await host.call("getProjectVisibility", null);
    assert.equal(state.version, 2);
    assert.ok(state.revision > 7);
    assert.deepEqual(state.pinnedProjectIds, ["b"]);
    assert.deepEqual(state.hiddenProjectIds, ["a"]);
    assert.equal(state.grouping, "project");
    assert.equal(state.showSearch, false);
  });
});

await test("corrupt state and invalid RPC input fail explicitly without resetting preferences", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    host.seed({ version: 1, revision: 0, pinnedProjectIds: ["a"], hiddenProjectIds: ["a"] });
    await assert.rejects(host.call("getProjectVisibility", null), /invalid/);
    await assert.rejects(host.call("pinProject", { projectId: "" }), /small/);
    const row = host.database.prepare("SELECT value FROM preferences").get();
    assert.ok(row);
    assert.deepEqual(JSON.parse(String(row.value)).hiddenProjectIds, ["a"]);
    assert.ok(host.logs.some((line) => JSON.parse(line).event === "sidebar_preferences_invalid"));
  });
});

await test("moves cannot change membership across sections", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    await host.call("pinProject", { projectId: "a" });
    await assert.rejects(host.call("moveProject", { projectId: "a", beforeProjectId: "c" }), /section/);
    await assert.rejects(host.call("movePinnedProject", { projectId: "a", beforeProjectId: "b" }), /section/);
    assert.deepEqual((await host.call("getProjectVisibility", null)).pinnedProjectIds, ["a"]);
  });
});

await test("a fresh backend instance restores preferences from a new SQLite connection", async (): Promise<void> => {
  await withHost(async (host, path): Promise<void> => {
    await host.call("pinProject", { projectId: "b" });
    await host.call("hideProject", { projectId: "c" });
    await host.call("setGrouping", { grouping: "none" });
    await host.call("setShowSearch", { showSearch: true });
    await host.call("collapseProject", { projectId: "a" });
    const saved: ProjectVisibilityState = await host.call("getProjectVisibility", null);
    const restarted: SidebarHost = new SidebarHost(path);
    try {
      await restarted.start();
      assert.deepEqual(await restarted.call("getProjectVisibility", null), saved);
    } finally {
      restarted.database.close();
    }
  });
});

await test("concurrent requests retain both changes and broadcast ordered snapshots to two consumers", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    const initial: ProjectVisibilityState = await host.call("getProjectVisibility", null);
    const states: ProjectVisibilityState[] = await Promise.all([
      host.call("pinProject", { projectId: "a" }),
      host.call("hideProject", { projectId: "b" }),
      host.call("setGrouping", { grouping: "none" }),
    ]);
    const final: ProjectVisibilityState = await host.call("getProjectVisibility", null);
    assert.deepEqual(final.pinnedProjectIds, ["a"]);
    assert.deepEqual(final.hiddenProjectIds, ["b"]);
    assert.equal(final.grouping, "none");
    assert.deepEqual(states.map((state) => state.revision), [initial.revision + 1, initial.revision + 2, initial.revision + 3]);
    assert.deepEqual(host.windows[0], host.windows[1]);
    assert.deepEqual(host.windows[0]?.at(-1), final);
  });
});

await test("a real SQLite write rejection is explicit and does not broadcast or poison the queue", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    const initial: ProjectVisibilityState = await host.call("getProjectVisibility", null);
    const broadcasts: number = host.windows[0]?.length ?? 0;
    host.database.exec("PRAGMA query_only = ON");
    await assert.rejects(host.call("pinProject", { projectId: "a" }), /not saved/);
    assert.equal(host.windows[0]?.length, broadcasts);
    assert.deepEqual(await host.call("getProjectVisibility", null), initial);
    assert.ok(host.logs.some((line) => JSON.parse(line).event === "sidebar_preferences_write_failed"));
    host.database.exec("PRAGMA query_only = OFF");
    assert.deepEqual((await host.call("pinProject", { projectId: "b" })).pinnedProjectIds, ["b"]);
  });
});

await test("storage read failure is actionable and never silently initializes preferences", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    host.database.exec("DROP TABLE preferences");
    await assert.rejects(host.call("getProjectVisibility", null), /could not read/);
    assert.equal(host.windows[0]?.length, 0);
    assert.ok(host.logs.some((line) => JSON.parse(line).event === "sidebar_preferences_read_failed"));
  });
});

await test("deleted projects leave no stale pinned, hidden, collapsed, or ordered IDs", async (): Promise<void> => {
  await withHost(async (host): Promise<void> => {
    await host.call("pinProject", { projectId: "a" });
    await host.call("hideProject", { projectId: "b" });
    await host.call("collapseProject", { projectId: "a" });
    host.projects = host.projects.filter((project) => project.id === "c");
    const state: ProjectVisibilityState = await host.call("syncProjects", null);
    assert.deepEqual(state.projectOrder, ["c"]);
    assert.deepEqual(state.pinnedProjectIds, []);
    assert.deepEqual(state.hiddenProjectIds, []);
    assert.deepEqual(state.collapsedProjectIds, []);
    await assert.rejects(host.call("pinProject", { projectId: "a" }), /no longer exists/);
  });
});
