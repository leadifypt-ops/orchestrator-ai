"use client";

import { useActionState, useMemo, useState } from "react";
import {
  RECONCILIATION_PRIORITIES,
  RECONCILIATION_STATUSES,
  RECONCILIATION_TYPES,
  reconciliationPriorityLabels,
  reconciliationStatusLabels,
  reconciliationTypeLabels,
  type ReconciliationAssignee,
  type ReconciliationPriority,
  type ReconciliationStatus,
} from "@/lib/reconciliation";
import {
  assignReconciliationItem,
  createReconciliationItem,
  initialReconciliationActionState,
  updateReconciliationPriority,
  updateReconciliationStatus,
} from "./actions";

type BusinessOption = { id: string; name: string };
type EntityOption = { id: string; business_id: string; label: string };

function Feedback({ status, message }: { status: string; message: string }) {
  if (!message) return null;
  return (
    <p className={`text-xs ${status === "error" ? "text-red-300" : "text-emerald-300"}`}>
      {message}
    </p>
  );
}

export function CreateReconciliationForm({
  businesses,
  restaurants,
  guests,
  assignees,
}: {
  businesses: BusinessOption[];
  restaurants: EntityOption[];
  guests: EntityOption[];
  assignees: ReconciliationAssignee[];
}) {
  const [state, action, pending] = useActionState(
    createReconciliationItem,
    initialReconciliationActionState
  );
  const [businessId, setBusinessId] = useState(businesses[0]?.id || "");
  const availableRestaurants = useMemo(
    () => restaurants.filter((item) => item.business_id === businessId),
    [businessId, restaurants]
  );
  const availableGuests = useMemo(
    () => guests.filter((item) => item.business_id === businessId),
    [businessId, guests]
  );
  const availableAssignees = useMemo(
    () => assignees.filter((item) => item.business_id === businessId),
    [assignees, businessId]
  );

  return (
    <form action={action} className="mt-5 grid gap-3 lg:grid-cols-4">
      <label className="text-xs text-zinc-500">
        Business
        <select
          name="business_id"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>{business.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Type
        <select name="reconciliation_type" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
          {RECONCILIATION_TYPES.map((type) => (
            <option key={type} value={type}>{reconciliationTypeLabels[type]}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Priority
        <select name="priority" defaultValue="medium" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
          {RECONCILIATION_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>{reconciliationPriorityLabels[priority]}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Assignee
        <select name="assigned_to" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="">Unassigned</option>
          {availableAssignees.map((member) => (
            <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-500 lg:col-span-2">
        Origin
        <input name="origin" required maxLength={500} placeholder="Why this reconciliation requires operational review" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white" />
      </label>
      <label className="text-xs text-zinc-500">
        Restaurant (optional)
        <select name="restaurant_id" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="">No restaurant</option>
          {availableRestaurants.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Guest (optional)
        <select name="guest_identity_id" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
          <option value="">No guest</option>
          {availableGuests.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <details className="lg:col-span-4 rounded-xl border border-white/10 p-3">
        <summary className="cursor-pointer text-sm text-zinc-400">Optional historical links</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["reservation_id", "Reservation UUID"],
            ["audit_event_id", "Audit Event UUID"],
            ["merge_audit_event_id", "Merge Audit UUID"],
            ["recovery_event_id", "Recovery UUID"],
          ].map(([name, label]) => (
            <label key={name} className="text-xs text-zinc-500">
              {label}
              <input name={name} placeholder="Optional UUID" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white" />
            </label>
          ))}
        </div>
      </details>
      <div className="flex items-center gap-3 lg:col-span-4">
        <button disabled={pending || businesses.length === 0} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Adding…" : "Add to queue"}
        </button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function ReconciliationControls({
  itemId,
  status,
  priority,
  assignedTo,
  assignees,
}: {
  itemId: string;
  status: ReconciliationStatus;
  priority: ReconciliationPriority;
  assignedTo: string | null;
  assignees: ReconciliationAssignee[];
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateReconciliationStatus.bind(null, itemId), initialReconciliationActionState
  );
  const [priorityState, priorityAction, priorityPending] = useActionState(
    updateReconciliationPriority.bind(null, itemId), initialReconciliationActionState
  );
  const [assigneeState, assigneeAction, assigneePending] = useActionState(
    assignReconciliationItem.bind(null, itemId), initialReconciliationActionState
  );
  const inputClass = "mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form action={statusAction} className="rounded-xl border border-white/10 bg-black/30 p-4">
        <label className="text-xs uppercase tracking-wider text-zinc-500">Status
          <select name="status" defaultValue={status} className={inputClass}>
            {RECONCILIATION_STATUSES.map((value) => <option key={value} value={value}>{reconciliationStatusLabels[value]}</option>)}
          </select>
        </label>
        <button disabled={statusPending} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50">Update status</button>
        <div className="mt-2"><Feedback status={statusState.status} message={statusState.message} /></div>
      </form>
      <form action={priorityAction} className="rounded-xl border border-white/10 bg-black/30 p-4">
        <label className="text-xs uppercase tracking-wider text-zinc-500">Priority
          <select name="priority" defaultValue={priority} className={inputClass}>
            {RECONCILIATION_PRIORITIES.map((value) => <option key={value} value={value}>{reconciliationPriorityLabels[value]}</option>)}
          </select>
        </label>
        <button disabled={priorityPending} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50">Update priority</button>
        <div className="mt-2"><Feedback status={priorityState.status} message={priorityState.message} /></div>
      </form>
      <form action={assigneeAction} className="rounded-xl border border-white/10 bg-black/30 p-4">
        <label className="text-xs uppercase tracking-wider text-zinc-500">Assignee
          <select name="assigned_to" defaultValue={assignedTo || ""} className={inputClass}>
            <option value="">Unassigned</option>
            {assignees.map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id} · {member.role}</option>)}
          </select>
        </label>
        <button disabled={assigneePending} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50">Update assignee</button>
        <div className="mt-2"><Feedback status={assigneeState.status} message={assigneeState.message} /></div>
      </form>
    </div>
  );
}
