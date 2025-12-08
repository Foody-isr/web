export function MenuSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full skeleton" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-4 w-1/2 skeleton" />
            <div className="h-3 w-3/4 skeleton" />
            <div className="h-24 w-full skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
