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
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-3xl text-primary">{title}</h1>
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
