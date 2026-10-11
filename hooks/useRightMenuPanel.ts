import { useEffect, type RefObject } from "react";

const VIEWPORT_MARGIN_PX: number = 8;
const TRIGGER_GAP_PX: number = 8;

/**
 * Positions a `<details>` dropdown panel with `position: fixed`, to the right of
 * its row anchor and clamped to the viewport. The panel must use the
 * `fixed` class and be portaled to `document.body`: the host sidebar clips fixed
 * descendants, so a panel rendered inside it gets cut at the sidebar edge.
 * Opening the menu from the focused trigger (keyboard or click) moves focus into the panel,
 * since the portal takes it out of the tab order; hover opening leaves focus alone.
 */
export function useRightMenuPanel(menuRef: RefObject<HTMLDetailsElement | null>, panelRef: RefObject<HTMLDivElement | null>, anchorRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const menuElement: HTMLDetailsElement | null = menuRef.current;
    const panelElement: HTMLDivElement | null = panelRef.current;
    const anchorElement: HTMLElement | null = anchorRef.current;
    if (menuElement === null || panelElement === null || anchorElement === null) return;
    const menu: HTMLDetailsElement = menuElement;
    const panel: HTMLDivElement = panelElement;
    const anchor: HTMLElement = anchorElement;
    const ownerWindow: Window | null = menu.ownerDocument.defaultView;
    if (ownerWindow === null) throw new Error("Dropdown menu is not attached to a window.");
    const view: Window = ownerWindow;
    const triggerElement: HTMLElement | null = menu.querySelector(":scope > summary");
    if (triggerElement === null) throw new Error("Dropdown menu requires a direct <summary> trigger.");
    const trigger: HTMLElement = triggerElement;

    function positionPanel(): void {
      if (!menu.open) {
        panel.style.visibility = "hidden";
        return;
      }
      const anchorRect: DOMRect = anchor.getBoundingClientRect();
      const panelWidth: number = panel.offsetWidth;
      const viewportWidth: number = menu.ownerDocument.documentElement.clientWidth;
      const viewportHeight: number = menu.ownerDocument.documentElement.clientHeight;
      const desiredLeft: number = anchorRect.right + TRIGGER_GAP_PX;
      const maxLeft: number = Math.max(VIEWPORT_MARGIN_PX, viewportWidth - panelWidth - VIEWPORT_MARGIN_PX);
      const left: number = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN_PX), maxLeft);
      const top: number = Math.max(VIEWPORT_MARGIN_PX, Math.min(anchorRect.top, viewportHeight - panel.offsetHeight - VIEWPORT_MARGIN_PX));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = "visible";
    }

    function handleToggle(): void {
      positionPanel();
      if (!menu.open || menu.ownerDocument.activeElement !== trigger) return;
      const firstControl: HTMLElement | null = panel.querySelector("button:not(:disabled), select:not(:disabled), input:not(:disabled)");
      firstControl?.focus();
    }

    panel.style.visibility = "hidden";
    menu.addEventListener("toggle", handleToggle);
    view.addEventListener("resize", positionPanel);
    view.addEventListener("scroll", positionPanel, true);
    return () => {
      menu.removeEventListener("toggle", handleToggle);
      view.removeEventListener("resize", positionPanel);
      view.removeEventListener("scroll", positionPanel, true);
    };
  }, [menuRef, panelRef, anchorRef]);
}
