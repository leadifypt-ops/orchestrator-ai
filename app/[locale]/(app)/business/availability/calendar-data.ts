import { createClient } from "@/lib/supabase/server";
import type {
  AvailabilityDailySummary,
  AvailabilityProjection,
  CalendarExceptionOccurrence,
  OperationalCalendarEntry,
  RecurringAvailabilityException,
  ServicePeriodCalendarSetting,
} from "@/lib/availability-projection";
import { loadAvailabilityFoundation } from "./data";

export async function loadServiceCalendarConfiguration() {
  const foundation = await loadAvailabilityFoundation();
  const supabase = await createClient();
  const [settingsResult, recurringResult] = await Promise.all([
    supabase
      .from("service_period_calendar_settings")
      .select("id, business_id, restaurant_id, service_period_id, operating_weekdays, created_at, updated_at"),
    supabase
      .from("recurring_availability_exceptions")
      .select("id, business_id, restaurant_id, service_period_id, operating_weekdays, valid_from, valid_until, exception_type, reason, override_start_time, override_end_time, active, created_at, updated_at")
      .order("valid_from"),
  ]);
  const businessIds = new Set(foundation.businesses.map((business) => business.id));
  return {
    ...foundation,
    restaurants: foundation.restaurants.filter((restaurant) =>
      businessIds.has(restaurant.business_id)
    ),
    calendarSettings: (settingsResult.data || []) as ServicePeriodCalendarSetting[],
    recurringExceptions: (recurringResult.data || []) as RecurringAvailabilityException[],
    calendarConfigurationError: settingsResult.error || recurringResult.error,
  };
}

export async function loadAvailabilityProjection(
  businessId: string,
  restaurantId: string,
  dateFrom: string,
  dateTo: string
) {
  const supabase = await createClient();
  const parameters = {
    p_business_id: businessId,
    p_restaurant_id: restaurantId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  };
  const [calendarResult, projectionResult, summaryResult, exceptionsResult] =
    await Promise.all([
      supabase.rpc("get_restaurant_operational_calendar_v1", parameters),
      supabase.rpc("project_restaurant_availability_v1", parameters),
      supabase.rpc("get_restaurant_availability_daily_summary_v1", parameters),
      supabase.rpc("list_restaurant_availability_exceptions_v1", parameters),
    ]);
  return {
    calendar: (calendarResult.data || []) as OperationalCalendarEntry[],
    projection: (projectionResult.data || []) as AvailabilityProjection[],
    summaries: (summaryResult.data || []) as AvailabilityDailySummary[],
    exceptionOccurrences: (exceptionsResult.data || []) as CalendarExceptionOccurrence[],
    error: calendarResult.error || projectionResult.error
      || summaryResult.error || exceptionsResult.error,
  };
}
