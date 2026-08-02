"use client";

import { useActionState } from "react";
import {
  initialReconciliationActionState,
  updateReconciliationSlaPolicy,
} from "./actions";
import type {
  ReconciliationSlaPolicyAuditEvent,
  ReconciliationSlaPolicyRow,
} from "@/lib/reconciliation-sla-policy";

type GovernanceBusiness = {
  id: string;
  name: string;
  role: string | null;
  policy: ReconciliationSlaPolicyRow | null;
  history: ReconciliationSlaPolicyAuditEvent[];
};

function PolicyForm({ business }: { business: GovernanceBusiness }) {
  const [state, action, pending] = useActionState(
    updateReconciliationSlaPolicy,
    initialReconciliationActionState
  );
  const canManage = business.role === "owner" || business.role === "manager";
  const policy = business.policy;

  return (
    <article className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-zinc-100">{business.name}</h3>
          <p className="mt-1 text-xs capitalize text-zinc-500">
            Your role: {business.role || "member"}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
          {canManage ? "Configuration permitted" : "Read only"}
        </span>
      </div>

      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="business_id" value={business.id} />
        {([
          ["high_priority_hours", "High priority", policy?.high_priority_hours ?? 24],
          ["medium_priority_hours", "Medium priority", policy?.medium_priority_hours ?? 72],
          ["low_priority_hours", "Low priority", policy?.low_priority_hours ?? 120],
        ] as const).map(([name, label, value]) => (
          <label key={name} className="text-xs text-zinc-500">
            {label} (hours)
            <input
              name={name}
              type="number"
              min={1}
              max={720}
              required
              disabled={!canManage || pending}
              defaultValue={value}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button
            disabled={!canManage || pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save audited policy"}
          </button>
          {state.message ? (
            <p className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <details className="rounded-lg border border-white/10 px-3 py-2">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-zinc-500">
          Append-only history ({business.history.length})
        </summary>
        <div className="mt-3 space-y-2">
          {business.history.slice(0, 10).map((event) => (
            <div key={event.id} className="rounded-lg bg-white/[0.03] p-3 text-xs text-zinc-400">
              <p className="text-zinc-300">
                {event.change_type === "initialized" ? "Policy initialized" : "Policy changed"}
                {" / "}{new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}
              </p>
              <p className="mt-1">
                High {String(event.new_values.high_priority_hours)}h / Medium {String(event.new_values.medium_priority_hours)}h / Low {String(event.new_values.low_priority_hours)}h
              </p>
              <p className="mt-1 text-zinc-600">Actor: {event.changed_by || "system"}</p>
            </div>
          ))}
          {business.history.length === 0 ? (
            <p className="text-zinc-600">No policy history is available.</p>
          ) : null}
        </div>
      </details>
    </article>
  );
}

export function SlaPolicyGovernance({ businesses }: { businesses: GovernanceBusiness[] }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">Governance</p>
        <h2 className="mt-1 text-xl font-semibold">Business SLA policies</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Owners and managers may change informational thresholds. Every effective change is audited and never triggers assignment, escalation, recovery, or closure.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {businesses.map((business) => <PolicyForm key={business.id} business={business} />)}
      </div>
    </section>
  );
}
