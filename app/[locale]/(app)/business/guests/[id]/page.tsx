import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  consolidateGuest,
  formatGuestDate,
  getRestaurantName,
  getVisitDate,
  type GuestIdentityRow,
  type GuestReservationRow,
  type IdentityGuestProfileRow,
} from "@/lib/guest-history";

type GuestDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export const dynamic = "force-dynamic";

function ValueList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-zinc-500">None recorded</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300"
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

function HistoryCard({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xs uppercase tracking-[0.15em] text-zinc-600">
        {title}
      </h2>
      <div className="mt-4 text-sm">
        <ValueList values={values} />
      </div>
    </section>
  );
}

export default async function GuestDetailPage({
  params,
}: GuestDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: identityData } = await supabase
    .from("guest_identities")
    .select("id, full_name, email, phone, first_seen_at, last_seen_at")
    .eq("id", id)
    .maybeSingle();

  if (!identityData) notFound();

  const [reservationsResult, profilesResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, guest_identity_id, guest_name, requested_date, requested_time, party_size, status, occasion, special_request, created_at, restaurants!reservations_restaurant_id_fkey(name)"
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("reservation_guests")
      .select(
        "id, guest_identity_id, canonical_reservation_id, full_name, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
      )
      .eq("guest_identity_id", id),
  ]);

  const guest = consolidateGuest(
    identityData as GuestIdentityRow,
    ((reservationsResult.data as GuestReservationRow[] | null) || []).filter(
      (reservation) =>
        reservation.guest_identity_id === id ||
        ((profilesResult.data as IdentityGuestProfileRow[] | null) || []).some(
          (profile) => profile.canonical_reservation_id === reservation.id
        )
    ),
    (profilesResult.data as IdentityGuestProfileRow[] | null) || []
  );
  const firstVisit = guest.reservations[0];
  const lastVisit = guest.reservations.at(-1);
  const profilesByReservation = new Map(
    guest.profiles.map((profile) => [
      profile.canonical_reservation_id,
      profile.guest_dietary_profiles?.[0] || null,
    ])
  );

  return (
    <div className="space-y-6 p-6 text-white">
      <Link
        href={`/${locale}/business/guests`}
        className="inline-flex text-sm text-zinc-500 hover:text-white"
      >
        ← Back to consolidated guests
      </Link>

      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Consolidated guest
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">
              {guest.full_name?.trim() || "Known guest"}
            </h1>
            <div className="mt-3 space-y-1 text-sm text-zinc-400">
              {guest.email ? <p>{guest.email}</p> : null}
              {guest.phone ? <p>{guest.phone}</p> : null}
            </div>
          </div>
          <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            Read-only history
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-zinc-600">Total visits</p>
            <p className="mt-1 text-2xl font-semibold">
              {guest.reservations.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-zinc-600">First visit</p>
            <p className="mt-1 text-zinc-300">
              {formatGuestDate(
                firstVisit ? getVisitDate(firstVisit) : guest.first_seen_at
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-zinc-600">Last visit</p>
            <p className="mt-1 text-zinc-300">
              {formatGuestDate(
                lastVisit ? getVisitDate(lastVisit) : guest.last_seen_at
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <HistoryCard
          title="Historical wine preferences"
          values={guest.winePreferences}
        />
        <HistoryCard title="Historical dislikes" values={guest.dislikes} />
        <HistoryCard title="Historical allergies" values={guest.allergies} />
        <HistoryCard
          title="Historical intolerances"
          values={guest.intolerances}
        />
        <HistoryCard
          title="Historical dietary restrictions"
          values={guest.dietaryRestrictions}
        />
        <HistoryCard title="Previous occasions" values={guest.occasions} />
      </div>

      {(guest.notes.length > 0 || guest.reservationContexts.length > 0) && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
            Remembered context
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            {[...guest.reservationContexts, ...guest.notes].map(
              (context, index) => (
                <p
                  key={`${context}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  {context}
                </p>
              )
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
          Visit timeline
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          {guest.reservations.length} recorded visits
        </h2>

        {guest.reservations.length > 0 ? (
          <ol className="mt-6 space-y-4">
            {[...guest.reservations].reverse().map((reservation) => {
              const profile = profilesByReservation.get(reservation.id);
              const dietaryContext = [
                ...(profile?.allergies || []),
                ...(profile?.intolerances || []),
                ...(profile?.dietary_restrictions || []),
                ...(profile?.dislikes || []),
              ];

              return (
                <li
                  key={reservation.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {formatGuestDate(getVisitDate(reservation))} ·{" "}
                        {getRestaurantName(reservation)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {reservation.requested_time
                          ? reservation.requested_time.slice(0, 5)
                          : "Time not recorded"}
                        {" · "}
                        {reservation.party_size
                          ? `${reservation.party_size} guests`
                          : "Party size not recorded"}
                        {" · "}
                        {reservation.status}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/business/reservations/${reservation.id}`}
                      className="text-sm text-zinc-400 hover:text-white"
                    >
                      Open reservation
                    </Link>
                  </div>

                  {reservation.occasion || reservation.special_request ? (
                    <div className="mt-3 space-y-1 text-sm leading-6 text-zinc-300">
                      {reservation.occasion ? (
                        <p>
                          <span className="text-zinc-600">Occasion:</span>{" "}
                          {reservation.occasion}
                        </p>
                      ) : null}
                      {reservation.special_request ? (
                        <p>
                          <span className="text-zinc-600">Context:</span>{" "}
                          {reservation.special_request}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {(dietaryContext.length > 0 ||
                    profile?.wine_preferences) && (
                    <div className="mt-3 text-sm leading-6 text-zinc-400">
                      {dietaryContext.length > 0 ? (
                        <p>{dietaryContext.join(", ")}</p>
                      ) : null}
                      {profile?.wine_preferences ? (
                        <p>Wine: {profile.wine_preferences}</p>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No linked reservation history is available.
          </p>
        )}
      </section>
    </div>
  );
}
