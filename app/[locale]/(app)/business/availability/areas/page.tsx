import { AvailabilityHeader } from "../availability-navigation";
import { RestaurantAreaForm } from "../availability-forms";
import { loadAvailabilityFoundation } from "../data";

export const dynamic = "force-dynamic";

export default async function AreasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await loadAvailabilityFoundation();
  return <div className="space-y-6 p-6 text-white">
    <AvailabilityHeader locale={locale} />
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div><h2 className="text-xl font-semibold">Add restaurant area</h2><p className="mt-1 text-sm text-zinc-500">Areas prepare future seating models without introducing individual table management.</p></div>
      <RestaurantAreaForm businesses={data.businesses} restaurants={data.restaurants} />
    </section>
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xl font-semibold">Configured areas</h2>
      {data.areas.map((area) => <RestaurantAreaForm key={area.id} businesses={data.businesses} restaurants={data.restaurants} area={area} />)}
      {data.areas.length === 0 ? <p className="text-sm text-zinc-600">No restaurant areas configured.</p> : null}
    </section>
  </div>;
}
