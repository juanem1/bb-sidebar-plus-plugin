import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";

export interface ProjectDragHandleProps {
  title: string;
  className: string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLButtonElement>) => void;
}

interface ProjectOrderProps {
  projects: readonly PluginSidebarProject[];
  pending: boolean;
  move: (projectId: string, beforeProjectId: string | null) => Promise<void>;
  render: (project: PluginSidebarProject, dragHandleProps: ProjectDragHandleProps) => ReactNode;
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

  // Ignore moves while a request is pending instead of disabling the handle: a disabled
  // handle drops keyboard focus and blocks its click action (collapse) during every request.
  function requestMove(projectId: string, beforeProjectId: string | null): void {
    if (!pending) void move(projectId, beforeProjectId);
  }

  function moveUp(projectId: string, index: number): void {
    const previous: PluginSidebarProject | undefined = projects[index - 1];
    if (previous !== undefined) requestMove(projectId, previous.id);
  }

  function moveDown(projectId: string, index: number): void {
    if (index + 1 < projects.length) requestMove(projectId, projects[index + 2]?.id ?? null);
  }

  return (
    <div className="flex flex-col">
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {projects.map((project, index) => {
        const dragHandleProps: ProjectDragHandleProps = {
          title: "Drag to reorder; use arrow keys on keyboard",
          className: `touch-none select-none rounded focus-visible:ring-1 focus-visible:ring-sidebar-ring ${dragging === project.id ? "cursor-grabbing" : "cursor-pointer"}`,
          onKeyDown: (event: KeyboardEvent<HTMLButtonElement>): void => {
            started.current = false;
            if (event.key === "ArrowUp") { event.preventDefault(); moveUp(project.id, index); }
            if (event.key === "ArrowDown") { event.preventDefault(); moveDown(project.id, index); }
            if (event.key === "Home") { event.preventDefault(); requestMove(project.id, projects[0]?.id ?? null); }
            if (event.key === "End") { event.preventDefault(); requestMove(project.id, null); }
          },
          onPointerDown: (event: PointerEvent<HTMLButtonElement>): void => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            originY.current = event.clientY;
            started.current = false;
            before.current = project.id;
          },
          onPointerMove: (event: PointerEvent<HTMLButtonElement>): void => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            if (Math.abs(event.clientY - originY.current) < 5 && !started.current) return;
            // Drag state starts only past the threshold, so a plain click shows no drop marker.
            started.current = true;
            setDragging(project.id);
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
          },
          onPointerUp: (event: PointerEvent<HTMLButtonElement>): void => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (started.current) requestMove(project.id, before.current);
            setDragging(null);
            setTarget(null);
          },
          onPointerCancel: (_event: PointerEvent<HTMLButtonElement>): void => { setDragging(null); setTarget(null); started.current = false; },
          onClickCapture: (event: MouseEvent<HTMLButtonElement>): void => {
            if (!started.current) return;
            started.current = false;
            event.preventDefault();
            event.stopPropagation();
          },
        };
        return <div key={project.id} ref={(element) => { if (element === null) rows.current.delete(project.id); else rows.current.set(project.id, element); }} className={dragging !== null && target === project.id ? "border-t-2 border-sidebar-ring" : ""}>{render(project, dragHandleProps)}</div>;
      })}
      {dragging !== null && target === null ? <div className="border-t-2 border-sidebar-ring" /> : null}
    </div>
  );
}
