"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateVisit } from "@/app/visitation/actions";
import { visitCopy, type Visit } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";
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
      else router.refresh();
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }
  if (visit.status !== "open") return null;
  const button =
    "min-h-12 rounded-xl border border-[var(--app-line)] px-4 py-3 font-semibold disabled:opacity-50";
  return (
    <div className="space-y-3">
      {recipient && (
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">
            {c.reason}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              className="mt-2 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-surface)] p-3"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              aria-pressed={recipient.response === "accepted"}
              className={button}
              onClick={() => run("respond", "accepted")}
            >
              {c.accept}
            </button>
            <button
              aria-pressed={recipient.response === "declined"}
              className={button}
              onClick={() => run("respond", "declined")}
            >
              {c.decline}
            </button>
          </div>
        </fieldset>
      )}
      {visit.pastor_id === userId && (
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className={button}
            onClick={() => run("close", "cancelled")}
          >
            {c.cancel}
          </button>
          <button
            disabled={busy || !canComplete}
            className={button}
            onClick={() => run("close", "completed")}
          >
            {c.complete}
          </button>
        </div>
      )}
      {busy && <p role="status">{c.saving}</p>}
      {error && <p role="alert">{error}</p>}
      <button
        className={button}
        disabled={busy}
        onClick={() => router.refresh()}
      >
        {c.refresh}
      </button>
    </div>
  );
}
