import { useEffect, useRef, type RefObject } from "react";

export function useDismissibleMenu(): RefObject<HTMLDetailsElement | null> {
  const menuRef: RefObject<HTMLDetailsElement | null> = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const element: HTMLDetailsElement | null = menuRef.current;
    if (element === null) return;
    const menu: HTMLDetailsElement = element;
    const ownerDocument: Document = menu.ownerDocument;

    function dismissOutside(event: PointerEvent): void {
      if (menu.open && !event.composedPath().includes(menu)) {
        menu.open = false;
      }
    }

    ownerDocument.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", dismissOutside, true);
    };
  }, []);

  return menuRef;
}
