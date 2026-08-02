import {
  availabilityProjectionLabels,
  calendarExceptionLabels,
  formatProjectionTime,
  operatingWeekdaysLabel,
  type AvailabilityProjectionStatus,
} from "@/lib/availability-projection";
import { AvailabilityHeader } from "../availability-navigation";
import {
  CalendarDateExceptionForm,
  RecurringExceptionForm,
  ServiceCalendarForm,
} from "../calendar-forms";
import {
  loadAvailabilityProjection,
  loadServiceCalendarConfiguration,
} from "../calendar-data";

export const dynamic = "force-dynamic";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function validDate(value: string | string[] | undefined, fallback: string) {
  const candidate = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate))
    ? candidate
    : fallback;
}

function number(value: number | string | null | undefined) {
  return Number(value || 0);
}

const statusClasses: Record<AvailabilityProjectionStatus, string> = {
  available: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  near_capacity: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  high_capacity: "border-orange-400/25 bg-orange-400/10 text-orange-200",
  fully_occupied: "border-red-400/25 bg-red-400/10 text-red-200",
  closed: "border-zinc-500/25 bg-zinc-500/10 text-zinc-300",
  not_configured: "border-sky-400/25 bg-sky-400/10 text-sky-200",
};

function StatusBadge({ status }: { status: AvailabilityProjectionStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClasses[status]}`}>
      {availabilityProjectionLabels[status]}
    </span>
  );
}

export default async function ServiceCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    restaurant?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const [{ locale }, query, configuration] = await Promise.all([
    params,
    searchParams,
    loadServiceCalendarConfiguration(),
  ]);
  const today = new Date();
  const fallbackFrom = dateOnly(today);
  const fallbackTo = dateOnly(addDays(today, 13));
  const dateFrom = validDate(query.from, fallbackFrom);
  let dateTo = validDate(query.to, fallbackTo);
  const rangeDays = Math.floor(
    (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000
  );
  if (rangeDays < 0 || rangeDays > 31) dateTo = fallbackTo;

  const requestedRestaurantId = typeof query.restaurant === "string"
    ? query.restaurant
    : "";
  const selectedRestaurant = configuration.restaurants.find(
    (restaurant) => restaurant.id === requestedRestaurantId
  ) || configuration.restaurants[0];
  const periods = selectedRestaurant
    ? configuration.periods.filter(
      (period) => period.restaurant_id === selectedRestaurant.id
    )
    : [];
  const recurringExceptions = selectedRestaurant
    ? configuration.recurringExceptions.filter(
      (exception) => exception.restaurant_id === selectedRestaurant.id
    )
    : [];
  const projectionData = selectedRestaurant
    ? await loadAvailabilityProjection(
      selectedRestaurant.business_id,
      selectedRestaurant.id,
      dateFrom,
      dateTo
    )
    : {
      calendar: [],
      projection: [],
      summaries: [],
      exceptionOccurrences: [],
      error: null,
    };

  const rangeCapacity = projectionData.summaries.reduce(
    (total, summary) => total + number(summary.total_capacity),
    0
  );
  const rangeUsed = projectionData.summaries.reduce(
    (total, summary) => total + number(summary.capacity_used),
    0
  );
  const rangeRemaining = projectionData.summaries.reduce(
    (total, summary) => total + number(summary.capacity_remaining),
    0
  );
  const rangeReservations = projectionData.summaries.reduce(
    (total, summary) => total + number(summary.reservation_count),
    0
  );
  const rangeOccupancy = rangeCapacity > 0
    ? Math.round((rangeUsed * 1000) / rangeCapacity) / 10
    : null;
  const rangeCards = [
    ["Total capacity", rangeCapacity, "Open service periods in range"],
    ["Capacity used", rangeUsed, `${rangeReservations} existing reservations`],
    ["Capacity remaining", rangeRemaining, "Informational projection only"],
    ["Occupancy", rangeOccupancy === null ? "—" : `${rangeOccupancy}%`, "Never blocks a reservation"],
  ] as const;

  return (
    <div className="space-y-6 p-6 text-white">
      <AvailabilityHeader locale={locale} />
      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Block 42</p>
        <h2 className="mt-2 text-2xl font-semibold">Service calendar & informational availability</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          The projection combines operating days, active service periods, configured capacity,
          existing canonical reservations and exceptions. It does not promise a table, block a
          request or change reservation status.
        </p>
      </section>

      <form method="get" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:grid-cols-4">
        <label className="text-xs text-zinc-500">Restaurant
          <select name="restaurant" defaultValue={selectedRestaurant?.id || ""} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
            {configuration.restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {configuration.businesses.find((business) => business.id === restaurant.business_id)?.name || "Business"} / {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">From
          <input name="from" type="date" defaultValue={dateFrom} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-xs text-zinc-500">To
          <input name="to" type="date" defaultValue={dateTo} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white" />
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Update projection</button>
        </div>
        <p className="text-xs text-zinc-600 md:col-span-full">Maximum dashboard range: 32 operational days. Read RPCs repeat Business and Restaurant authorization.</p>
      </form>

      {!selectedRestaurant ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-200">
          No restaurant is available in the current Business scope.
        </div>
      ) : null}
      {configuration.error || configuration.calendarConfigurationError || projectionData.error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-200">
          Could not load the complete service calendar: {(configuration.error || configuration.calendarConfigurationError || projectionData.error)?.message}
        </div>
      ) : null}

      {selectedRestaurant ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {rangeCards.map(([label, value, note]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
                <p className="mt-2 text-sm text-zinc-500">{note}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="p-5">
              <h2 className="text-xl font-semibold">Daily operational calendar</h2>
              <p className="mt-1 text-sm text-zinc-500">Daily totals aggregate only the selected restaurant and preserve exceptions as context.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-white/10 bg-black/30 text-xs uppercase tracking-wider text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Periods</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Occupancy</th>
                    <th className="px-4 py-3">Reservations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projectionData.summaries.map((summary) => (
                    <tr key={summary.operational_date}>
                      <td className="px-4 py-3 font-medium">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${summary.operational_date}T00:00:00Z`))}</td>
                      <td className="px-4 py-3"><StatusBadge status={summary.availability_status} /></td>
                      <td className="px-4 py-3 text-zinc-400">{number(summary.open_service_period_count)} / {number(summary.service_period_count)} open</td>
                      <td className="px-4 py-3">{number(summary.total_capacity)}</td>
                      <td className="px-4 py-3">{number(summary.capacity_used)}</td>
                      <td className="px-4 py-3">{number(summary.capacity_remaining)}</td>
                      <td className="px-4 py-3">{summary.occupancy_percent === null ? "—" : `${number(summary.occupancy_percent)}%`}</td>
                      <td className="px-4 py-3">{number(summary.reservation_count)}{number(summary.reservations_outside_effective_hours) > 0 ? <span className="ml-2 text-xs text-amber-300">{number(summary.reservations_outside_effective_hours)} outside hours</span> : null}</td>
                    </tr>
                  ))}
                  {projectionData.summaries.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600">No active service periods for this range.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="p-5">
              <h2 className="text-xl font-semibold">Projection by service period</h2>
              <p className="mt-1 text-sm text-zinc-500">Existing reservations include canonical statuses except declined and cancelled. Over-capacity percentages remain visible.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-white/10 bg-black/30 text-xs uppercase tracking-wider text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date / period</th>
                    <th className="px-4 py-3">Effective hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Used / remaining</th>
                    <th className="px-4 py-3">Reservations</th>
                    <th className="px-4 py-3">Exception</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projectionData.projection.map((row) => (
                    <tr key={`${row.operational_date}-${row.service_period_id}`}>
                      <td className="px-4 py-3"><p className="font-medium">{row.operational_date}</p><p className="text-xs text-zinc-500">{row.service_period_name}</p></td>
                      <td className="px-4 py-3 text-zinc-400">{formatProjectionTime(row.effective_start_time)}–{formatProjectionTime(row.effective_end_time)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.availability_status} /></td>
                      <td className="px-4 py-3">{row.configured_capacity === null ? "—" : number(row.total_capacity)}<p className="text-xs text-zinc-600">{row.interval_minutes ? `${row.max_covers_per_interval} / ${row.interval_minutes} min` : "No interval config"}</p></td>
                      <td className="px-4 py-3">{number(row.capacity_used)} / {number(row.capacity_remaining)}<p className="text-xs text-zinc-600">{row.occupancy_percent === null ? "—" : `${number(row.occupancy_percent)}%`}</p></td>
                      <td className="px-4 py-3">{number(row.reservation_count)}{number(row.reservations_outside_effective_hours) > 0 ? <p className="text-xs text-amber-300">{number(row.reservations_outside_effective_hours)} outside effective hours</p> : null}</td>
                      <td className="px-4 py-3">{row.exception_type ? <><p className="text-zinc-300">{calendarExceptionLabels[row.exception_type]}</p><p className="max-w-xs text-xs text-zinc-600">{row.exception_reason}</p></> : <span className="text-zinc-700">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div><h2 className="text-xl font-semibold">Weekly operating days</h2><p className="mt-1 text-sm text-zinc-500">Configuration is independent for every service period at {selectedRestaurant.name}.</p></div>
            {periods.map((period) => (
              <ServiceCalendarForm
                key={period.id}
                businesses={configuration.businesses}
                period={period}
                setting={configuration.calendarSettings.find((setting) => setting.service_period_id === period.id)}
              />
            ))}
            {periods.length === 0 ? <p className="text-sm text-zinc-600">Create an active service period before configuring its weekly calendar.</p> : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div><h2 className="text-xl font-semibold">Special date</h2><p className="mt-1 text-sm text-zinc-500">Record a closure, special day or reduced schedule for one date. Period-specific entries take precedence over restaurant-wide entries.</p></div>
            <CalendarDateExceptionForm businesses={configuration.businesses} restaurant={selectedRestaurant} periods={periods} defaultDate={dateFrom} />
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div><h2 className="text-xl font-semibold">Recurring exceptions</h2><p className="mt-1 text-sm text-zinc-500">Weekly exceptions use a validity range and remain governed, restaurant-scoped and append-only audited.</p></div>
            <RecurringExceptionForm businesses={configuration.businesses} restaurant={selectedRestaurant} periods={periods} defaultDate={dateFrom} />
            {recurringExceptions.map((exception) => (
              <RecurringExceptionForm key={exception.id} businesses={configuration.businesses} restaurant={selectedRestaurant} periods={periods} exception={exception} defaultDate={dateFrom} />
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-semibold">Exception occurrences in range</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {projectionData.exceptionOccurrences.map((occurrence) => (
                <div key={`${occurrence.occurrence_date}-${occurrence.exception_source}-${occurrence.exception_id}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span>{occurrence.occurrence_date} · {calendarExceptionLabels[occurrence.exception_type]}</span><span className="text-xs text-zinc-600">{occurrence.exception_source === "one_off" ? "One-off" : "Recurring"}</span></div>
                  <p className="mt-1 text-xs text-zinc-500">{occurrence.reason}</p>
                  {occurrence.operating_weekdays ? <p className="mt-1 text-xs text-zinc-700">{operatingWeekdaysLabel(occurrence.operating_weekdays)}</p> : null}
                </div>
              ))}
              {projectionData.exceptionOccurrences.length === 0 ? <p className="text-sm text-zinc-600">No active exception occurrences in this range.</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
