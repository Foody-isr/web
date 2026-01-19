"use client";

export default function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-6 text-center">
      <p className="text-xl font-semibold">Could not load menu</p>
      <p className="text-ink/60">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-3 rounded-xl bg-brand text-white font-semibold"
      >
        Retry
      </button>
    </div>
  );
}
