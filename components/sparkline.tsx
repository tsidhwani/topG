// Minimal SVG sparkline for a plain series of positive values (team
// scoring trends). No axes, no library — just a line.
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;

  const width = 120;
  const height = 32;
  const padding = 3;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = values.map((value, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "h-8 w-28"}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        className="draw-in stroke-primary"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
