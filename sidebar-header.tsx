import { useState, type FormEvent, type ReactElement } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { useBbNavigate, useSdk } from "@get-bb/plugin-sdk/app";
import { ProjectControls } from "./project-controls";
import { ProjectOrder } from "./project-order";
import type { ProjectVisibilityController } from "./use-project-visibility";

interface HostChoice { id: string; name: string }
interface SidebarHeaderProps {
  visibility: ProjectVisibilityController;
  projects: readonly PluginSidebarProject[];
  onNavigate: () => void;
}

function AddProject({ onNavigate }: { onNavigate: () => void }): ReactElement {
  const sdk = useSdk();
  const navigate = useBbNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [hosts, setHosts] = useState<readonly HostChoice[]>([]);
  const [hostId, setHostId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [path, setPath] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<boolean>(false);

  async function openForm(): Promise<void> {
    setOpen(true);
    setError(null);
    setPending(true);
    try {
      const available = await sdk.hosts.list({});
      setHosts(available.map((host) => ({ id: host.id, name: host.name })));
      if (available.length === 0) setError("No hosts are available. Connect a host in BB before adding a project.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not list hosts. Retry Add project.");
    } finally {
      setPending(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (hostId === "" || name.trim() === "" || path.trim() === "") {
      setError("Choose a host and enter a project name and an absolute folder path.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const project = await sdk.projects.create({ name: name.trim(), source: { type: "local_path", hostId, path: path.trim() } });
      setOpen(false);
      setName("");
      setPath("");
      navigate.toProject(project.id);
      onNavigate();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create the project. Check the host and folder path.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button aria-label="Add project" title="Add project" type="button" className="rounded px-2 py-1 hover:bg-sidebar-accent" onClick={() => { void openForm(); }}>+</button>
      {open ? (
        <form aria-label="Add project" className="absolute right-3 left-3 z-30 flex flex-col gap-2 rounded border border-sidebar-border bg-sidebar p-3 shadow-lg" onSubmit={(event) => { void createProject(event); }}>
          <label className="text-xs">Project name<input autoFocus required className="mt-1 w-full rounded border border-sidebar-border bg-sidebar p-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="text-xs">Host<select required className="mt-1 w-full rounded border border-sidebar-border bg-sidebar p-2" value={hostId} onChange={(event) => setHostId(event.target.value)}><option value="">Choose a host</option>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></label>
          <label className="text-xs">Absolute folder path<input required className="mt-1 w-full rounded border border-sidebar-border bg-sidebar p-2" value={path} onChange={(event) => setPath(event.target.value)} /></label>
          {error !== null ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2"><button disabled={pending} type="button" onClick={() => setOpen(false)}>Cancel</button><button disabled={pending || hosts.length === 0} type="submit">{pending ? "Working…" : "Create project"}</button></div>
        </form>
      ) : null}
    </div>
  );
}

export function SidebarHeader({ visibility, projects, onNavigate }: SidebarHeaderProps): ReactElement {
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
  function renderManagementRow(project: PluginSidebarProject, handle: ReactElement): ReactElement {
    return (
      <div className="flex items-center gap-1 py-1">
        {handle}
        <span className="min-w-0 flex-1 truncate text-xs">{project.name}</span>
        <ProjectControls project={project} pinned={pinned.has(project.id)} visibility={visibility} onNavigate={onNavigate} />
      </div>
    );
  }
  const controlClass: string = "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-sidebar-accent";
  return (
    <header className="relative flex items-center gap-1 px-1">
      <h1 className="min-w-0 flex-1 text-sm font-semibold">Projects</h1>
      <details className="relative">
        <summary aria-label="Sidebar options" className="cursor-pointer list-none rounded px-2 py-1 text-xs hover:bg-sidebar-accent">Options</summary>
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
      <AddProject onNavigate={onNavigate} />
    </header>
  );
}
