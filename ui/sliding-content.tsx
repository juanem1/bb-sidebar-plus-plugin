import { useLayoutEffect, useRef, type ReactElement, type ReactNode } from "react";

interface SlidingContentProps {
  collapsed: boolean;
  contentId: string;
  children: ReactNode;
}

/** Animate content height while allowing menus to overflow after expansion. */
export function SlidingContent({ collapsed, contentId, children }: SlidingContentProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousCollapsed = useRef<boolean>(collapsed);

  useLayoutEffect(() => {
    const container: HTMLDivElement | null = containerRef.current;
    if (container === null) throw new Error("SlidingContent requires a mounted content container.");
    if (previousCollapsed.current === collapsed) {
      container.style.height = collapsed ? "0px" : "auto";
      container.style.overflow = collapsed ? "hidden" : "visible";
      return;
    }
    previousCollapsed.current = collapsed;
    const startHeight: number = container.getBoundingClientRect().height;
    const endHeight: number = collapsed ? 0 : container.scrollHeight;
    const reducedMotion: boolean = container.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    container.style.height = `${startHeight}px`;
    container.style.overflow = "hidden";
    const animation: Animation = container.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: reducedMotion ? 0 : 200, easing: "ease-in-out", fill: "forwards" },
    );
    animation.onfinish = (): void => {
      container.style.height = collapsed ? "0px" : "auto";
      container.style.overflow = collapsed ? "hidden" : "visible";
      animation.cancel();
    };
    return (): void => {
      container.style.height = `${container.getBoundingClientRect().height}px`;
      animation.cancel();
    };
  }, [collapsed]);

  return <div ref={containerRef} id={contentId} aria-hidden={collapsed} inert={collapsed}>{children}</div>;
}
