import { useEffect, type RefObject } from "react";

const OPEN_DELAY_MS: number = 100;
const CLOSE_DELAY_MS: number = 150;

/**
 * Opens a `<details>` menu while the pointer is over its `<summary>` or its portaled panel.
 * Pointer clicks no longer toggle the menu; keyboard activation (click with `detail === 0`) still does.
 * The menu stays open while focus is inside the panel so native `<select>` popups, which take the
 * pointer outside the panel, remain usable; an outside click still dismisses it.
 */
export function useHoverMenu(menuRef: RefObject<HTMLDetailsElement | null>, panelRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const menuElement: HTMLDetailsElement | null = menuRef.current;
    const panelElement: HTMLDivElement | null = panelRef.current;
    if (menuElement === null || panelElement === null) return;
    const menu: HTMLDetailsElement = menuElement;
    const panel: HTMLDivElement = panelElement;
    const trigger: HTMLElement | null = menu.querySelector(":scope > summary");
    if (trigger === null) throw new Error("Hover menu requires a direct <summary> trigger.");
    let timer: number | null = null;

    function clearTimer(): void {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleOpen(): void {
      clearTimer();
      timer = window.setTimeout(() => { menu.open = true; }, OPEN_DELAY_MS);
    }

    function scheduleClose(): void {
      clearTimer();
      timer = window.setTimeout(() => {
        if (!panel.matches(":focus-within")) menu.open = false;
      }, CLOSE_DELAY_MS);
    }

    function preventPointerToggle(event: MouseEvent): void {
      if (event.detail !== 0) event.preventDefault();
    }

    trigger.addEventListener("pointerenter", scheduleOpen);
    trigger.addEventListener("pointerleave", scheduleClose);
    trigger.addEventListener("click", preventPointerToggle);
    panel.addEventListener("pointerenter", clearTimer);
    panel.addEventListener("pointerleave", scheduleClose);
    return () => {
      clearTimer();
      trigger.removeEventListener("pointerenter", scheduleOpen);
      trigger.removeEventListener("pointerleave", scheduleClose);
      trigger.removeEventListener("click", preventPointerToggle);
      panel.removeEventListener("pointerenter", clearTimer);
      panel.removeEventListener("pointerleave", scheduleClose);
    };
  }, [menuRef, panelRef]);
}
