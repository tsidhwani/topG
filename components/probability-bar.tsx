"use client";

import { useEffect, useState } from "react";

// Starts at 50/50 and transitions to the real split right after mount, so
// the fill actually animates in instead of just appearing at its final
// width (a CSS transition only fires on a style change, not on first paint).
export function ProbabilityBar({ homeProbability }: { homeProbability: number }) {
  const [pct, setPct] = useState(50);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(Math.round(homeProbability * 100)));
    return () => cancelAnimationFrame(id);
  }, [homeProbability]);

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="bg-primary transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className="bg-muted-foreground/30 transition-[width] duration-700 ease-out"
        style={{ width: `${100 - pct}%` }}
      />
    </div>
  );
}
