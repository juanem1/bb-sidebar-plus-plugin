import type { ReactElement } from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** Accessible on/off toggle that mirrors the BB settings switch styling. */
export function Switch({ checked, onCheckedChange }: SwitchProps): ReactElement {
  return (
    <button
      aria-checked={checked}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-foreground" : "bg-input"}`}
      onClick={() => { onCheckedChange(!checked); }}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className={`pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform ${checked ? "translate-x-[1.125rem]" : "translate-x-0.5"}`} />
    </button>
  );
}
