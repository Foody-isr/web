export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand/20 animate-pulse" />
        <div className="h-6 w-40 mx-auto bg-[var(--surface-subtle)] rounded animate-pulse" />
        <div className="h-4 w-56 mx-auto bg-[var(--surface-subtle)] rounded animate-pulse" />
      </div>
    </div>
  );
}
