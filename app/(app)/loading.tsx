export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
