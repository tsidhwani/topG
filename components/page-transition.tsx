"use client";

import { usePathname } from "next/navigation";

// Keying by pathname forces a remount on every navigation, which retriggers
// the fade-up animation — the simplest way to get a real per-page transition
// without an animation library or the experimental View Transitions API.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-up flex flex-1 flex-col">
      {children}
    </div>
  );
}
