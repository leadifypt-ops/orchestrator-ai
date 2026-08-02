import { AvailabilityHeader } from "../availability-navigation";
import { CapacityForm } from "../availability-forms";
import { loadAvailabilityFoundation } from "../data";

export const dynamic = "force-dynamic";

export default async function CapacityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await loadAvailabilityFoundation();
  return <div className="space-y-6 p-6 text-white">
    <AvailabilityHeader locale={locale} />
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div><h2 className="text-xl font-semibold">Capacity by service period</h2><p className="mt-1 text-sm text-zinc-500">Maximum covers, simultaneous reservations and interval limits are planning inputs only.</p></div>
      {data.periods.map((period) => <CapacityForm key={period.id} businesses={data.businesses} restaurants={data.restaurants} period={period} capacity={data.capacities.find((capacity) => capacity.service_period_id === period.id)} />)}
      {data.periods.length === 0 ? <p className="text-sm text-zinc-600">Create a service period before configuring capacity.</p> : null}
    </section>
  </div>;
}
