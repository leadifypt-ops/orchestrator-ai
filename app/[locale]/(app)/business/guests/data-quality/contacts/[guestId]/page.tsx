import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DataQualityForm from "../../data-quality-form";
import { updateCompanionContact } from "../../actions";

type ContactPageProps = {
  params: Promise<{ locale: string; guestId: string }>;
};

type ReservationGuestContactRow = {
  id: string;
  reservation_id: string | null;
  canonical_reservation_id: string | null;
  guest_identity_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  guest_position: number;
  is_host: boolean;
};

export const dynamic = "force-dynamic";

export default async function CompanionContactPage({
  params,
}: ContactPageProps) {
  const { locale, guestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("reservation_guests")
    .select(
      "id, reservation_id, canonical_reservation_id, guest_identity_id, full_name, email, phone, guest_position, is_host"
    )
    .eq("id", guestId)
    .maybeSingle();
  const guest = data as ReservationGuestContactRow | null;

  if (!guest) notFound();

  let authorized = false;
  if (guest.canonical_reservation_id) {
    const { data: reservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("id", guest.canonical_reservation_id)
      .maybeSingle();
    authorized = Boolean(reservation);
  } else if (guest.reservation_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", guest.reservation_id)
      .eq("user_id", user?.id)
      .maybeSingle();
    authorized = Boolean(lead);
  }

  if (!authorized) notFound();

  const action = updateCompanionContact.bind(null, guest.id);

  return (
    <div className="space-y-6 p-6 text-white">
      <Link
        href={`/${locale}/business/guests/data-quality`}
        className="text-sm text-zinc-500 hover:text-white"
      >
        Back to data quality
      </Link>
      <section className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Companion contact
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Complete guest identity
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Email and phone are optional, but at least one is needed to create or
          associate a stable identity. Matching remains email first, then
          normalized phone; the name is never a matching key.
        </p>
        <div className="mt-6">
          <DataQualityForm
            action={action}
            submitLabel="Save contact"
            fields={[
              {
                name: "full_name",
                label: "Guest name",
                value: guest.full_name || "",
              },
              {
                name: "email",
                label: "Email (optional)",
                value: guest.email || "",
                type: "email",
              },
              {
                name: "phone",
                label: "Phone (optional)",
                value: guest.phone || "",
                type: "tel",
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
