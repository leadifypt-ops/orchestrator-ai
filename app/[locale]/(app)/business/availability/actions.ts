"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY_EXCEPTION_TYPES } from "@/lib/availability";

export type AvailabilityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAvailabilityActionState: AvailabilityActionState = {
  status: "idle",
  message: "",
};

function value(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate.trim() : "";
}

function integer(formData: FormData, name: string) {
  const candidate = Number(value(formData, name));
  return Number.isInteger(candidate) ? candidate : null;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function optional(formData: FormData, name: string) {
  return value(formData, name) || null;
}

function error(message: string): AvailabilityActionState {
  return { status: "error", message };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function finish(changed: unknown, label: string): AvailabilityActionState {
  revalidatePath("/[locale]/business/availability", "layout");
  return {
    status: "success",
    message: changed ? `${label} saved and audited.` : `${label} is already up to date.`,
  };
}

export async function saveServicePeriod(
  _previous: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const businessId = value(formData, "business_id");
  const restaurantId = value(formData, "restaurant_id");
  const name = value(formData, "name");
  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");
  if (!businessId || !restaurantId || !name || name.length > 100
    || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)
    || startTime === endTime) {
    return error("Provide a restaurant, name and distinct valid service times.");
  }
  const { data, error: rpcError } = await supabase.rpc(
    "save_business_service_period_v1",
    {
      p_business_id: businessId,
      p_restaurant_id: restaurantId,
      p_name: name,
      p_start_time: startTime,
      p_end_time: endTime,
      p_active: checked(formData, "active"),
      p_period_id: optional(formData, "period_id"),
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Service period");
}

export async function saveCapacity(
  _previous: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const servicePeriodId = value(formData, "service_period_id");
  const maxCovers = integer(formData, "max_covers");
  const maxSimultaneous = integer(formData, "max_simultaneous_reservations");
  const intervalMinutes = integer(formData, "interval_minutes");
  const maxPerInterval = integer(formData, "max_covers_per_interval");
  if (!servicePeriodId || maxCovers === null || maxSimultaneous === null
    || intervalMinutes === null || maxPerInterval === null
    || maxCovers < 1 || maxCovers > 5000
    || maxSimultaneous < 1 || maxSimultaneous > Math.min(500, maxCovers)
    || intervalMinutes < 5 || intervalMinutes > 240
    || maxPerInterval < 1 || maxPerInterval > maxCovers) {
    return error("Capacity values are invalid or exceed the service-period maximum.");
  }
  const { data, error: rpcError } = await supabase.rpc(
    "set_reservation_capacity_v1",
    {
      p_service_period_id: servicePeriodId,
      p_max_covers: maxCovers,
      p_max_simultaneous_reservations: maxSimultaneous,
      p_interval_minutes: intervalMinutes,
      p_max_covers_per_interval: maxPerInterval,
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Capacity");
}

export async function saveRestaurantArea(
  _previous: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const businessId = value(formData, "business_id");
  const restaurantId = value(formData, "restaurant_id");
  const name = value(formData, "name");
  if (!businessId || !restaurantId || !name || name.length > 100) {
    return error("Select a restaurant and provide an area name up to 100 characters.");
  }
  const { data, error: rpcError } = await supabase.rpc(
    "save_restaurant_area_v1",
    {
      p_business_id: businessId,
      p_restaurant_id: restaurantId,
      p_name: name,
      p_active: checked(formData, "active"),
      p_area_id: optional(formData, "area_id"),
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Restaurant area");
}

export async function saveAvailabilityException(
  _previous: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const businessId = value(formData, "business_id");
  const restaurantId = value(formData, "restaurant_id");
  const exceptionDate = value(formData, "exception_date");
  const exceptionType = value(formData, "exception_type");
  const reason = value(formData, "reason");
  const overrideStart = optional(formData, "override_start_time");
  const overrideEnd = optional(formData, "override_end_time");
  if (!businessId || !restaurantId || !/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)
    || !AVAILABILITY_EXCEPTION_TYPES.includes(exceptionType as never)
    || !reason || reason.length > 500
    || (exceptionType === "reduced_hours" && (!overrideStart || !overrideEnd || overrideStart === overrideEnd))) {
    return error("Provide a valid date, type, reason and reduced hours when required.");
  }
  const { data, error: rpcError } = await supabase.rpc(
    "save_availability_exception_v1",
    {
      p_business_id: businessId,
      p_restaurant_id: restaurantId,
      p_exception_date: exceptionDate,
      p_service_period_id: optional(formData, "service_period_id"),
      p_exception_type: exceptionType,
      p_reason: reason,
      p_active: checked(formData, "active"),
      p_override_start_time: overrideStart,
      p_override_end_time: overrideEnd,
      p_exception_id: optional(formData, "exception_id"),
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Availability exception");
}
