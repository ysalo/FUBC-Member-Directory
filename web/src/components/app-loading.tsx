import { getLocale } from "@/lib/locale";
import LoadingSpinner from "@/components/loading-spinner";

export default async function AppLoading({
  inset = false,
}: {
  inset?: boolean;
}) {
  const locale = await getLocale();
  return (
    <div
      role="status"
      aria-busy="true"
      className={
        inset
          ? "py-5"
          : "safe-top mx-auto min-h-dvh max-w-xl bg-[var(--app-surface)] px-5 pb-24 text-[var(--app-ink)]"
      }
    >
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--app-brand-soft)] text-sm font-bold text-[var(--app-brand)]">
          PD
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {locale === "uk" ? "Завантаження…" : "Loading…"}
          </p>
          <p className="text-sm text-[var(--app-muted)]">
            {locale === "uk" ? "Зачекайте, будь ласка" : "Please wait"}
          </p>
        </div>
        <LoadingSpinner />
      </div>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-11 rounded-xl bg-[var(--app-surface-muted)]" />
        <div className="divide-y divide-[var(--app-line)] overflow-hidden rounded-2xl border border-[var(--app-line)]">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <span className="size-12 shrink-0 rounded-full bg-[var(--app-surface-muted)]" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-2/3 rounded-full bg-[var(--app-surface-muted)]" />
                <div className="h-3 w-1/2 rounded-full bg-[var(--app-surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
