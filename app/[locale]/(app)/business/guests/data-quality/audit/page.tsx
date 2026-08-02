import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type MergeAuditRow = {
  id: string;
  created_at: string;
  changed_by: string | null;
  source_identity_id: string | null;
  reservations_reassigned: number | null;
  profiles_reassigned: number | null;
  conflicts: Record<string, unknown> | null;
  decision: Record<string, unknown> | null;
  previous_values: { source?: { full_name?: string | null }; target?: { full_name?: string | null } } | null;
};
type AliasRow = { source_guest_identity_id: string | null; contact_type: "email" | "phone"; contact_value: string };
export const dynamic = "force-dynamic";

export default async function MergeAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const [{ data: auditData = [] }, { data: aliasData = [] }] = await Promise.all([
    supabase.from("guest_crm_audit_events").select("id, created_at, changed_by, source_identity_id, reservations_reassigned, profiles_reassigned, conflicts, decision, previous_values").eq("change_type", "merge").order("created_at", { ascending: false }),
    supabase.from("guest_contact_aliases").select("source_guest_identity_id, contact_type, contact_value").eq("source", "merge_preserved_contact"),
  ]);
  const audits = auditData as MergeAuditRow[];
  const aliases = aliasData as AliasRow[];
  const date = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <div className="space-y-6 p-6 text-white">
    <Link href={`/${locale}/business/guests/data-quality`} className="inline-flex text-sm text-zinc-500 hover:text-white">Back to data quality</Link>
    <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Merge governance</p><h1 className="mt-2 text-3xl font-semibold">Merge audit history</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Read-only accountability for manual identity merges. Preserved contact aliases stay inside the same Business and help future reservations recognize the principal guest.</p></header>
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5"><h2 className="text-xl font-semibold">Recovery preparation</h2><p className="mt-2 text-sm leading-6 text-zinc-300">A merge is not automatically reversible. To investigate a suspected mistake, verify this audit snapshot, identify affected reservations and guest profiles, preserve new activity, and have an authorized Business member perform a reviewed manual correction. Any future recovery action must require explicit confirmation and a new audit record.</p></section>
    {audits.length ? <div className="space-y-4">{audits.map((audit) => {
      const preserved = aliases.filter((alias) => alias.source_guest_identity_id === audit.source_identity_id);
      const conflictFields = Object.keys(audit.conflicts || {});
      return <article key={audit.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-[0.15em] text-zinc-600">{date(audit.created_at)}</p><h2 className="mt-1 text-xl font-semibold">{audit.previous_values?.source?.full_name || "Source identity"} → {audit.previous_values?.target?.full_name || "Target identity"}</h2><p className="mt-1 text-sm text-zinc-500">Performed by {audit.changed_by || "actor not retained"}</p></div><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{audit.decision?.strategy === "destination_wins" ? "Destination retained" : "Recorded decision"}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Reservations reassigned", audit.reservations_reassigned || 0], ["Guest profiles reassigned", audit.profiles_reassigned || 0], ["Preserved contacts", preserved.length], ["Recorded conflicts", conflictFields.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-black/30 p-3 text-sm"><p className="text-zinc-600">{label}</p><p className="mt-1 text-lg font-medium">{value}</p></div>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="text-sm"><p className="font-medium text-zinc-300">Preserved contacts</p><p className="mt-1 text-zinc-500">{preserved.length ? preserved.map((alias) => `${alias.contact_type}: ${alias.contact_value}`).join(" · ") : "No source contact was preserved."}</p></div><div className="text-sm"><p className="font-medium text-zinc-300">Conflicts</p><p className="mt-1 text-zinc-500">{conflictFields.length ? conflictFields.join(" · ") : "None recorded."}</p></div></div><Link href={`/${locale}/business/guests/data-quality/audit/${audit.id}/recovery`} className="mt-5 inline-flex rounded-xl border border-amber-500/30 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10">Open governed recovery preview</Link></article>;
    })}</div> : <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-zinc-500">No merge audit events are available for your Businesses.</section>}
  </div>;
}
