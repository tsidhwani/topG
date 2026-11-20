"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface SlipSelection {
  id: string;
  label: string;
  americanOdds: number;
  line: number | null;
  marketTitle: string;
}

interface BetSlipContextValue {
  selections: SlipSelection[];
  isSelected: (id: string) => boolean;
  toggleSelection: (selection: SlipSelection) => void;
  removeSelection: (id: string) => void;
  clear: () => void;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = useState<SlipSelection[]>([]);

  const value = useMemo<BetSlipContextValue>(
    () => ({
      selections,
      isSelected: (id) => selections.some((s) => s.id === id),
      toggleSelection: (selection) =>
        setSelections((prev) =>
          prev.some((s) => s.id === selection.id)
            ? prev.filter((s) => s.id !== selection.id)
            : [...prev, selection],
        ),
      removeSelection: (id) =>
        setSelections((prev) => prev.filter((s) => s.id !== id)),
      clear: () => setSelections([]),
    }),
    [selections],
  );

  return (
    <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) {
    throw new Error("useBetSlip must be used within a BetSlipProvider");
  }
  return ctx;
}
