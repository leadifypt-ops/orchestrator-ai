import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReservationCommunications } from "./reservation-communications";
import { GuestConfirmationAccess } from "./guest-confirmation-access";

export default async function ReservationDecisionLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: reservation } = await supabase.from("reservations").select("status").eq("id", id).maybeSingle();
  return <>{children}<div className="space-y-6 p-6 pt-0 text-white"><ReservationCommunications reservationId={id} reservationStatus={reservation?.status || "pending"} locale={locale} /><GuestConfirmationAccess reservationId={id} reservationStatus={reservation?.status || "pending"} locale={locale} /></div></>;
}
