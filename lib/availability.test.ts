import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityExceptionLabels,
  canManageAvailability,
  formatOperationalTime,
  servicePeriodDurationLabel,
  type BusinessServicePeriod,
} from "./availability";

function period(overrides: Partial<BusinessServicePeriod> = {}): BusinessServicePeriod {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    business_id: "20000000-0000-0000-0000-000000000001",
    restaurant_id: "30000000-0000-0000-0000-000000000001",
    name: "Dinner",
    start_time: "19:00:00",
    end_time: "23:00:00",
    active: true,
    created_at: "2026-06-29T12:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    ...overrides,
  };
}

test("only owners and managers can configure availability", () => {
  assert.equal(canManageAvailability("owner"), true);
  assert.equal(canManageAvailability("manager"), true);
  assert.equal(canManageAvailability("staff"), false);
  assert.equal(canManageAvailability(null), false);
});

test("formats PostgreSQL operational times for form controls", () => {
  assert.equal(formatOperationalTime("19:30:00"), "19:30");
});

test("identifies overnight service periods", () => {
  assert.equal(
    servicePeriodDurationLabel(period({ start_time: "20:00:00", end_time: "02:00:00" })),
    "20:00 - 02:00 (overnight)"
  );
  assert.equal(servicePeriodDurationLabel(period()), "19:00 - 23:00");
});

test("keeps operational exception labels explicit", () => {
  assert.equal(availabilityExceptionLabels.private_event, "Private event");
  assert.equal(availabilityExceptionLabels.reduced_hours, "Reduced hours");
});
