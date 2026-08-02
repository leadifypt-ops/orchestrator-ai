import type {
  AvailabilityExceptionType,
  BusinessServicePeriod,
} from "./availability";

export const ISO_WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
] as const;

export const CALENDAR_EXCEPTION_TYPES = [
  "closed",
  "private_event",
  "maintenance",
  "reduced_hours",
  "special_day",
  "other",
] as const;

export type CalendarExceptionType =
  | AvailabilityExceptionType
  | "special_day";

export const calendarExceptionLabels: Record<CalendarExceptionType, string> = {
  closed: "Closed",
  private_event: "Private event",
  maintenance: "Maintenance",
  reduced_hours: "Reduced hours",
  special_day: "Special day",
  other: "Other",
};

export type AvailabilityProjectionStatus =
  | "available"
  | "near_capacity"
  | "high_capacity"
  | "fully_occupied"
  | "closed"
  | "not_configured";

export const availabilityProjectionLabels: Record<AvailabilityProjectionStatus, string> = {
  available: "Available",
  near_capacity: "Near capacity",
  high_capacity: "High capacity",
  fully_occupied: "Fully occupied",
  closed: "Closed",
  not_configured: "Capacity not configured",
};

export type ServicePeriodCalendarSetting = {
  id: string;
  business_id: string;
  restaurant_id: string;
  service_period_id: string;
  operating_weekdays: number[];
  created_at: string;
  updated_at: string;
};

export type RecurringAvailabilityException = {
  id: string;
  business_id: string;
  restaurant_id: string;
  service_period_id: string | null;
  operating_weekdays: number[];
  valid_from: string;
  valid_until: string | null;
  exception_type: CalendarExceptionType;
  reason: string;
  override_start_time: string | null;
  override_end_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type OperationalCalendarEntry = {
  operational_date: string;
  business_id: string;
  restaurant_id: string;
  service_period_id: string;
  service_period_name: string;
  scheduled: boolean;
  is_open: boolean;
  base_start_time: string;
  base_end_time: string;
  effective_start_time: string;
  effective_end_time: string;
  exception_source: "one_off" | "recurring" | null;
  exception_id: string | null;
  exception_type: CalendarExceptionType | null;
  exception_reason: string | null;
  configured_capacity: number | null;
  max_simultaneous_reservations: number | null;
  interval_minutes: number | null;
  max_covers_per_interval: number | null;
};

export type AvailabilityProjection = {
  operational_date: string;
  service_period_id: string;
  service_period_name: string;
  scheduled: boolean;
  is_open: boolean;
  effective_start_time: string;
  effective_end_time: string;
  exception_source: "one_off" | "recurring" | null;
  exception_id: string | null;
  exception_type: CalendarExceptionType | null;
  exception_reason: string | null;
  configured_capacity: number | null;
  total_capacity: number;
  capacity_used: number;
  capacity_remaining: number;
  occupancy_percent: number | null;
  reservation_count: number;
  reservations_outside_effective_hours: number;
  covers_outside_effective_hours: number;
  max_simultaneous_reservations: number | null;
  interval_minutes: number | null;
  max_covers_per_interval: number | null;
  availability_status: AvailabilityProjectionStatus;
};

export type AvailabilityDailySummary = {
  operational_date: string;
  service_period_count: number;
  open_service_period_count: number;
  exception_count: number;
  total_capacity: number;
  capacity_used: number;
  capacity_remaining: number;
  occupancy_percent: number | null;
  reservation_count: number;
  reservations_outside_effective_hours: number;
  availability_status: AvailabilityProjectionStatus;
};

export type CalendarExceptionOccurrence = {
  occurrence_date: string;
  exception_source: "one_off" | "recurring";
  exception_id: string;
  service_period_id: string | null;
  exception_type: CalendarExceptionType;
  reason: string;
  override_start_time: string | null;
  override_end_time: string | null;
  operating_weekdays: number[] | null;
  valid_from: string;
  valid_until: string | null;
};

export function operatingWeekdaysLabel(weekdays: number[]) {
  if (weekdays.length === 0) return "No regular operating days";
  if (weekdays.length === 7) return "Every day";
  return ISO_WEEKDAYS.filter((weekday) => weekdays.includes(weekday.value))
    .map((weekday) => weekday.short)
    .join(", ");
}

export function classifyAvailabilityProjection(
  occupancyPercent: number | null,
  isOpen = true,
  hasCapacity = true
): AvailabilityProjectionStatus {
  if (!isOpen) return "closed";
  if (!hasCapacity || occupancyPercent === null) return "not_configured";
  if (occupancyPercent >= 100) return "fully_occupied";
  if (occupancyPercent >= 90) return "high_capacity";
  if (occupancyPercent >= 75) return "near_capacity";
  return "available";
}

export function formatProjectionTime(value: string | null) {
  return value ? value.slice(0, 5) : "—";
}

export function periodCalendarLabel(
  period: BusinessServicePeriod,
  setting?: ServicePeriodCalendarSetting
) {
  return `${period.name}: ${operatingWeekdaysLabel(
    setting?.operating_weekdays ?? [1, 2, 3, 4, 5, 6, 7]
  )}`;
}
