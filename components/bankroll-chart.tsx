import { cn } from "cn";

// A minimal hand-drawn SVG line chart — no charting library needed for
// one line. Plots cumulative net (in cents) across a user's settled bets,
// in placement order.
export function BankrollChart({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const width = 600;
  const height = 160;
  const padding = 8;

  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;

  const coords = points.map((value, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const zeroY = height - padding - ((0 - min) / range) * (height - padding * 2);
  const finalValue = points[points.length - 1];
  const positive = finalValue >= 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-32 w-full"
      preserveAspectRatio="none"
    >
      <line
        x1={padding}
        y1={zeroY}
        x2={width - padding}
        y2={zeroY}
        className="stroke-muted-foreground/30"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <path
        d={path}
        fill="none"
        className={cn("draw-in", positive ? "stroke-primary" : "stroke-destructive")}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: `drop-shadow(0 0 6px var(${positive ? "--primary" : "--destructive"}))`,
        }}
      />
    </svg>
  );
}
