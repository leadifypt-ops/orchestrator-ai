import { AvailabilityHeader } from "../availability-navigation";
import { AvailabilityExceptionForm } from "../availability-forms";
import { loadAvailabilityFoundation } from "../data";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await loadAvailabilityFoundation();
  return <div className="space-y-6 p-6 text-white">
    <AvailabilityHeader locale={locale} />
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div><h2 className="text-xl font-semibold">Add availability exception</h2><p className="mt-1 text-sm text-zinc-500">Record closures, private events, maintenance or reduced hours. Reservations remain subject to human review.</p></div>
      <AvailabilityExceptionForm businesses={data.businesses} restaurants={data.restaurants} periods={data.periods} />
    </section>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xl font-semibold">Configured exceptions</h2>
      {data.exceptions.map((exception) => <AvailabilityExceptionForm key={exception.id} businesses={data.businesses} restaurants={data.restaurants} periods={data.periods} exception={exception} />)}
      {data.exceptions.length === 0 ? <p className="text-sm text-zinc-600">No availability exceptions configured.</p> : null}
    </section>
  </div>;
}
