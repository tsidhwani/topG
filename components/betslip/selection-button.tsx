"use client";

import { cn } from "cn";
import { useBetSlip, type SlipSelection } from "./bet-slip-context";

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function SelectionButton({ selection }: { selection: SlipSelection }) {
  const { isSelected, toggleSelection } = useBetSlip();
  const selected = isSelected(selection.id);

  return (
    <button
      type="button"
      onClick={() => toggleSelection(selection)}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:bg-muted",
      )}
    >
      <span>
        {selection.label}
        {selection.line != null ? ` (${selection.line})` : ""}
      </span>
      <span className="font-medium tabular-nums">
        {formatOdds(selection.americanOdds)}
      </span>
    </button>
  );
}
