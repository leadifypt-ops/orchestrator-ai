import { AvailabilityHeader } from "../availability-navigation";
import { ServicePeriodForm } from "../availability-forms";
import { loadAvailabilityFoundation } from "../data";

export const dynamic = "force-dynamic";

export default async function ServicePeriodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await loadAvailabilityFoundation();
  return <div className="space-y-6 p-6 text-white">
    <AvailabilityHeader locale={locale} />
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div><h2 className="text-xl font-semibold">Add service period</h2><p className="mt-1 text-sm text-zinc-500">Periods may cross midnight. They expose operating data but do not open booking inventory.</p></div>
      <ServicePeriodForm businesses={data.businesses} restaurants={data.restaurants} />
    </section>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xl font-semibold">Configured periods</h2>
      {data.periods.map((period) => <ServicePeriodForm key={period.id} businesses={data.businesses} restaurants={data.restaurants} period={period} />)}
      {data.periods.length === 0 ? <p className="text-sm text-zinc-600">No service periods configured.</p> : null}
    </section>
  </div>;
}
