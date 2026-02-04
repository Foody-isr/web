"use client";

export default function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-6 text-center">
      <p className="text-xl font-bold">Could not load menu</p>
      <p className="text-ink-muted">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-3 rounded-button bg-brand text-white font-bold hover:bg-brand-dark transition"
      >
        Retry
      </button>
    </div>
  );
}
