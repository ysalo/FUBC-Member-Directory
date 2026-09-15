"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateVisit } from "@/app/visitation/actions";
import { visitCopy, type Visit } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";
import Link from "@/components/navigation-link";
import { Check, X, Pencil, CheckCircle2, RefreshCw } from "lucide-react";
export default function VisitControls({
  visit,
  userId,
  locale,
  canComplete,
}: {
  visit: Visit;
  userId: string;
  locale: Locale;
  canComplete: boolean;
}) {
  const c = visitCopy(locale),
    router = useRouter(),
    recipient = visit.visit_recipients.find((r) => r.deacon_id === userId);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(recipient?.decline_reason || "");
  useEffect(() => {
    if (!recipient || recipient.last_viewed_revision >= visit.revision) return;
    const f = new FormData();
    f.set("id", visit.id);
    f.set("revision", String(visit.revision));
    void mutateVisit("view", f)
      .then((r) => {
        if (r.error) setError(r.error);
      })
      .catch(() => setError(c.failed));
  }, [visit.id, visit.revision, recipient, c.failed]);
  async function run(op: "respond" | "close", decision: string) {
    if (decision === "cancelled" && !window.confirm(c.confirmCancel)) return;
    setBusy(true);
    setError("");
    const f = new FormData();
    f.set("id", visit.id);
    f.set("revision", String(visit.revision));
    f.set("decision", decision);
    f.set("reason", reason);
    try {
      const r = await mutateVisit(op, f);
      if (r.error) setError(r.error);
      else {
        if (decision === "accepted") setReason("");
        window.dispatchEvent(new Event("visitation-updated"));
        router.refresh();
      }
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }
  if (visit.status !== "open") return null;
  const button =
    "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="mt-6 space-y-5 border-t border-[var(--app-line)] pt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {recipient ? c.yourResponse : c.manageVisit}
        </h2>
        <button
          title={c.refresh}
          aria-label={c.refresh}
          disabled={busy}
          className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
          onClick={() => {
            window.dispatchEvent(new Event("visitation-updated"));
            router.refresh();
          }}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
        </button>
      </div>
      {recipient && (
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={recipient.response === "accepted"}
              className={`${button} bg-[var(--app-brand)] text-white ${recipient.response === "accepted" ? "ring-2 ring-[var(--app-brand)] ring-offset-2 ring-offset-[var(--app-surface)]" : ""}`}
              onClick={() => run("respond", "accepted")}
            >
              <Check aria-hidden="true" className="size-4 shrink-0" />
              {c.accept}
            </button>
            <button
              type="button"
              aria-pressed={recipient.response === "declined"}
              className={`${button} border border-[var(--app-line)] ${recipient.response === "declined" ? "bg-red-50 text-red-700" : "text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)]"}`}
              onClick={() => run("respond", "declined")}
            >
              <X aria-hidden="true" className="size-4 shrink-0" />
              {c.decline}
            </button>
          </div>
          <details open={recipient.response === "declined"} className="text-sm">
            <summary className="cursor-pointer py-2 text-[var(--app-muted)]">
              {c.reason}
            </summary>
            <label className="block">
              <span className="sr-only">{c.reason}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                className="mt-2 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-surface)] p-3"
              />
            </label>
          </details>
        </fieldset>
      )}
      {visit.pastor_id === userId && (
        <section className="space-y-3">
          {recipient && (
            <h2 className="text-sm font-semibold">{c.manageVisit}</h2>
          )}
          <Link
            href={`/visitation/${visit.id}/edit`}
            className={`${button} bg-[var(--app-brand)] text-white`}
          >
            <Pencil aria-hidden="true" className="size-4" />
            {c.edit}
          </Link>
          <button
            disabled={busy || !canComplete}
            aria-describedby={!canComplete ? "visit-complete-hint" : undefined}
            className={`${button} w-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-ink)]`}
            onClick={() => run("close", "completed")}
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {c.complete}
          </button>
          {!canComplete && (
            <p
              id="visit-complete-hint"
              className="text-center text-xs leading-relaxed text-[var(--app-muted)]"
            >
              {c.completeHint}
            </p>
          )}
          <button
            disabled={busy}
            className={`${button} w-full text-[var(--app-danger)] hover:bg-red-50`}
            onClick={() => run("close", "cancelled")}
          >
            {c.cancel}
          </button>
        </section>
      )}
      {busy && <p role="status">{c.saving}</p>}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
