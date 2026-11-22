import { cn } from "cn";

export interface InsightStat {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}

// Decorative + informational side margin, shown only on wide screens so the
// mobile-first board layout is untouched. Mixes pure brand flavor (the
// motto) with real ESPN-derived stats — the idea being every bit of empty
// space on a wide screen is an opportunity to remind people this is
// connected to the real league, not just a static betting board.
export function InsightRail({
  motto,
  stats,
  align = "left",
}: {
  motto: string;
  stats: InsightStat[];
  align?: "left" | "right";
}) {
  return (
    <aside
      className={cn(
        "hidden w-56 shrink-0 flex-col gap-4 pt-8 xl:flex",
        align === "right" ? "items-end text-right" : "items-start text-left",
      )}
    >
      <div
        className={cn(
          "animate-fade-up flex items-center gap-2.5",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span className="h-12 w-px bg-gradient-to-b from-primary/60 to-transparent" />
        <span className="font-heading text-[0.65rem] leading-tight tracking-[0.3em] text-primary/70 uppercase [writing-mode:vertical-rl]">
          {motto}
        </span>
      </div>

      {stats.map((s, i) => (
        <div
          key={s.label}
          className="neon-panel stagger-in w-full rounded-xl bg-card/70 p-3 transition-transform duration-300 hover:-translate-y-0.5"
          style={{ "--stagger": `${i * 120 + 200}ms` } as React.CSSProperties}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </div>
          <p className="font-heading text-sm leading-snug text-primary">{s.value}</p>
          {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
        </div>
      ))}
    </aside>
  );
}
