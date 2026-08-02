"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  AvailabilityBusiness,
  AvailabilityRestaurant,
  BusinessServicePeriod,
} from "@/lib/availability";
import {
  CALENDAR_EXCEPTION_TYPES,
  ISO_WEEKDAYS,
  calendarExceptionLabels,
  type CalendarExceptionType,
  type RecurringAvailabilityException,
  type ServicePeriodCalendarSetting,
} from "@/lib/availability-projection";
import {
  initialCalendarActionState,
  saveCalendarDateException,
  saveRecurringException,
  saveServiceCalendar,
} from "./calendar-actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white disabled:opacity-50";

function canManage(businesses: AvailabilityBusiness[], businessId: string) {
  const role = businesses.find((business) => business.id === businessId)?.role;
  return role === "owner" || role === "manager";
}

function Feedback({ status, message }: { status: string; message: string }) {
  if (!message) return null;
  return (
    <p aria-live="polite" className={status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
      {message}
    </p>
  );
}

function WeekdayFields({ defaultValues }: { defaultValues: number[] }) {
  return (
    <fieldset className="md:col-span-full">
      <legend className="text-xs text-zinc-500">Weekdays</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {ISO_WEEKDAYS.map((weekday) => (
          <label key={weekday.value} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              name="operating_weekdays"
              value={weekday.value}
              defaultChecked={defaultValues.includes(weekday.value)}
            />
            {weekday.short}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ServiceCalendarForm({
  businesses,
  period,
  setting,
}: {
  businesses: AvailabilityBusiness[];
  period: BusinessServicePeriod;
  setting?: ServicePeriodCalendarSetting;
}) {
  const [state, action, pending] = useActionState(
    saveServiceCalendar,
    initialCalendarActionState
  );
  const allowed = canManage(businesses, period.business_id);
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-2">
      <input type="hidden" name="service_period_id" value={period.id} />
      <div className="md:col-span-full">
        <h3 className="font-medium">{period.name}</h3>
        <p className="mt-1 text-xs text-zinc-600">
          {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)} · unchecked days are regularly closed.
        </p>
      </div>
      <WeekdayFields defaultValues={setting?.operating_weekdays ?? [1, 2, 3, 4, 5, 6, 7]} />
      <div className="flex flex-wrap items-center gap-3 md:col-span-full">
        <button disabled={!allowed || pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Saving..." : "Save operating days"}
        </button>
        <Feedback status={state.status} message={state.message} />
        {!allowed ? <span className="text-xs text-zinc-600">Owner or manager role required.</span> : null}
      </div>
    </form>
  );
}

function ExceptionTypeFields({
  initialType,
  initialStart,
  initialEnd,
  pending,
}: {
  initialType: CalendarExceptionType;
  initialStart?: string | null;
  initialEnd?: string | null;
  pending: boolean;
}) {
  const [exceptionType, setExceptionType] = useState<CalendarExceptionType>(initialType);
  return (
    <>
      <label className="text-xs text-zinc-500">Type
        <select
          name="exception_type"
          value={exceptionType}
          onChange={(event) => setExceptionType(event.target.value as CalendarExceptionType)}
          disabled={pending}
          className={inputClass}
        >
          {CALENDAR_EXCEPTION_TYPES.map((type) => (
            <option key={type} value={type}>{calendarExceptionLabels[type]}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-500">Override start
        <input name="override_start_time" type="time" required={exceptionType === "reduced_hours"} defaultValue={initialStart?.slice(0, 5) || ""} disabled={pending || exceptionType !== "reduced_hours"} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Override end
        <input name="override_end_time" type="time" required={exceptionType === "reduced_hours"} defaultValue={initialEnd?.slice(0, 5) || ""} disabled={pending || exceptionType !== "reduced_hours"} className={inputClass} />
      </label>
    </>
  );
}

export function CalendarDateExceptionForm({
  businesses,
  restaurant,
  periods,
  defaultDate,
}: {
  businesses: AvailabilityBusiness[];
  restaurant: AvailabilityRestaurant;
  periods: BusinessServicePeriod[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(
    saveCalendarDateException,
    initialCalendarActionState
  );
  const allowed = canManage(businesses, restaurant.business_id);
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-3">
      <input type="hidden" name="business_id" value={restaurant.business_id} />
      <input type="hidden" name="restaurant_id" value={restaurant.id} />
      <label className="text-xs text-zinc-500">Date
        <input name="exception_date" type="date" required defaultValue={defaultDate} disabled={!allowed || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Service period
        <select name="service_period_id" disabled={!allowed || pending} className={inputClass}>
          <option value="">All service periods</option>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
      </label>
      <ExceptionTypeFields initialType="special_day" pending={!allowed || pending} />
      <label className="text-xs text-zinc-500 md:col-span-2">Reason
        <input name="reason" required maxLength={500} placeholder="Holiday service or exceptional closure" disabled={!allowed || pending} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-full">
        <button disabled={!allowed || pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Saving..." : "Add date exception"}
        </button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function RecurringExceptionForm({
  businesses,
  restaurant,
  periods,
  exception,
  defaultDate,
}: {
  businesses: AvailabilityBusiness[];
  restaurant: AvailabilityRestaurant;
  periods: BusinessServicePeriod[];
  exception?: RecurringAvailabilityException;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(
    saveRecurringException,
    initialCalendarActionState
  );
  const allowed = canManage(businesses, restaurant.business_id);
  const visiblePeriods = useMemo(
    () => periods.filter((period) => period.restaurant_id === restaurant.id),
    [periods, restaurant.id]
  );
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-4">
      <input type="hidden" name="business_id" value={restaurant.business_id} />
      <input type="hidden" name="restaurant_id" value={restaurant.id} />
      {exception ? <input type="hidden" name="exception_id" value={exception.id} /> : null}
      <label className="text-xs text-zinc-500">Service period
        <select name="service_period_id" defaultValue={exception?.service_period_id || ""} disabled={!allowed || pending} className={inputClass}>
          <option value="">All service periods</option>
          {visiblePeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-500">Valid from
        <input name="valid_from" type="date" required defaultValue={exception?.valid_from || defaultDate} disabled={!allowed || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Valid until
        <input name="valid_until" type="date" defaultValue={exception?.valid_until || ""} disabled={!allowed || pending} className={inputClass} />
      </label>
      <ExceptionTypeFields
        initialType={exception?.exception_type || "closed"}
        initialStart={exception?.override_start_time}
        initialEnd={exception?.override_end_time}
        pending={!allowed || pending}
      />
      <WeekdayFields defaultValues={exception?.operating_weekdays ?? [1]} />
      <label className="text-xs text-zinc-500 md:col-span-3">Reason
        <input name="reason" required maxLength={500} defaultValue={exception?.reason || ""} placeholder="Regular weekly closure" disabled={!allowed || pending} className={inputClass} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-zinc-400">
        <input name="active" type="checkbox" defaultChecked={exception?.active ?? true} disabled={!allowed || pending} /> Active
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-full">
        <button disabled={!allowed || pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Saving..." : exception ? "Update recurring exception" : "Add recurring exception"}
        </button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}
