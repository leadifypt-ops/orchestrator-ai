import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordGuestMergeRecoveryPreview } from "./actions";
import { executeGuestMergeRecovery } from "./execute-actions";
import RecoveryConfirmationForm from "./recovery-confirmation-form";
import RecoveryExecutionForm from "./recovery-execution-form";
import ReconciliationReviewForm from "./reconciliation-review-form";
import { recordGuestMergeReconciliationReview } from "./reconciliation-actions";

type MergeAuditRow = {
  id: string;
  created_at: string;
  changed_by: string | null;
  source_identity_id: string | null;
  target_identity_id: string | null;
  reservations_reassigned: number | null;
  profiles_reassigned: number | null;
  conflicts: Record<string, unknown> | null;
  decision: Record<string, unknown> | null;
  previous_values: { source?: { full_name?: string | null }; target?: { full_name?: string | null } } | null;
};

type AliasRow = { id: string; contact_type: string; contact_value: string; created_at: string };
type ProvenanceRow = { id: string; record_table: string; provenance_type: string };
type RecoveryEventRow = { id: string; created_at: string };
type ExecutionEventRow = { id: string; recovered_record_count: number; skipped_record_count: number; execution_summary: { recovered?: { reservations?: number; reservation_guests?: number } }; created_at: string };
type ChecklistItem = { key: string; status: "completed" | "warning" | "not_applicable"; description: string; recommended_action: string; count?: number };
type ReconciliationReviewRow = { id: string; review_status: "pending" | "completed" | "requires_follow_up"; checklist_summary: ChecklistItem[]; reviewed_by: string | null; reviewed_at: string; notes: string | null };

export const dynamic = "force-dynamic";

