import {
  buildReconciliationOwnershipMetrics,
  formatReconciliationDuration,
  getReconciliationTiming,
  reconciliationSlaLabel,
  type ReconciliationSlaState,
} from "@/lib/reconciliation-reporting";
import {
  type ReconciliationAssignee,
  type ReconciliationQueueItem,
} from "@/lib/reconciliation";
import type {
  ReconciliationItemSlaContext,
  ReconciliationSlaPolicyHours,
} from "@/lib/reconciliation-sla-policy";

function slaClass(state: ReconciliationSlaState) {
  if (state === "over_sla") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (state === "near_sla") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export function reconciliationRowClass(
  item: ReconciliationQueueItem,
  completedAt: string | null,
  now: Date,
  context?: ReconciliationItemSlaContext
) {
  if (item.status === "completed") return "bg-black/20 hover:bg-white/[0.03]";
  const state = getReconciliationTiming(item, completedAt, now, context).slaState;
  if (state === "over_sla") return "bg-red-500/[0.06] hover:bg-red-500/[0.1]";
  if (state === "near_sla") return "bg-amber-500/[0.05] hover:bg-amber-500/[0.09]";
  return "bg-black/20 hover:bg-white/[0.03]";
}

export function ReconciliationTimingCells({
  item,
  completedAt,
  now,
  locale,
  context,
}: {
  item: ReconciliationQueueItem;
  completedAt: string | null;
  now: Date;
  locale: string;
  context?: ReconciliationItemSlaContext;
}) {
  const timing = getReconciliationTiming(item, completedAt, now, context);
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return <>
    <td className="whitespace-nowrap px-4 py-4 text-zinc-300" title={formatter.format(new Date(item.created_at))}>
      {formatReconciliationDuration(timing.ageMs)}
    </td>
    <td className="whitespace-nowrap px-4 py-4 text-zinc-400" title={formatter.format(new Date(item.updated_at))}>
      {formatReconciliationDuration(timing.sinceUpdateMs)} ago
    </td>
    <td className="whitespace-nowrap px-4 py-4">
      <span className={`rounded-full border px-2.5 py-1 text-xs ${slaClass(timing.slaState)}`}>
        {reconciliationSlaLabel(timing.slaState, item.status === "completed")}
      </span>
      <p className="mt-2 text-xs text-zinc-600">
        {formatReconciliationDuration(timing.slaElapsedMs)} / {Math.round(timing.slaLimitMs / 3_600_000)}h
        {context?.historical ? " / historical policy" : ""}
      </p>
    </td>
  </>;
}

export function ReconciliationReporting({
  items,
  assignees,
  completionByItem,
  now,
  contexts,
  policySummaries,
}: {
  items: ReconciliationQueueItem[];
  assignees: ReconciliationAssignee[];
  completionByItem: Record<string, string>;
  now: Date;
  contexts: Record<string, ReconciliationItemSlaContext>;
  policySummaries: Array<{
    businessId: string;
    businessName: string;
    hours: ReconciliationSlaPolicyHours;
  }>;
}) {
  const timings = items.map((item) => ({
    item,
    timing: getReconciliationTiming(
      item,
      completionByItem[item.id] || null,
      now,
      contexts[item.id]
    ),
  }));
  const assigned = items.filter((item) => item.assigned_to).length;
  const completed = items.filter((item) => item.status === "completed").length;
  const open = items.length - completed;
  const nearSla = timings.filter(({ item, timing }) => item.status !== "completed" && timing.slaState === "near_sla").length;
  const overSla = timings.filter(({ item, timing }) => item.status !== "completed" && timing.slaState === "over_sla").length;
  const ownership = buildReconciliationOwnershipMetrics(
    items,
    assignees,
    completionByItem,
    now,
    contexts
  );

  const cards = [
    ["Visible cases", items.length, "Current filters"],
    ["Assigned", assigned, `${items.length - assigned} unassigned`],
    ["Open", open, `${completed} completed`],
    ["Near SLA", nearSla, "75% of allowance"],
    ["SLA exceeded", overSla, "Informational only"],
  ] as const;

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">Operational dashboard</p>
        <h2 className="mt-1 text-xl font-semibold">Ownership, ageing and SLA</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Reporting is derived from current queue state and append-only audit history. It never assigns, closes, escalates, or recovers a case.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, note]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {policySummaries.map((summary) => (
          <div key={summary.businessId} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
            <p className="font-medium text-zinc-200">{summary.businessName}</p>
            <p className="mt-1 text-zinc-500">
              High {summary.hours.high}h / Medium {summary.hours.medium}h / Low {summary.hours.low}h
            </p>
            <p className="mt-1 text-xs text-zinc-600">Informational only / near at 75%</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-zinc-500">
            <tr>{["Responsible", "Role", "Cases", "Pending", "In Review", "Completed", "Over SLA"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {ownership.map((metric) => (
              <tr key={metric.userId || "unassigned"} className="bg-black/20">
                <td className="px-4 py-3 font-medium text-zinc-200">{metric.label}</td>
                <td className="px-4 py-3 capitalize text-zinc-500">{metric.role || "-"}</td>
                <td className="px-4 py-3">{metric.total}</td>
                <td className="px-4 py-3">{metric.pending}</td>
                <td className="px-4 py-3">{metric.inReview}</td>
                <td className="px-4 py-3">{metric.completed}</td>
                <td className={metric.overSla ? "px-4 py-3 text-red-200" : "px-4 py-3 text-zinc-500"}>{metric.overSla}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
