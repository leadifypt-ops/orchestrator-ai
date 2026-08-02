import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatReconciliationDate,
  reconciliationPriorityLabels,
  reconciliationStatusLabels,
  reconciliationTypeLabels,
  type ReconciliationAssignee,
  type ReconciliationQueueItem,
} from "@/lib/reconciliation";
import { ReconciliationControls } from "../reconciliation-forms";

type DetailPageProps = { params: Promise<{ locale: string; id: string }> };
type AuditRow = {
  id: string;
  change_type: string;
  previous_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
};

function auditLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function valueSummary(value: Record<string, unknown>) {
  const entries = Object.entries(value);
  if (!entries.length) return "—";
  return entries
    .map(([key, item]) => `${key}: ${item ?? "unassigned"}`)
    .join(" · ");
}

export const dynamic = "force-dynamic";

export default async function ReconciliationDetailPage({ params }: DetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reconciliation_queue_items")
    .select(`
      id, business_id, reconciliation_type, status, priority, restaurant_id,
      guest_identity_id, reservation_id, audit_event_id, merge_audit_event_id,
      recovery_event_id, recovery_execution_event_id, reconciliation_review_id,
      origin, assigned_to, created_by, created_at, updated_at,
      restaurant:restaurants!reconciliation_queue_items_restaurant_id_fkey(id, name),
      guest:guest_identities!reconciliation_queue_items_guest_identity_id_fkey(id, full_name, email, phone),
      reservation:reservations!reconciliation_queue_items_reservation_id_fkey(id, guest_name, requested_date),
      audit_event:guest_crm_audit_events!reconciliation_queue_items_audit_event_id_fkey(id, change_type, created_at),
      merge_event:guest_crm_audit_events!reconciliation_queue_items_merge_audit_event_id_fkey(id, change_type, created_at),
      recovery_event:guest_merge_recovery_events!reconciliation_queue_items_recovery_event_id_fkey(id, merge_audit_event_id, status, created_at)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const item = data as unknown as ReconciliationQueueItem;
  const [{ data: auditData = [] }, { data: assigneeData = [] }] = await Promise.all([
    supabase
      .from("reconciliation_queue_audit_events")
      .select("id, change_type, previous_value, new_value, changed_by, created_at")
      .eq("reconciliation_item_id", item.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("list_reconciliation_assignees_v1", {
      p_business_id: item.business_id,
    }),
  ]);
  const audits = (auditData || []) as AuditRow[];
  const assignees = (assigneeData || []) as ReconciliationAssignee[];
  const membersById = new Map(
    assignees.map((member) => [member.user_id, member.email || member.user_id])
  );

  const links = [
    item.guest_identity_id
      ? { label: "Guest", href: `/${locale}/business/guests/${item.guest_identity_id}` }
      : null,
    item.reservation_id
      ? { label: "Reservation", href: `/${locale}/business/reservations/${item.reservation_id}` }
      : null,
    item.audit_event_id
      ? { label: "Audit Event", href: `/${locale}/business/guests/data-quality/audit` }
      : null,
    item.merge_audit_event_id
      ? { label: "Merge", href: `/${locale}/business/guests/data-quality/audit/${item.merge_audit_event_id}/recovery` }
      : null,
    item.recovery_event?.merge_audit_event_id
      ? { label: "Recovery", href: `/${locale}/business/guests/data-quality/audit/${item.recovery_event.merge_audit_event_id}/recovery` }
      : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <div className="space-y-6 p-6 text-white">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <Link href={`/${locale}/business/reconciliation`} className="text-sm text-zinc-500 hover:text-white">
          ← Reconciliation queue
        </Link>
        <p className="mt-5 text-xs uppercase tracking-[0.2em] text-zinc-500">
          {reconciliationTypeLabels[item.reconciliation_type]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Operational reconciliation</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{item.origin}</p>
        {links.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link key={link.label} href={link.href} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Status", reconciliationStatusLabels[item.status]],
          ["Priority", reconciliationPriorityLabels[item.priority]],
          ["Restaurant", item.restaurant?.name || "Not linked"],
          ["Guest", item.guest?.full_name || item.reservation?.guest_name || "Not linked"],
          ["Assignee", item.assigned_to ? membersById.get(item.assigned_to) || item.assigned_to : "Unassigned"],
          ["Created", formatReconciliationDate(item.created_at)],
          ["Updated", formatReconciliationDate(item.updated_at)],
          ["Queue source", item.reconciliation_review_id ? "Post-recovery follow-up" : "Manual"],
          ["Item ID", item.id],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
            <p className="mt-2 break-all text-sm text-zinc-300">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold">Operational controls</h2>
        <p className="mt-1 mb-5 text-sm text-zinc-500">
          Every change is authenticated, Business-scoped, and appended to the audit history.
        </p>
        <ReconciliationControls
          itemId={item.id}
          status={item.status}
          priority={item.priority}
          assignedTo={item.assigned_to}
          assignees={assignees}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold">Audit history</h2>
        <div className="mt-4 space-y-3">
          {audits.map((audit) => (
            <article key={audit.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{auditLabel(audit.change_type)}</p>
                <p className="text-xs text-zinc-600">{formatReconciliationDate(audit.created_at)}</p>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {valueSummary(audit.previous_value)} → {valueSummary(audit.new_value)}
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                By {audit.changed_by ? membersById.get(audit.changed_by) || audit.changed_by : "former user"}
              </p>
            </article>
          ))}
          {!audits.length ? <p className="text-sm text-zinc-500">No audit events are visible.</p> : null}
        </div>
      </section>
    </div>
  );
}
