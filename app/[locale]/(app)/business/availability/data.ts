import { createClient } from "@/lib/supabase/server";
import type {
  AvailabilityBusiness,
  AvailabilityException,
  AvailabilityRestaurant,
  BusinessServicePeriod,
  ReservationAvailabilityAuditEvent,
  ReservationCapacitySetting,
  RestaurantArea,
} from "@/lib/availability";

export async function loadAvailabilityFoundation() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    membershipsResult,
    businessesResult,
    restaurantsResult,
    periodsResult,
    capacitiesResult,
    areasResult,
    exceptionsResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("business_memberships")
      .select("business_id, role")
      .eq("user_id", user?.id || ""),
    supabase.from("businesses").select("id, name").order("name"),
    supabase.from("restaurants").select("id, business_id, name").order("name"),
    supabase
      .from("business_service_periods")
      .select("id, business_id, restaurant_id, name, start_time, end_time, active, created_at, updated_at")
      .order("start_time"),
    supabase
      .from("reservation_capacity_settings")
      .select("id, business_id, restaurant_id, service_period_id, max_covers, max_simultaneous_reservations, interval_minutes, max_covers_per_interval, created_at, updated_at"),
    supabase
      .from("restaurant_areas")
      .select("id, business_id, restaurant_id, name, active, created_at, updated_at")
      .order("name"),
    supabase
      .from("availability_exceptions")
      .select("id, business_id, restaurant_id, service_period_id, exception_date, exception_type, reason, override_start_time, override_end_time, active, created_at, updated_at")
      .order("exception_date", { ascending: true }),
    supabase
      .from("reservation_availability_audit_events")
      .select("id, business_id, restaurant_id, entity_type, entity_id, change_type, previous_values, new_values, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const roles = new Map(
    (membershipsResult.data || []).map((membership) => [
      membership.business_id,
      membership.role,
    ])
  );
  const businesses = (businessesResult.data || []).map((business) => ({
    ...business,
    role: roles.get(business.id) || "staff",
  })) as AvailabilityBusiness[];

  return {
    user,
    businesses,
    restaurants: (restaurantsResult.data || []) as AvailabilityRestaurant[],
    periods: (periodsResult.data || []) as BusinessServicePeriod[],
    capacities: (capacitiesResult.data || []) as ReservationCapacitySetting[],
    areas: (areasResult.data || []) as RestaurantArea[],
    exceptions: (exceptionsResult.data || []) as AvailabilityException[],
    auditEvents: (auditResult.data || []) as ReservationAvailabilityAuditEvent[],
    error: membershipsResult.error
      || businessesResult.error
      || restaurantsResult.error
      || periodsResult.error
      || capacitiesResult.error
      || areasResult.error
      || exceptionsResult.error
      || auditResult.error,
  };
}
