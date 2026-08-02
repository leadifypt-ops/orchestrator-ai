import assert from "node:assert/strict";
import test from "node:test";
import type { ReconciliationQueueItem } from "./reconciliation";
import {
  buildReconciliationOwnershipMetrics,
  formatReconciliationDuration,
  getReconciliationTiming,
} from "./reconciliation-reporting";

const NOW = new Date("2026-06-29T12:00:00.000Z");

function queueItem(
  overrides: Partial<ReconciliationQueueItem> = {}
): ReconciliationQueueItem {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    business_id: "20000000-0000-0000-0000-000000000001",
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
    origin: "Reporting test",
    assigned_to: null,
    created_by: null,
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T06:00:00.000Z",
    ...overrides,
  };
}

test("classifies high-priority cases by the 24-hour SLA", () => {
  const near = getReconciliationTiming(
    queueItem({ created_at: "2026-06-28T16:00:00.000Z" }),
    null,
    NOW
  );
  const exceeded = getReconciliationTiming(
    queueItem({ created_at: "2026-06-28T10:00:00.000Z" }),
    null,
    NOW
  );

  assert.equal(near.slaState, "near_sla");
  assert.equal(exceeded.slaState, "over_sla");
});

test("uses the immutable completion event instead of later item updates", () => {
  const completed = queueItem({
    status: "completed",
    created_at: "2026-06-28T12:00:00.000Z",
    updated_at: "2026-06-29T11:00:00.000Z",
  });

  const timing = getReconciliationTiming(
    completed,
    "2026-06-29T06:00:00.000Z",
    NOW
  );

  assert.equal(timing.slaState, "near_sla");
  assert.equal(timing.slaElapsedMs, 18 * 60 * 60 * 1000);
});

test("aggregates assigned and unassigned ownership without automation", () => {
  const ownerId = "30000000-0000-0000-0000-000000000001";
  const items = [
    queueItem({ assigned_to: ownerId }),
    queueItem({
      id: "10000000-0000-0000-0000-000000000002",
      assigned_to: ownerId,
      status: "completed",
    }),
    queueItem({
      id: "10000000-0000-0000-0000-000000000003",
      assigned_to: null,
      priority: "low",
    }),
  ];

  const metrics = buildReconciliationOwnershipMetrics(
    items,
    [{ user_id: ownerId, email: "owner@example.test", role: "owner" }],
    {},
    NOW
  );

  assert.deepEqual(
    metrics.map(({ label, total, pending, completed }) => ({
      label,
      total,
      pending,
      completed,
    })),
    [
      { label: "owner@example.test", total: 2, pending: 1, completed: 1 },
      { label: "Unassigned", total: 1, pending: 1, completed: 0 },
    ]
  );
});

test("formats operational durations compactly", () => {
  assert.equal(formatReconciliationDuration(45 * 60_000), "45m");
  assert.equal(formatReconciliationDuration(26 * 60 * 60_000), "26h");
  assert.equal(formatReconciliationDuration(50 * 60 * 60_000), "2d 2h");
});
