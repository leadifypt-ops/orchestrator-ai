import { createClient } from "@/lib/supabase/server";
import type { ReservationCommunication } from "@/lib/reservation-communication";
import { CommunicationCard, CreateConfirmationDraft } from "../../communications/communication-controls";

export async function ReservationCommunications({ reservationId, reservationStatus, locale }: { reservationId: string; reservationStatus: string; locale: string }) {
  const supabase = await createClient();
  const result = await supabase.rpc("list_reservation_communications", { p_reservation_id: reservationId });
  const communications = (result.data || []) as ReservationCommunication[];
  return <section className="space-y-4 rounded-2xl border border-sky-300/20 bg-sky-300/[0.04] p-5">
    <div><p className="text-xs uppercase tracking-[0.18em] text-sky-200/70">Human-reviewed workflow</p><h2 className="mt-2 text-xl font-semibold">Guest Communication</h2><p className="mt-2 text-sm text-zinc-400">Draft and record communication without automatic dispatch.</p></div>
    {reservationStatus === "accepted" ? <CreateConfirmationDraft reservationId={reservationId} locale={locale} /> : <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">Confirmation drafts are available only after the reservation is accepted.</p>}
    {result.error ? <p className="text-sm text-red-300">{result.error.message}</p> : null}
    <div className="space-y-3">{communications.map(item => <CommunicationCard key={item.id} communication={item} />)}{!communications.length ? <p className="text-sm text-zinc-500">No guest communications recorded.</p> : null}</div>
  </section>;
}
