import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes a `<details>` menu on a pointerdown outside both the menu and its portaled panel.
 */
export function useDismissibleMenu(panelRef: RefObject<HTMLDivElement | null>): RefObject<HTMLDetailsElement | null> {
  const menuRef: RefObject<HTMLDetailsElement | null> = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const element: HTMLDetailsElement | null = menuRef.current;
    if (element === null) return;
    const menu: HTMLDetailsElement = element;
    const ownerDocument: Document = menu.ownerDocument;

    function dismissOutside(event: PointerEvent): void {
      if (!menu.open) return;
      const path: EventTarget[] = event.composedPath();
      const panel: HTMLDivElement | null = panelRef.current;
      if (path.includes(menu) || (panel !== null && path.includes(panel))) return;
      menu.open = false;
    }

    ownerDocument.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", dismissOutside, true);
    };
  }, [panelRef]);

  return menuRef;
}
