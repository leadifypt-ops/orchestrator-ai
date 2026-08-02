"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CALENDAR_EXCEPTION_TYPES } from "@/lib/availability-projection";

export type CalendarActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCalendarActionState: CalendarActionState = {
  status: "idle",
  message: "",
};

function value(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate.trim() : "";
}

function optional(formData: FormData, name: string) {
  return value(formData, name) || null;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function weekdays(formData: FormData) {
  return formData
    .getAll("operating_weekdays")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);
}

function error(message: string): CalendarActionState {
  return { status: "error", message };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function finish(changed: unknown, label: string): CalendarActionState {
  revalidatePath("/[locale]/business/availability", "layout");
  return {
    status: "success",
    message: changed ? `${label} saved and audited.` : `${label} is already up to date.`,
  };
}

export async function saveServiceCalendar(
  _previous: CalendarActionState,
  formData: FormData
): Promise<CalendarActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const servicePeriodId = value(formData, "service_period_id");
  const operatingWeekdays = weekdays(formData);
  if (!servicePeriodId) return error("Select a valid service period.");
  const { data, error: rpcError } = await supabase.rpc(
    "save_service_period_calendar_v1",
    {
      p_service_period_id: servicePeriodId,
      p_operating_weekdays: operatingWeekdays,
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Service calendar");
}

export async function saveRecurringException(
  _previous: CalendarActionState,
  formData: FormData
): Promise<CalendarActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");
  const businessId = value(formData, "business_id");
  const restaurantId = value(formData, "restaurant_id");
  const operatingWeekdays = weekdays(formData);
  const validFrom = value(formData, "valid_from");
  const validUntil = optional(formData, "valid_until");
  const exceptionType = value(formData, "exception_type");
  const reason = value(formData, "reason");
  const overrideStart = optional(formData, "override_start_time");
  const overrideEnd = optional(formData, "override_end_time");
  if (!businessId || !restaurantId || operatingWeekdays.length === 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)
    || (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil))
    || (validUntil && validUntil < validFrom)
    || !CALENDAR_EXCEPTION_TYPES.includes(exceptionType as never)
    || !reason || reason.length > 500
    || (exceptionType === "reduced_hours"
      && (!overrideStart || !overrideEnd || overrideStart === overrideEnd))) {
    return error("Provide valid scope, weekdays, dates, type, reason and reduced hours.");
  }
  const { data, error: rpcError } = await supabase.rpc(
    "save_recurring_availability_exception_v1",
    {
      p_business_id: businessId,
      p_restaurant_id: restaurantId,
      p_service_period_id: optional(formData, "service_period_id"),
      p_operating_weekdays: operatingWeekdays,
      p_valid_from: validFrom,
      p_valid_until: validUntil,
      p_exception_type: exceptionType,
      p_reason: reason,
      p_active: checked(formData, "active"),
      p_override_start_time: overrideStart,
      p_override_end_time: overrideEnd,
      p_exception_id: optional(formData, "exception_id"),
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Recurring exception");
}

export async function saveCalendarDateException(
  _previous: CalendarActionState,
  formData: FormData
): Promise<CalendarActionState> {
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
    || !CALENDAR_EXCEPTION_TYPES.includes(exceptionType as never)
    || !reason || reason.length > 500
    || (exceptionType === "reduced_hours"
      && (!overrideStart || !overrideEnd || overrideStart === overrideEnd))) {
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
      p_active: true,
      p_override_start_time: overrideStart,
      p_override_end_time: overrideEnd,
      p_exception_id: null,
    }
  );
  if (rpcError) return error(rpcError.message);
  return finish((data as { changed?: unknown } | null)?.changed, "Calendar exception");
}
