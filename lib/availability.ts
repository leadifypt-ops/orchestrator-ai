export const AVAILABILITY_EXCEPTION_TYPES = [
  "closed",
  "private_event",
  "maintenance",
  "reduced_hours",
  "special_day",
  "other",
] as const;

export type AvailabilityExceptionType =
  (typeof AVAILABILITY_EXCEPTION_TYPES)[number];

export const availabilityExceptionLabels: Record<AvailabilityExceptionType, string> = {
  closed: "Closed",
  private_event: "Private event",
  maintenance: "Maintenance",
  reduced_hours: "Reduced hours",
  special_day: "Special day",
  other: "Other",
};

export type AvailabilityBusiness = {
  id: string;
  name: string;
  role: string;
};

export type AvailabilityRestaurant = {
  id: string;
  business_id: string;
  name: string;
};

export type BusinessServicePeriod = {
  id: string;
  business_id: string;
  restaurant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReservationCapacitySetting = {
  id: string;
  business_id: string;
  restaurant_id: string;
  service_period_id: string;
  max_covers: number;
  max_simultaneous_reservations: number;
  interval_minutes: number;
  max_covers_per_interval: number;
  created_at: string;
  updated_at: string;
};

export type RestaurantArea = {
  id: string;
  business_id: string;
  restaurant_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AvailabilityException = {
  id: string;
  business_id: string;
  restaurant_id: string;
  service_period_id: string | null;
  exception_date: string;
  exception_type: AvailabilityExceptionType;
  reason: string;
  override_start_time: string | null;
  override_end_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReservationAvailabilityAuditEvent = {
  id: string;
  business_id: string;
  restaurant_id: string;
  entity_type:
    | "service_period"
    | "capacity"
    | "area"
    | "exception"
    | "service_calendar"
    | "recurring_exception";
  entity_id: string;
  change_type: "created" | "updated";
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
};

export function canManageAvailability(role: string | null | undefined) {
  return role === "owner" || role === "manager";
}

export function formatOperationalTime(value: string) {
  return value.slice(0, 5);
}

export function servicePeriodDurationLabel(period: BusinessServicePeriod) {
  const start = formatOperationalTime(period.start_time);
  const end = formatOperationalTime(period.end_time);
  return `${start} - ${end}${period.end_time < period.start_time ? " (overnight)" : ""}`;
}
