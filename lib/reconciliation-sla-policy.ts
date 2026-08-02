import type {
  ReconciliationPriority,
  ReconciliationQueueItem,
} from "@/lib/reconciliation";

export type ReconciliationSlaPolicyHours = Record<ReconciliationPriority, number>;

export const DEFAULT_RECONCILIATION_SLA_HOURS: ReconciliationSlaPolicyHours = {
  high: 24,
  medium: 72,
  low: 120,
};

export type ReconciliationSlaPolicyRow = {
  business_id: string;
  high_priority_hours: number;
  medium_priority_hours: number;
  low_priority_hours: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ReconciliationSlaPolicyAuditEvent = {
  id: string;
  business_id: string;
  change_type: "initialized" | "policy_changed";
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
};

export type ReconciliationQueueSlaAuditEvent = {
  reconciliation_item_id: string;
  change_type: string;
  new_value: Record<string, unknown>;
  created_at: string;
};

export type ReconciliationItemSlaContext = {
  hours: ReconciliationSlaPolicyHours;
  priority: ReconciliationPriority;
  policyEffectiveAt: string | null;
  historical: boolean;
};

function validHours(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function reconciliationSlaHoursFromValues(
  values: Record<string, unknown>
): ReconciliationSlaPolicyHours {
  return {
    high: validHours(
      values.high_priority_hours,
      DEFAULT_RECONCILIATION_SLA_HOURS.high
    ),
    medium: validHours(
      values.medium_priority_hours,
      DEFAULT_RECONCILIATION_SLA_HOURS.medium
    ),
    low: validHours(
      values.low_priority_hours,
      DEFAULT_RECONCILIATION_SLA_HOURS.low
    ),
  };
}

export function reconciliationSlaHoursFromPolicy(
  policy: ReconciliationSlaPolicyRow | undefined
) {
  return policy
    ? reconciliationSlaHoursFromValues(policy)
    : DEFAULT_RECONCILIATION_SLA_HOURS;
}

function isPriority(value: unknown): value is ReconciliationPriority {
  return value === "high" || value === "medium" || value === "low";
}

export function buildReconciliationSlaContexts(
  items: ReconciliationQueueItem[],
  completionByItem: Record<string, string>,
  activePolicies: ReconciliationSlaPolicyRow[],
  policyHistory: ReconciliationSlaPolicyAuditEvent[],
  queueHistory: ReconciliationQueueSlaAuditEvent[]
): Record<string, ReconciliationItemSlaContext> {
  const activeByBusiness = new Map(
    activePolicies.map((policy) => [policy.business_id, policy])
  );
  const policyHistoryByBusiness = new Map<
    string,
    ReconciliationSlaPolicyAuditEvent[]
  >();
  const queueHistoryByItem = new Map<string, ReconciliationQueueSlaAuditEvent[]>();

  for (const event of policyHistory) {
    const events = policyHistoryByBusiness.get(event.business_id) || [];
    events.push(event);
    policyHistoryByBusiness.set(event.business_id, events);
  }
  for (const event of queueHistory) {
    const events = queueHistoryByItem.get(event.reconciliation_item_id) || [];
    events.push(event);
    queueHistoryByItem.set(event.reconciliation_item_id, events);
  }

  for (const events of policyHistoryByBusiness.values()) {
    events.sort((left, right) => left.created_at.localeCompare(right.created_at));
  }
  for (const events of queueHistoryByItem.values()) {
    events.sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  return Object.fromEntries(items.map((item) => {
    const completionAt = item.status === "completed"
      ? completionByItem[item.id] || null
      : null;

    if (!completionAt) {
      const activePolicy = activeByBusiness.get(item.business_id);
      return [item.id, {
        hours: reconciliationSlaHoursFromPolicy(activePolicy),
        priority: item.priority,
        policyEffectiveAt: activePolicy?.updated_at || null,
        historical: false,
      }];
    }

    let priority = item.priority;
    for (const event of queueHistoryByItem.get(item.id) || []) {
      if (event.created_at > completionAt) break;
      if (isPriority(event.new_value.priority)) priority = event.new_value.priority;
    }

    let historicalPolicy: ReconciliationSlaPolicyAuditEvent | undefined;
    for (const event of policyHistoryByBusiness.get(item.business_id) || []) {
      if (event.created_at > completionAt) break;
      historicalPolicy = event;
    }

    return [item.id, {
      hours: historicalPolicy
        ? reconciliationSlaHoursFromValues(historicalPolicy.new_values)
        : DEFAULT_RECONCILIATION_SLA_HOURS,
      priority,
      policyEffectiveAt: historicalPolicy?.created_at || null,
      historical: true,
    }];
  }));
}
