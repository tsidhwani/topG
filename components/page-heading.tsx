export function PageHeading({
  title,
  tagline,
  action,
}: {
  title: string;
  tagline?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up flex items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-3xl text-primary [text-shadow:0_0_18px_color-mix(in_oklch,var(--primary)_35%,transparent)]">
          {title}
        </h1>
        {tagline && (
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {tagline}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
