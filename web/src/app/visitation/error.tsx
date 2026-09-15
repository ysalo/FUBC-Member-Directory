"use client";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <div className="py-6">
      <p role="alert">
        Unable to load visitation. / Не вдалося завантажити відвідування.
      </p>
      <button className="mt-4 min-h-12 rounded-xl border p-3" onClick={reset}>
        Try again / Спробувати знову
      </button>
    </div>
  );
}
