"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AVAILABILITY_EXCEPTION_TYPES,
  availabilityExceptionLabels,
  canManageAvailability,
  formatOperationalTime,
  type AvailabilityBusiness,
  type AvailabilityException,
  type AvailabilityRestaurant,
  type BusinessServicePeriod,
  type ReservationCapacitySetting,
  type RestaurantArea,
} from "@/lib/availability";
import {
  initialAvailabilityActionState,
  saveAvailabilityException,
  saveCapacity,
  saveRestaurantArea,
  saveServicePeriod,
} from "./actions";

type ScopeProps = {
  businesses: AvailabilityBusiness[];
  restaurants: AvailabilityRestaurant[];
};

const inputClass = "mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white disabled:opacity-50";

function Feedback({ status, message }: { status: string; message: string }) {
  if (!message) return null;
  return <p className={status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>{message}</p>;
}

function roleFor(businesses: AvailabilityBusiness[], businessId: string) {
  return businesses.find((business) => business.id === businessId)?.role || "staff";
}

function RestaurantScope({
  businesses,
  restaurants,
  restaurantId,
  onChange,
  disabled,
}: ScopeProps & {
  restaurantId: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return <label className="text-xs text-zinc-500">
    Restaurant
    <select
      name="restaurant_id"
      value={restaurantId}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required
      className={inputClass}
    >
      <option value="">Select restaurant</option>
      {restaurants.map((restaurant) => (
        <option key={restaurant.id} value={restaurant.id}>
          {businesses.find((business) => business.id === restaurant.business_id)?.name || "Business"} / {restaurant.name}
        </option>
      ))}
    </select>
  </label>;
}

export function ServicePeriodForm({
  businesses,
  restaurants,
  period,
}: ScopeProps & { period?: BusinessServicePeriod }) {
  const [state, action, pending] = useActionState(saveServicePeriod, initialAvailabilityActionState);
  const [restaurantId, setRestaurantId] = useState(period?.restaurant_id || restaurants[0]?.id || "");
  const restaurant = restaurants.find((item) => item.id === restaurantId);
  const businessId = period?.business_id || restaurant?.business_id || "";
  const canManage = canManageAvailability(roleFor(businesses, businessId));

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-5">
      <input type="hidden" name="business_id" value={businessId} />
      {period ? <>
        <input type="hidden" name="restaurant_id" value={period.restaurant_id} />
        <input type="hidden" name="period_id" value={period.id} />
        <p className="self-end pb-2 text-sm text-zinc-400">{restaurant?.name || "Restaurant"}</p>
      </> : (
        <RestaurantScope businesses={businesses} restaurants={restaurants} restaurantId={restaurantId} onChange={setRestaurantId} disabled={pending} />
      )}
      <label className="text-xs text-zinc-500">Name
        <input name="name" required maxLength={100} defaultValue={period?.name || ""} disabled={!canManage || pending} placeholder="Dinner" className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Start
        <input name="start_time" type="time" required defaultValue={period ? formatOperationalTime(period.start_time) : "19:00"} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">End
        <input name="end_time" type="time" required defaultValue={period ? formatOperationalTime(period.end_time) : "23:00"} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-zinc-400">
        <input name="active" type="checkbox" defaultChecked={period?.active ?? true} disabled={!canManage || pending} /> Active
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-5">
        <button disabled={!canManage || pending || !restaurantId} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Saving..." : period ? "Update period" : "Add service period"}
        </button>
        <Feedback status={state.status} message={state.message} />
        {!canManage ? <span className="text-xs text-zinc-600">Owner or manager role required.</span> : null}
      </div>
    </form>
  );
}

export function CapacityForm({
  businesses,
  restaurants,
  period,
  capacity,
}: ScopeProps & {
  period: BusinessServicePeriod;
  capacity?: ReservationCapacitySetting;
}) {
  const [state, action, pending] = useActionState(saveCapacity, initialAvailabilityActionState);
  const canManage = canManageAvailability(roleFor(businesses, period.business_id));
  const restaurant = restaurants.find((item) => item.id === period.restaurant_id);
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-4">
      <input type="hidden" name="service_period_id" value={period.id} />
      <div className="md:col-span-4">
        <h3 className="font-medium">{restaurant?.name || "Restaurant"} / {period.name}</h3>
        <p className="mt-1 text-xs text-zinc-600">Informational inputs only; reservations remain manually reviewed.</p>
      </div>
      <label className="text-xs text-zinc-500">Maximum covers
        <input name="max_covers" type="number" min={1} max={5000} required defaultValue={capacity?.max_covers || 80} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Simultaneous reservations
        <input name="max_simultaneous_reservations" type="number" min={1} max={500} required defaultValue={capacity?.max_simultaneous_reservations || 10} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Interval minutes
        <input name="interval_minutes" type="number" min={5} max={240} required defaultValue={capacity?.interval_minutes || 15} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Covers per interval
        <input name="max_covers_per_interval" type="number" min={1} max={5000} required defaultValue={capacity?.max_covers_per_interval || 20} disabled={!canManage || pending} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <button disabled={!canManage || pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pending ? "Saving..." : "Save capacity"}</button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function RestaurantAreaForm({
  businesses,
  restaurants,
  area,
}: ScopeProps & { area?: RestaurantArea }) {
  const [state, action, pending] = useActionState(saveRestaurantArea, initialAvailabilityActionState);
  const [restaurantId, setRestaurantId] = useState(area?.restaurant_id || restaurants[0]?.id || "");
  const restaurant = restaurants.find((item) => item.id === restaurantId);
  const businessId = area?.business_id || restaurant?.business_id || "";
  const canManage = canManageAvailability(roleFor(businesses, businessId));
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-3">
      <input type="hidden" name="business_id" value={businessId} />
      {area ? <>
        <input type="hidden" name="restaurant_id" value={area.restaurant_id} />
        <input type="hidden" name="area_id" value={area.id} />
        <p className="self-end pb-2 text-sm text-zinc-400">{restaurant?.name || "Restaurant"}</p>
      </> : (
        <RestaurantScope businesses={businesses} restaurants={restaurants} restaurantId={restaurantId} onChange={setRestaurantId} disabled={pending} />
      )}
      <label className="text-xs text-zinc-500">Area name
        <input name="name" required maxLength={100} defaultValue={area?.name || ""} disabled={!canManage || pending} placeholder="Main dining room" className={inputClass} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-zinc-400"><input name="active" type="checkbox" defaultChecked={area?.active ?? true} disabled={!canManage || pending} /> Active</label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <button disabled={!canManage || pending || !restaurantId} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pending ? "Saving..." : area ? "Update area" : "Add area"}</button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function AvailabilityExceptionForm({
  businesses,
  restaurants,
  periods,
  exception,
}: ScopeProps & {
  periods: BusinessServicePeriod[];
  exception?: AvailabilityException;
}) {
  const [state, action, pending] = useActionState(saveAvailabilityException, initialAvailabilityActionState);
  const [restaurantId, setRestaurantId] = useState(exception?.restaurant_id || restaurants[0]?.id || "");
  const [exceptionType, setExceptionType] = useState(exception?.exception_type || "closed");
  const restaurant = restaurants.find((item) => item.id === restaurantId);
  const businessId = exception?.business_id || restaurant?.business_id || "";
  const canManage = canManageAvailability(roleFor(businesses, businessId));
  const availablePeriods = useMemo(
    () => periods.filter((period) => period.restaurant_id === restaurantId),
    [periods, restaurantId]
  );
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-4">
      <input type="hidden" name="business_id" value={businessId} />
      {exception ? <input type="hidden" name="exception_id" value={exception.id} /> : null}
      {exception ? <input type="hidden" name="restaurant_id" value={exception.restaurant_id} /> : (
        <RestaurantScope businesses={businesses} restaurants={restaurants} restaurantId={restaurantId} onChange={setRestaurantId} disabled={pending} />
      )}
      <label className="text-xs text-zinc-500">Date
        <input name="exception_date" type="date" required defaultValue={exception?.exception_date || ""} disabled={!canManage || pending} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Service period
        <select name="service_period_id" defaultValue={exception?.service_period_id || ""} disabled={!canManage || pending} className={inputClass}>
          <option value="">All service periods</option>
          {availablePeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-500">Type
        <select name="exception_type" value={exceptionType} onChange={(event) => setExceptionType(event.target.value as typeof exceptionType)} disabled={!canManage || pending} className={inputClass}>
          {AVAILABILITY_EXCEPTION_TYPES.map((type) => <option key={type} value={type}>{availabilityExceptionLabels[type]}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-500 md:col-span-2">Reason
        <input name="reason" required maxLength={500} defaultValue={exception?.reason || ""} disabled={!canManage || pending} placeholder="Private event" className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Override start
        <input name="override_start_time" type="time" required={exceptionType === "reduced_hours"} defaultValue={exception?.override_start_time ? formatOperationalTime(exception.override_start_time) : ""} disabled={!canManage || pending || exceptionType !== "reduced_hours"} className={inputClass} />
      </label>
      <label className="text-xs text-zinc-500">Override end
        <input name="override_end_time" type="time" required={exceptionType === "reduced_hours"} defaultValue={exception?.override_end_time ? formatOperationalTime(exception.override_end_time) : ""} disabled={!canManage || pending || exceptionType !== "reduced_hours"} className={inputClass} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-zinc-400"><input name="active" type="checkbox" defaultChecked={exception?.active ?? true} disabled={!canManage || pending} /> Active</label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <button disabled={!canManage || pending || !restaurantId} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pending ? "Saving..." : exception ? "Update exception" : "Add exception"}</button>
        <Feedback status={state.status} message={state.message} />
      </div>
    </form>
  );
}
