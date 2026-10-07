import { useRef, useState, type ReactElement, type ReactNode } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";

interface ProjectOrderProps {
  projects: readonly PluginSidebarProject[];
  pending: boolean;
  move: (projectId: string, beforeProjectId: string | null) => Promise<void>;
  render: (project: PluginSidebarProject, handle: ReactElement) => ReactNode;
}

/** Handles support pointer dragging (including touch) and keyboard arrows. */
export function ProjectOrder({ projects, pending, move, render }: ProjectOrderProps): ReactElement {
  const rows = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const before = useRef<string | null>(null);
  const started = useRef<boolean>(false);
  const originY = useRef<number>(0);
  const announcement: string = dragging === null ? "" : `Moving ${projects.find((project) => project.id === dragging)?.name}. ${target === null ? "To the end." : `Before ${projects.find((project) => project.id === target)?.name}.`}`;

  function moveUp(projectId: string, index: number): void {
    const previous: PluginSidebarProject | undefined = projects[index - 1];
    if (previous !== undefined) void move(projectId, previous.id);
  }

  function moveDown(projectId: string, index: number): void {
    if (index + 1 < projects.length) void move(projectId, projects[index + 2]?.id ?? null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {projects.map((project, index) => {
        const handle: ReactElement = (
          <button
            aria-label={`Reorder ${project.name}. Use Up or Down arrow keys, or drag.`}
            title="Drag to reorder; use arrow keys on keyboard"
            type="button"
            disabled={pending}
            className="touch-none shrink-0 cursor-grab rounded px-1 py-1 text-xs text-muted-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring"
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") { event.preventDefault(); moveUp(project.id, index); }
              if (event.key === "ArrowDown") { event.preventDefault(); moveDown(project.id, index); }
              if (event.key === "Home") { event.preventDefault(); void move(project.id, projects[0]?.id ?? null); }
              if (event.key === "End") { event.preventDefault(); void move(project.id, null); }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              originY.current = event.clientY;
              started.current = false;
              before.current = project.id;
              setDragging(project.id);
              setTarget(project.id);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              if (Math.abs(event.clientY - originY.current) < 5 && !started.current) return;
              started.current = true;
              let destination: string | null = null;
              for (const candidate of projects) {
                if (candidate.id === project.id) continue;
                const rect: DOMRect | undefined = rows.current.get(candidate.id)?.getBoundingClientRect();
                if (rect !== undefined && event.clientY < rect.top + rect.height / 2) { destination = candidate.id; break; }
              }
              before.current = destination;
              setTarget(destination);
              const scrollArea: HTMLElement | null = event.currentTarget.closest("[data-project-order-scroll]");
              if (scrollArea !== null) {
                const bounds: DOMRect = scrollArea.getBoundingClientRect();
                if (event.clientY < bounds.top + 32) scrollArea.scrollBy({ top: -20 });
                if (event.clientY > bounds.bottom - 32) scrollArea.scrollBy({ top: 20 });
              }
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              if (started.current) void move(project.id, before.current);
              setDragging(null);
              setTarget(null);
            }}
            onPointerCancel={() => { setDragging(null); setTarget(null); started.current = false; }}
          >
            ⠿
          </button>
        );
        return <div key={project.id} ref={(element) => { if (element === null) rows.current.delete(project.id); else rows.current.set(project.id, element); }} className={dragging !== null && target === project.id ? "border-t-2 border-sidebar-ring" : ""}>{render(project, handle)}</div>;
      })}
      {dragging !== null && target === null ? <div className="border-t-2 border-sidebar-ring" /> : null}
    </div>
  );
}
