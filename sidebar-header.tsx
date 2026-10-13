import { useRef, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ProjectVisibilityController } from "./use-project-visibility";
import { useDismissibleMenu } from "./hooks/useDismissibleMenu";
import { useRightMenuPanel } from "./hooks/useRightMenuPanel";
import { useHoverMenu } from "./hooks/useHoverMenu";
import { usePortalScopeProps } from "./lib/portal-scope";
import { Icon } from "./ui/icon";
import { Switch } from "./ui/switch";

interface SidebarHeaderProps {
  visibility: ProjectVisibilityController;
  collapsed: boolean;
  onToggle: () => void;
  contentId: string;
}

export function SidebarHeader({ visibility, collapsed, onToggle, contentId }: SidebarHeaderProps): ReactElement {
  const portalScopeProps = usePortalScopeProps();
  const headerRef: RefObject<HTMLElement | null> = useRef<HTMLElement | null>(null);
  const panelRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const menuRef: RefObject<HTMLDetailsElement | null> = useDismissibleMenu(panelRef);
  useRightMenuPanel(menuRef, panelRef, headerRef);
  useHoverMenu(menuRef, panelRef);
  const state = visibility.state;
  if (state === null) throw new Error("SidebarHeader requires loaded preferences.");
  const controlClass: string = "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-state-hover";
  return (
    <header ref={headerRef} className="relative flex items-center gap-1 px-1 py-1">
      <h1 className="min-w-0 flex-1 text-sm font-bold text-muted-foreground">
        <button aria-expanded={!collapsed} aria-controls={contentId} className="flex w-full cursor-pointer items-center gap-2 text-left" onClick={onToggle} type="button">
          <span className="flex items-center gap-1">All projects<Icon name="ChevronRight" aria-hidden="true" className={collapsed ? "size-4 shrink-0" : "size-4 shrink-0 rotate-90"} /></span>
        </button>
      </h1>
      <details ref={menuRef} className="relative -mr-1">
        <summary aria-label="Sidebar options" title="Sidebar options" className="flex cursor-pointer list-none items-center rounded p-1 hover:bg-sidebar-accent"><Icon name="Settings" aria-hidden="true" className="size-4" /></summary>
        {createPortal(<div {...portalScopeProps} ref={panelRef} className="fixed z-50 w-64 max-w-[80vw] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md">
          <fieldset disabled={visibility.pending} className="flex flex-col gap-1">
            <legend className="px-2 text-sm font-semibold">Sidebar options</legend>
            <label className={controlClass}>Group by<select className="cursor-pointer" value={state.grouping} onChange={(event) => { void visibility.setGrouping(event.target.value === "none" ? "none" : "project"); }}><option value="project">By project</option><option value="none">None</option></select></label>
            <label className={controlClass}>Project order<select className="cursor-pointer" value={state.sorting} onChange={(event) => { void (event.target.value === "name" ? visibility.sortProjectsByName() : visibility.selectManualOrder()); }}><option value="name">By name</option><option value="manual">Manual</option></select></label>
            <label className={controlClass}>Show search<Switch checked={state.showSearch} onCheckedChange={(checked) => { void visibility.setShowSearch(checked); }} /></label>
            <label className={controlClass}>Show personal threads<Switch checked={state.showPersonalThreads} onCheckedChange={(checked) => { void visibility.setShowPersonalThreads(checked); }} /></label>
          </fieldset>
        </div>, document.body)}
      </details>
    </header>
  );
}
