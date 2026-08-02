import assert from "node:assert/strict";
import test from "node:test";
import type { ReconciliationQueueItem } from "./reconciliation";
import {
  buildReconciliationSlaContexts,
  reconciliationSlaHoursFromPolicy,
  type ReconciliationSlaPolicyAuditEvent,
  type ReconciliationSlaPolicyRow,
} from "./reconciliation-sla-policy";

const BUSINESS_ID = "20000000-0000-0000-0000-000000000001";

function queueItem(overrides: Partial<ReconciliationQueueItem> = {}): ReconciliationQueueItem {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    business_id: BUSINESS_ID,
    reconciliation_type: "recovery_review",
    status: "pending",
    priority: "high",
    restaurant_id: null,
    guest_identity_id: null,
    reservation_id: null,
    audit_event_id: null,
    merge_audit_event_id: null,
    recovery_event_id: null,
    recovery_execution_event_id: null,
    reconciliation_review_id: null,
    origin: "SLA policy test",
    assigned_to: null,
    created_by: null,
    created_at: "2026-06-29T08:00:00.000Z",
    updated_at: "2026-06-29T10:00:00.000Z",
    ...overrides,
  };
}

function policy(overrides: Partial<ReconciliationSlaPolicyRow> = {}): ReconciliationSlaPolicyRow {
  return {
    business_id: BUSINESS_ID,
    high_priority_hours: 12,
    medium_priority_hours: 36,
    low_priority_hours: 96,
    created_at: "2026-06-29T09:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    updated_by: null,
    ...overrides,
  };
}

function policyEvent(
  id: string,
  createdAt: string,
  highHours: number
): ReconciliationSlaPolicyAuditEvent {
  return {
    id,
    business_id: BUSINESS_ID,
    change_type: "policy_changed",
    previous_values: {},
    new_values: {
      high_priority_hours: highHours,
      medium_priority_hours: 48,
      low_priority_hours: 120,
    },
    changed_by: null,
    created_at: createdAt,
  };
}

test("open cases use the active Business policy", () => {
  const item = queueItem();
  const contexts = buildReconciliationSlaContexts([item], {}, [policy()], [], []);

  assert.deepEqual(contexts[item.id].hours, { high: 12, medium: 36, low: 96 });
  assert.equal(contexts[item.id].priority, "high");
  assert.equal(contexts[item.id].historical, false);
});

test("completed cases retain policy and priority effective at completion", () => {
  const item = queueItem({ status: "completed", priority: "low" });
  const completionAt = "2026-06-29T11:00:00.000Z";
  const contexts = buildReconciliationSlaContexts(
    [item],
    { [item.id]: completionAt },
    [policy({ high_priority_hours: 6 })],
    [
      policyEvent("30000000-0000-0000-0000-000000000001", "2026-06-29T09:00:00.000Z", 24),
      policyEvent("30000000-0000-0000-0000-000000000002", "2026-06-29T12:00:00.000Z", 6),
    ],
    [
      {
        reconciliation_item_id: item.id,
        change_type: "created",
        new_value: { priority: "high" },
        created_at: "2026-06-29T08:00:00.000Z",
      },
      {
        reconciliation_item_id: item.id,
        change_type: "priority_changed",
        new_value: { priority: "medium" },
        created_at: "2026-06-29T10:00:00.000Z",
      },
      {
        reconciliation_item_id: item.id,
        change_type: "priority_changed",
        new_value: { priority: "low" },
        created_at: "2026-06-29T12:00:00.000Z",
      },
    ]
  );

  assert.equal(contexts[item.id].hours.high, 24);
  assert.equal(contexts[item.id].priority, "medium");
  assert.equal(contexts[item.id].historical, true);
  assert.equal(contexts[item.id].policyEffectiveAt, "2026-06-29T09:00:00.000Z");
});

test("pre-policy completed cases retain the Block 39 defaults", () => {
  const item = queueItem({ status: "completed" });
  const contexts = buildReconciliationSlaContexts(
    [item],
    { [item.id]: "2026-06-29T08:30:00.000Z" },
    [policy()],
    [policyEvent("30000000-0000-0000-0000-000000000003", "2026-06-29T09:00:00.000Z", 12)],
    []
  );

  assert.deepEqual(contexts[item.id].hours, { high: 24, medium: 72, low: 120 });
});

test("missing current policy safely falls back to defaults", () => {
  assert.deepEqual(reconciliationSlaHoursFromPolicy(undefined), {
    high: 24,
    medium: 72,
    low: 120,
  });
});
