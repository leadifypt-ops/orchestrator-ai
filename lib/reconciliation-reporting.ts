import type {
  ReconciliationAssignee,
  ReconciliationPriority,
  ReconciliationQueueItem,
} from "@/lib/reconciliation";
import {
  DEFAULT_RECONCILIATION_SLA_HOURS,
  type ReconciliationItemSlaContext,
} from "@/lib/reconciliation-sla-policy";

export const RECONCILIATION_SLA_HOURS: Record<ReconciliationPriority, number> =
  DEFAULT_RECONCILIATION_SLA_HOURS;

export const RECONCILIATION_SLA_NEAR_RATIO = 0.75;

export type ReconciliationSlaState =
  | "within_sla"
  | "near_sla"
  | "over_sla";

export type ReconciliationTiming = {
  ageMs: number;
  sinceUpdateMs: number;
  slaElapsedMs: number;
  slaLimitMs: number;
  slaState: ReconciliationSlaState;
};

export type ReconciliationOwnershipMetric = {
  userId: string | null;
  label: string;
  role: string | null;
  total: number;
  pending: number;
  inReview: number;
  completed: number;
  overSla: number;
};

export function getReconciliationTiming(
  item: ReconciliationQueueItem,
  completedAt: string | null,
  now = new Date(),
  context?: ReconciliationItemSlaContext
): ReconciliationTiming {
  const nowMs = now.getTime();
  const createdMs = new Date(item.created_at).getTime();
  const updatedMs = new Date(item.updated_at).getTime();
  const completionMs = completedAt ? new Date(completedAt).getTime() : updatedMs;
  const effectiveEndMs = item.status === "completed" ? completionMs : nowMs;
  const slaPriority = context?.priority || item.priority;
  const slaHours = context?.hours[slaPriority] || RECONCILIATION_SLA_HOURS[slaPriority];
  const slaLimitMs = slaHours * 60 * 60 * 1000;
  const ageMs = Math.max(0, nowMs - createdMs);
  const sinceUpdateMs = Math.max(0, nowMs - updatedMs);
  const slaElapsedMs = Math.max(0, effectiveEndMs - createdMs);
  const ratio = slaLimitMs === 0 ? 0 : slaElapsedMs / slaLimitMs;
  const slaState = ratio > 1
    ? "over_sla"
    : ratio >= RECONCILIATION_SLA_NEAR_RATIO
      ? "near_sla"
      : "within_sla";

  return { ageMs, sinceUpdateMs, slaElapsedMs, slaLimitMs, slaState };
}

export function formatReconciliationDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 48) return minutes ? `${totalHours}h ${minutes}m` : `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function reconciliationSlaLabel(
  state: ReconciliationSlaState,
  completed: boolean
) {
  if (state === "over_sla") return completed ? "Completed over SLA" : "SLA exceeded";
  if (state === "near_sla") return completed ? "Completed near SLA" : "Near SLA";
  return completed ? "Completed within SLA" : "Within SLA";
}

export function buildReconciliationOwnershipMetrics(
  items: ReconciliationQueueItem[],
  assignees: ReconciliationAssignee[],
  completionByItem: Record<string, string>,
  now = new Date(),
  contexts: Record<string, ReconciliationItemSlaContext> = {}
): ReconciliationOwnershipMetric[] {
  const members = new Map<string, ReconciliationAssignee>();
  for (const assignee of assignees) {
    if (!members.has(assignee.user_id)) members.set(assignee.user_id, assignee);
  }

  const metrics = new Map<string, ReconciliationOwnershipMetric>();
  for (const member of members.values()) {
    metrics.set(member.user_id, {
      userId: member.user_id,
      label: member.email || member.user_id,
      role: member.role,
      total: 0,
      pending: 0,
      inReview: 0,
      completed: 0,
      overSla: 0,
    });
  }

  const unassigned: ReconciliationOwnershipMetric = {
    userId: null,
    label: "Unassigned",
    role: null,
    total: 0,
    pending: 0,
    inReview: 0,
    completed: 0,
    overSla: 0,
  };

  for (const item of items) {
    const metric = item.assigned_to ? metrics.get(item.assigned_to) : unassigned;
    if (!metric) continue;

    metric.total += 1;
    if (item.status === "pending") metric.pending += 1;
    if (item.status === "in_review") metric.inReview += 1;
    if (item.status === "completed") metric.completed += 1;
    if (
      item.status !== "completed"
      && getReconciliationTiming(
        item,
        completionByItem[item.id] || null,
        now,
        contexts[item.id]
      ).slaState === "over_sla"
    ) {
      metric.overSla += 1;
    }
  }

  return [...metrics.values(), unassigned]
    .filter((metric) => metric.total > 0 || metric.userId !== null)
    .sort((left, right) => {
      if (left.userId === null) return 1;
      if (right.userId === null) return -1;
      return right.total - left.total || left.label.localeCompare(right.label);
    });
}
