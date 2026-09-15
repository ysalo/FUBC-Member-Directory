"use client";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <div className="my-6 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
      <p role="alert" className="text-sm text-[var(--app-muted)]">
        Unable to load visitation. / Не вдалося завантажити відвідування.
      </p>
      <button
        className="mt-4 min-h-12 w-full rounded-xl bg-[var(--app-brand)] px-4 py-3 text-sm font-semibold text-white"
        onClick={reset}
      >
        Try again / Спробувати знову
      </button>
    </div>
  );
}