export default async function RecoveryPreviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: auditData } = await supabase
    .from("guest_crm_audit_events")
    .select("id, created_at, changed_by, source_identity_id, target_identity_id, reservations_reassigned, profiles_reassigned, conflicts, decision, previous_values")
    .eq("id", id)
    .eq("change_type", "merge")
    .maybeSingle();
  const audit = auditData as MergeAuditRow | null;
  if (!audit || !audit.source_identity_id || !audit.target_identity_id) notFound();

  const { data: aliasData = [] } = await supabase
    .from("guest_contact_aliases")
    .select("id, contact_type, contact_value, created_at")
    .eq("source_guest_identity_id", audit.source_identity_id)
    .order("created_at", { ascending: true });
  const aliases = aliasData as AliasRow[];
  const { data: provenanceData = [] } = await supabase
    .from("guest_merge_provenance_records")
    .select("id, record_table, provenance_type")
    .eq("merge_audit_event_id", audit.id)
    .order("record_table", { ascending: true });
  const provenance = provenanceData as ProvenanceRow[];
  const provenanceBreakdown = provenance.reduce<Record<string, number>>(
    (counts, record) => {
      const key = `${record.record_table} · ${record.provenance_type}`;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    },
    {}
  );
  const { data: recoveryData = [] } = await supabase
    .from("guest_merge_recovery_events")
    .select("id, created_at")
    .eq("merge_audit_event_id", audit.id)
    .eq("status", "preview_confirmed")
    .order("created_at", { ascending: false })
    .limit(1);
  const recoveryEvent = (recoveryData as RecoveryEventRow[])[0] || null;
  const { data: executionData = [] } = recoveryEvent
    ? await supabase
        .from("guest_merge_recovery_execution_events")
        .select("id, recovered_record_count, skipped_record_count, execution_summary, created_at")
        .eq("recovery_event_id", recoveryEvent.id)
        .limit(1)
    : { data: [] };
  const execution = (executionData as ExecutionEventRow[])[0] || null;
  const previewAction = recordGuestMergeRecoveryPreview.bind(null, audit.id);
  const executionAction = recoveryEvent
    ? executeGuestMergeRecovery.bind(null, recoveryEvent.id)
    : null;
  const { data: reconciliationData = [] } = execution
    ? await supabase
        .from("guest_merge_reconciliation_reviews")
        .select("id, review_status, checklist_summary, reviewed_by, reviewed_at, notes")
        .eq("recovery_execution_event_id", execution.id)
        .order("reviewed_at", { ascending: false })
    : { data: [] };
  const reconciliationReviews = reconciliationData as ReconciliationReviewRow[];
  const latestReview = reconciliationReviews[0] || null;
  const reconciliationAction = execution
    ? recordGuestMergeReconciliationReview.bind(null, execution.id)
    : null;
  const source = audit.previous_values?.source?.full_name || "Source identity";
  const target = audit.previous_values?.target?.full_name || "Target identity";

  return <div className="space-y-6 p-6 text-white">
    <Link href={`/${locale}/business/guests/data-quality/audit`} className="inline-flex text-sm text-zinc-500 hover:text-white">Back to merge audit history</Link>
    <header className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6"><p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Governed manual recovery</p><h1 className="mt-2 text-3xl font-semibold">Recovery preview</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">This is not an automatic undo. It records a reviewed recovery decision without changing identities, reservations, guest profiles, aliases, or the original merge audit.</p></header>
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><h2 className="text-xl font-semibold">Original merge</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-zinc-600">Source</p><p className="mt-1">{source}</p></div><div><p className="text-xs text-zinc-600">Current target</p><p className="mt-1">{target}</p></div><div><p className="text-xs text-zinc-600">Merged</p><p className="mt-1">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(audit.created_at))}</p></div><div><p className="text-xs text-zinc-600">Merge actor</p><p className="mt-1 break-all">{audit.changed_by || "Not retained"}</p></div></div></section>
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><h2 className="text-xl font-semibold">Traceable impact</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-black/30 p-4"><p className="text-sm text-zinc-500">Reservations reassigned</p><p className="mt-1 text-2xl font-semibold">{audit.reservations_reassigned || 0}</p></div><div className="rounded-xl bg-black/30 p-4"><p className="text-sm text-zinc-500">Guest profiles reassigned</p><p className="mt-1 text-2xl font-semibold">{audit.profiles_reassigned || 0}</p></div><div className="rounded-xl bg-black/30 p-4"><p className="text-sm text-zinc-500">Traceable provenance records</p><p className="mt-1 text-2xl font-semibold">{provenance.length}</p></div></div>{provenance.length ? <div className="mt-4"><p className="text-sm font-medium text-emerald-300">Per-record provenance is available for this merge.</p><ul className="mt-3 space-y-2 text-sm text-zinc-400">{Object.entries(provenanceBreakdown).map(([label, count]) => <li key={label} className="flex justify-between rounded-xl bg-black/30 p-3"><span>{label}</span><span>{count}</span></li>)}</ul></div> : <p className="mt-4 text-sm leading-6 text-amber-200/80">This is an older merge without immutable per-record provenance. Do not infer which reservations or guest profiles belonged to the source.</p>}<p className="mt-4 text-sm leading-6 text-zinc-500">Recovery execution is available only for the provenance-backed reservation records listed here and only after a confirmed recovery preview.</p></section>
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><h2 className="text-xl font-semibold">Preserved contacts</h2>{aliases.length ? <ul className="mt-4 space-y-2 text-sm text-zinc-300">{aliases.map((alias) => <li key={alias.id} className="rounded-xl bg-black/30 p-3">{alias.contact_type}: {alias.contact_value}</li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">No preserved aliases are traceable for this merge.</p>}</section>
    <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5"><h2 className="text-xl font-semibold">Risks and limitations</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300"><li>Destination values won during the original merge and are not automatically restored.</li><li>Execution moves only provenance-backed reservations and reservation guests; it never reactivates the source identity.</li><li>Aliases remain in place to protect duplicate prevention and preserve historical context.</li><li>Any future recovery execution needs separate traceability, explicit confirmation, and a new immutable audit record.</li></ul></section>
    {execution ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"><h2 className="text-xl font-semibold">Execution summary</h2><p className="mt-2 text-sm text-emerald-300">Recovery execution is complete and immutable.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-black/30 p-4"><p className="text-sm text-zinc-500">Recovered records</p><p className="mt-1 text-2xl font-semibold">{execution.recovered_record_count}</p><p className="mt-2 text-xs text-zinc-500">{execution.execution_summary.recovered?.reservations || 0} reservations · {execution.execution_summary.recovered?.reservation_guests || 0} reservation guests</p></div><div className="rounded-xl bg-black/30 p-4"><p className="text-sm text-zinc-500">Skipped records</p><p className="mt-1 text-2xl font-semibold">{execution.skipped_record_count}</p><p className="mt-2 text-xs text-zinc-500">Unsupported provenance remained unchanged.</p></div></div></section> : recoveryEvent ? provenance.length && executionAction ? <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5"><h2 className="text-xl font-semibold">Execute Recovery</h2><p className="mt-2 text-sm leading-6 text-zinc-400">This executes a single transactional reassignment for provenance-backed reservations and reservation guests. Profiles remain attached, aliases remain preserved, and historical audits remain unchanged.</p><RecoveryExecutionForm action={executionAction} /></section> : <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5"><h2 className="text-xl font-semibold">Execution unavailable</h2><p className="mt-2 text-sm text-amber-200/80">This merge has no immutable provenance-backed records and cannot be recovered by V1.</p></section> : <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5"><h2 className="text-xl font-semibold">Record governed recovery review</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Confirmation creates an immutable recovery-review event with this preview snapshot. It makes no operational data changes.</p><RecoveryConfirmationForm action={previewAction} /></section>}
    {execution && reconciliationAction ? <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-[0.15em] text-zinc-600">Post-recovery review</p><h2 className="mt-1 text-xl font-semibold">Reconciliation checklist</h2></div><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{latestReview?.review_status === "requires_follow_up" ? "Requires Follow-up" : latestReview?.review_status === "completed" ? "Completed" : "Pending"}</span></div>{latestReview ? <><ul className="mt-5 space-y-3">{latestReview.checklist_summary.map((item) => <li key={item.key} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex gap-3"><span className={item.status === "completed" ? "text-emerald-300" : item.status === "warning" ? "text-amber-300" : "text-zinc-500"}>{item.status === "completed" ? "✓" : item.status === "warning" ? "⚠" : "—"}</span><div><p className="text-sm font-medium text-zinc-200">{item.description}{typeof item.count === "number" ? ` (${item.count})` : ""}</p><p className="mt-1 text-sm leading-6 text-zinc-500">{item.recommended_action}</p></div></div></li>)}</ul>{latestReview.notes ? <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm text-zinc-400">Latest notes: {latestReview.notes}</p> : null}</> : <p className="mt-4 text-sm text-amber-200/80">No automatic pending review exists for this earlier execution. Recording a status will create the first immutable checklist event.</p>}<ReconciliationReviewForm action={reconciliationAction} /></section> : null}
  </div>;
}
