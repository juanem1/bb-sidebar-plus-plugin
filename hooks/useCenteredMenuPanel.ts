import { useEffect, useRef, type RefObject } from "react";

const VIEWPORT_MARGIN_PX: number = 8;
const TRIGGER_GAP_PX: number = 4;

/**
 * Positions a `<details>` dropdown panel with `position: fixed`, horizontally centered
 * under its `<summary>` trigger and clamped to the viewport so it is never clipped by
 * the narrow sidebar or the window edges. The panel must use the `fixed` class.
 */
export function useCenteredMenuPanel(menuRef: RefObject<HTMLDetailsElement | null>): RefObject<HTMLDivElement | null> {
  const panelRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const menuElement: HTMLDetailsElement | null = menuRef.current;
    const panelElement: HTMLDivElement | null = panelRef.current;
    if (menuElement === null || panelElement === null) return;
    const menu: HTMLDetailsElement = menuElement;
    const panel: HTMLDivElement = panelElement;
    const ownerWindow: Window | null = menu.ownerDocument.defaultView;
    if (ownerWindow === null) throw new Error("Dropdown menu is not attached to a window.");
    const view: Window = ownerWindow;

    function positionPanel(): void {
      if (!menu.open) {
        panel.style.visibility = "hidden";
        return;
      }
      const trigger: HTMLElement | null = menu.querySelector(":scope > summary");
      if (trigger === null) throw new Error("Dropdown menu requires a direct <summary> trigger.");
      const triggerRect: DOMRect = trigger.getBoundingClientRect();
      const panelWidth: number = panel.offsetWidth;
      const viewportWidth: number = menu.ownerDocument.documentElement.clientWidth;
      const centeredLeft: number = triggerRect.left + triggerRect.width / 2 - panelWidth / 2;
      const maxLeft: number = Math.max(VIEWPORT_MARGIN_PX, viewportWidth - panelWidth - VIEWPORT_MARGIN_PX);
      const left: number = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN_PX), maxLeft);
      panel.style.left = `${left}px`;
      panel.style.top = `${triggerRect.bottom + TRIGGER_GAP_PX}px`;
      panel.style.visibility = "visible";
    }

    panel.style.visibility = "hidden";
    menu.addEventListener("toggle", positionPanel);
    view.addEventListener("resize", positionPanel);
    view.addEventListener("scroll", positionPanel, true);
    return () => {
      menu.removeEventListener("toggle", positionPanel);
      view.removeEventListener("resize", positionPanel);
      view.removeEventListener("scroll", positionPanel, true);
    };
  }, [menuRef]);

  return panelRef;
}
