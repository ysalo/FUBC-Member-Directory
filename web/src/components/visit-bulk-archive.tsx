"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { archiveVisits } from "@/app/visitation/actions";
import { visitCopy } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";

type ArchiveItem = { id: string; revision: number; memberName: string };
type SelectionContext = {
  selected: Set<string>;
  toggle: (id: string) => void;
};

const ArchiveSelection = createContext<SelectionContext | null>(null);

export default function VisitBulkArchive({
  items,
  locale,
  children,
}: {
  items: ArchiveItem[];
  locale: Locale;
  children: ReactNode;
}) {
  const c = visitCopy(locale);
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const allSelected = items.length > 0 && selected.size === items.length;
  const context = useMemo<SelectionContext>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else if (itemById.has(id)) next.add(id);
          return next;
        }),
    }),
    [itemById, selected],
  );

  async function runArchive() {
    const chosen = [...selected]
      .map((id) => itemById.get(id))
      .filter((item): item is ArchiveItem => !!item);
    if (!chosen.length) return;
    if (
      !window.confirm(
        c.confirmArchiveSelected.replace("{count}", String(chosen.length)),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await archiveVisits(
        chosen.map(({ id, revision }) => ({ id, revision })),
      );
      if (result.error) setError(result.error);
      else {
        setSelected(new Set());
        window.dispatchEvent(new Event("visitation-updated"));
        router.refresh();
      }
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArchiveSelection.Provider value={context}>
      {!!items.length && (
        <div className="mb-5 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(items.map((item) => item.id)),
                )
              }
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--app-brand)] hover:bg-[var(--app-brand-soft)] disabled:opacity-50"
            >
              {allSelected ? c.clearSelection : c.selectAll}
            </button>
            <span
              className="mr-auto text-sm text-[var(--app-muted)]"
              aria-live="polite"
            >
              {selected.size} {c.selectedVisits}
            </span>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={runArchive}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--app-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"
            >
              <Archive aria-hidden="true" className="size-4" />
              {busy ? c.saving : c.archiveSelected}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">
              {error}
            </p>
          )}
        </div>
      )}
      {children}
    </ArchiveSelection.Provider>
  );
}

export function VisitArchiveCheckbox({
  id,
  memberName,
  locale,
}: {
  id: string;
  memberName: string;
  locale: Locale;
}) {
  const selection = useContext(ArchiveSelection);
  if (!selection) return null;
  return (
    <label className="absolute top-2 right-2 z-20 grid size-11 cursor-pointer place-items-center rounded-xl bg-[var(--app-surface)] shadow-sm">
      <span className="sr-only">
        {visitCopy(locale).selectVisit.replace("{name}", memberName)}
      </span>
      <input
        type="checkbox"
        checked={selection.selected.has(id)}
        onChange={() => selection.toggle(id)}
        className="size-5 accent-[var(--app-brand)]"
      />
    </label>
  );
}
