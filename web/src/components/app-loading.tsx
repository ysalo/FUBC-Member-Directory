import { getLocale } from "@/lib/locale";
type Layout =
  | "directory"
  | "visits"
  | "visit-detail"
  | "visit-form"
  | "visit-edit"
  | "groups"
  | "group-detail"
  | "member"
  | "login"
  | "management";
function Bar({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block rounded-full bg-[var(--app-surface-muted)] ${className}`}
    />
  );
}
function SearchRow() {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-[var(--app-line)] px-1">
      <Bar className="size-5 shrink-0" />
      <Bar className="h-4 w-1/2" />
    </div>
  );
}
function Content({ layout }: { layout: Layout }) {
  if (layout === "login")
    return (
      <div className="mx-auto max-w-md space-y-6 rounded-[2rem] border border-[var(--app-line)] p-7">
        <Bar className="size-14 rounded-2xl" />
        <Bar className="h-8 w-2/3" />
        <Bar className="h-4" />
        <Bar className="h-12 rounded-xl" />
        <Bar className="h-12 rounded-xl" />
        <Bar className="h-4 w-4/5" />
      </div>
    );
  if (layout === "member")
    return (
      <>
        <div className="relative h-[62dvh] min-h-[360px] max-h-[600px] bg-[var(--app-surface-muted)]">
          <div className="safe-top px-4">
            <Bar className="size-11 bg-[var(--app-line)]" />
          </div>
          <Bar className="absolute bottom-6 left-5 h-8 w-2/3 bg-[var(--app-line)]" />
        </div>
        <div className="space-y-6 p-5">
          {[0, 1, 2].map((row) => (
            <Bar key={row} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </>
    );
  if (layout === "group-detail")
    return (
      <div className="safe-top space-y-5 px-4">
        <Bar className="size-11" />
        <Bar className="h-7 w-2/3" />
        <div className="space-y-4 rounded-2xl border border-[var(--app-line)] p-4">
          <Bar className="h-5 w-2/3" />
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Bar className="size-10" />
              <Bar className="h-5 w-2/3" />
            </div>
          ))}
        </div>
        <SearchRow />
        {[0, 1, 2].map((row) => (
          <Bar key={row} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  if (layout === "directory")
    return (
      <>
        <div className="safe-top px-4 pb-1" />
        <div className="px-4">
          <SearchRow />
        </div>
        {[0, 1].map((section) => (
          <section key={section}>
            <div className="border-y border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-1.5">
              <span className="block h-5 w-3 rounded bg-[var(--app-line)]" />
            </div>
            <div className="divide-y divide-[var(--app-line)] pl-4">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex min-h-[68px] items-center gap-3 py-2.5 pr-2"
                >
                  <Bar className="size-12 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Bar className={`h-4 ${row % 2 ? "w-2/3" : "w-3/4"}`} />
                    <Bar className="h-3 w-1/3" />
                  </div>
                  <Bar className="mr-2 h-4 w-2" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </>
    );
  if (layout === "visit-form" || layout === "visit-edit")
    return (
      <>
        <Bar className="mb-4 size-11" />
        <Bar className="mb-6 h-8 w-2/3" />
        <div className="space-y-5">
          {[0, 1].map((field) => (
            <div key={field}>
              <Bar className="mb-2 h-5 w-1/3" />
              <Bar className="h-12 rounded-xl" />
            </div>
          ))}
          {layout === "visit-edit" && (
            <>
              <div>
                <Bar className="mb-2 h-5 w-1/3" />
                <Bar className="h-12 rounded-xl" />
              </div>
              <div>
                <Bar className="mb-2 h-5 w-1/3" />
                <Bar className="h-28 rounded-xl" />
              </div>
            </>
          )}
          <Bar className="h-12 rounded-xl" />
        </div>
      </>
    );
  if (layout === "visit-detail")
    return (
      <>
        <Bar className="mb-4 size-11" />
        <Bar className="mb-2 h-4 w-1/2" />
        <div className="mb-3 flex items-center gap-3">
          <Bar className="size-10 shrink-0" />
          <Bar className="h-8 w-3/4" />
        </div>
        <Bar className="mb-5 h-6 w-16" />
        <div className="mb-5 divide-y divide-[var(--app-line)] rounded-2xl border border-[var(--app-line)]">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-3 p-4">
              <Bar className="size-5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3 w-1/3" />
                <Bar className="h-5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
        <div className="mb-5 rounded-2xl border border-[var(--app-line)] p-4">
          <Bar className="mb-3 h-4 w-1/3" />
          <Bar className="h-4 w-3/4" />
        </div>
        <Bar className="mb-3 h-5 w-1/4" />
        <div className="divide-y divide-[var(--app-line)] rounded-2xl border border-[var(--app-line)]">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-3 p-4"
            >
              <Bar className="h-4 w-1/2" />
              <Bar className="h-6 w-20" />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-[var(--app-line)] pt-5">
          <Bar className="mb-5 h-5 w-1/3" />
          <Bar className="h-12 rounded-xl" />
        </div>
      </>
    );
  return (
    <>
      <div className="flex items-center justify-between gap-3 py-5">
        <Bar className="h-8 w-1/2" />
        <Bar className="h-11 w-24 rounded-xl" />
      </div>
      <div className="mb-6">
        <SearchRow />
      </div>
      <Bar className="mb-3 h-6 w-1/2" />
      {layout === "visits" ? (
        <div className="space-y-3">
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 pr-9"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-full bg-[var(--app-line)]" />
                <span className="h-6 w-2/3 rounded-full bg-[var(--app-line)]" />
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="size-4 rounded bg-[var(--app-line)]" />
                <span className="h-4 w-3/4 rounded-full bg-[var(--app-line)]" />
              </div>
              <span className="block h-3 w-4/5 rounded-full bg-[var(--app-line)]" />
              <span className="mt-2 block h-3 w-1/3 rounded-full bg-[var(--app-line)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[var(--app-line)] rounded-2xl border border-[var(--app-line)]">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-20 items-center gap-3 p-5">
              {layout === "groups" && <Bar className="size-5 shrink-0" />}
              <div className="flex-1 space-y-2">
                <Bar className="h-5 w-2/3" />
                <Bar className="h-4 w-4/5" />
                {layout === "management" && (
                  <Bar className="mt-4 h-11 rounded-xl" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
export default async function AppLoading({
  inset = false,
  layout = "directory",
}: {
  inset?: boolean;
  layout?: Layout;
}) {
  const locale = await getLocale();
  const body = (
    <div
      role="status"
      aria-busy="true"
      className={
        inset
          ? ""
          : `${layout === "login" ? "w-full max-w-md" : "min-h-dvh"} bg-[var(--app-surface)] text-[var(--app-ink)]`
      }
    >
      <span className="sr-only">
        {locale === "uk" ? "Завантаження…" : "Loading…"}
      </span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <Content layout={layout} />
      </div>
    </div>
  );
  if (["directory", "member", "group-detail"].includes(layout) && !inset)
    return (
      <div className="fixed inset-0 h-dvh overflow-hidden bg-[var(--app-bg)] sm:p-6">
        <div className="native-shadow mx-auto h-full max-w-xl overflow-hidden bg-[var(--app-surface)] sm:rounded-[2rem]">
          {body}
        </div>
      </div>
    );
  if (layout === "login")
    return (
      <div className="safe-page grid min-h-dvh place-items-center p-5">
        {body}
      </div>
    );
  return inset ? (
    body
  ) : (
    <div className="safe-top mx-auto max-w-xl bg-[var(--app-surface)] px-5 pb-24">
      {body}
    </div>
  );
}
