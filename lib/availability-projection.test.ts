import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarExceptionLabels,
  classifyAvailabilityProjection,
  formatProjectionTime,
  operatingWeekdaysLabel,
} from "./availability-projection";

test("formats weekly service calendars", () => {
  assert.equal(operatingWeekdaysLabel([1, 2, 3, 4, 5, 6, 7]), "Every day");
  assert.equal(operatingWeekdaysLabel([2, 5]), "Tue, Fri");
  assert.equal(operatingWeekdaysLabel([]), "No regular operating days");
});

test("classifies informational occupancy thresholds", () => {
  assert.equal(classifyAvailabilityProjection(0), "available");
  assert.equal(classifyAvailabilityProjection(75), "near_capacity");
  assert.equal(classifyAvailabilityProjection(90), "high_capacity");
  assert.equal(classifyAvailabilityProjection(100), "fully_occupied");
  assert.equal(classifyAvailabilityProjection(130), "fully_occupied");
  assert.equal(classifyAvailabilityProjection(null, true, false), "not_configured");
  assert.equal(classifyAvailabilityProjection(100, false), "closed");
});

test("keeps calendar exception meanings explicit", () => {
  assert.equal(calendarExceptionLabels.special_day, "Special day");
  assert.equal(calendarExceptionLabels.reduced_hours, "Reduced hours");
  assert.equal(formatProjectionTime("19:30:00"), "19:30");
  assert.equal(formatProjectionTime(null), "—");
});
