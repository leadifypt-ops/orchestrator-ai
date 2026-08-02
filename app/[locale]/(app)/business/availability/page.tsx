import Link from "next/link";
import { availabilityExceptionLabels } from "@/lib/availability";
import { AvailabilityHeader } from "./availability-navigation";
import { loadAvailabilityFoundation } from "./data";

export const dynamic = "force-dynamic";

export default async function AvailabilityDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await loadAvailabilityFoundation();
  const configuredPeriods = new Set(data.capacities.map((capacity) => capacity.service_period_id));
  const cards = [
    ["Service periods", data.periods.filter((period) => period.active).length, "Define recurring operating windows", "/service-periods"],
    ["Capacity configured", configuredPeriods.size, `${data.periods.length - configuredPeriods.size} periods pending`, "/capacity"],
    ["Active areas", data.areas.filter((area) => area.active).length, "No individual tables in this block", "/areas"],
    ["Active exceptions", data.exceptions.filter((exception) => exception.active).length, "Closures and operational overrides", "/exceptions"],
  ] as const;

  return (
    <div className="space-y-6 p-6 text-white">
      <AvailabilityHeader locale={locale} />
      {data.error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load availability configuration: {data.error.message}</div> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note, suffix]) => (
          <Link key={label} href={`/${locale}/business/availability${suffix}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.05]">
            <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-zinc-500">{note}</p>
          </Link>
        ))}
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Operational readiness</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          A period becomes structurally ready when it has capacity data. Readiness remains informational and never changes reservation status or public submission behavior.
        </p>
        <div className="mt-4 space-y-2">
          {data.periods.map((period) => {
            const restaurant = data.restaurants.find((item) => item.id === period.restaurant_id);
            return <div key={period.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <span>{restaurant?.name || "Restaurant"} / {period.name}</span>
              <span className={configuredPeriods.has(period.id) ? "text-emerald-300" : "text-amber-300"}>{configuredPeriods.has(period.id) ? "Capacity configured" : "Capacity pending"}</span>
            </div>;
          })}
          {data.periods.length === 0 ? <p className="text-sm text-zinc-600">No service periods configured yet.</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Recent audited changes</h2>
        <div className="mt-4 space-y-2">
          {data.auditEvents.slice(0, 10).map((event) => (
            <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">
              <span className="capitalize text-zinc-200">{event.entity_type.replace("_", " ")} {event.change_type}</span>
              <span className="ml-2 text-xs text-zinc-600">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span>
              {event.entity_type === "exception" && typeof event.new_values.exception_type === "string" ? <p className="mt-1 text-xs text-zinc-600">{availabilityExceptionLabels[event.new_values.exception_type as keyof typeof availabilityExceptionLabels] || event.new_values.exception_type}</p> : null}
            </div>
          ))}
          {data.auditEvents.length === 0 ? <p className="text-sm text-zinc-600">No availability changes recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
