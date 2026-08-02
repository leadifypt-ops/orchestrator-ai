import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  consolidateGuest,
  formatGuestDate,
  getVisitDate,
  type GuestIdentityRow,
  type GuestReservationRow,
  type IdentityGuestProfileRow,
} from "@/lib/guest-history";

type GuestsPageProps = {
  params: Promise<{ locale: string }>;
};

type ReservationOnlyGuestRow = IdentityGuestProfileRow & {
  reservation_id: string | null;
};

export const dynamic = "force-dynamic";

function summarize(values: string[], empty = "None recorded") {
  if (values.length === 0) return empty;
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
}

function ProfileSummary({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-zinc-300">
        {summarize(values)}
      </p>
    </div>
  );
}

export default async function GuestsPage({ params }: GuestsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: identityData = [] } = await supabase
    .from("guest_identities")
    .select("id, full_name, email, phone, first_seen_at, last_seen_at")
    .order("last_seen_at", { ascending: false });

  const identities = (identityData as GuestIdentityRow[]) || [];
  const identityIds = identities.map((identity) => identity.id);
  let reservations: GuestReservationRow[] = [];
  let linkedProfiles: IdentityGuestProfileRow[] = [];

  if (identityIds.length > 0) {
    const [reservationsResult, profilesResult] = await Promise.all([
      supabase
        .from("reservations")
        .select(
          "id, guest_identity_id, guest_name, requested_date, requested_time, party_size, status, occasion, special_request, created_at, restaurants!reservations_restaurant_id_fkey(name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("reservation_guests")
        .select(
          "id, guest_identity_id, canonical_reservation_id, full_name, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
        )
        .in("guest_identity_id", identityIds),
    ]);

    reservations =
      (reservationsResult.data as GuestReservationRow[] | null) || [];
    linkedProfiles =
      (profilesResult.data as IdentityGuestProfileRow[] | null) || [];
  }

  const consolidatedGuests = identities.map((identity) =>
    consolidateGuest(
      identity,
      reservations.filter(
        (reservation) =>
          reservation.guest_identity_id === identity.id ||
          linkedProfiles.some(
            (profile) =>
              profile.guest_identity_id === identity.id &&
              profile.canonical_reservation_id === reservation.id
          )
      ),
      linkedProfiles.filter(
        (profile) => profile.guest_identity_id === identity.id
      )
    )
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: canonicalRows = [] }, { data: legacyRows = [] }] =
    await Promise.all([
      supabase.from("reservations").select("id"),
      supabase.from("leads").select("id").eq("user_id", user?.id),
    ]);
  const canonicalIds = (canonicalRows || []).map((row) => String(row.id));
  const legacyIds = (legacyRows || []).map((row) => String(row.id));
  const reservationOnlyResults = await Promise.all([
    canonicalIds.length
      ? supabase
          .from("reservation_guests")
          .select(
            "id, reservation_id, canonical_reservation_id, guest_identity_id, full_name, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
          )
          .in("canonical_reservation_id", canonicalIds)
          .is("guest_identity_id", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    legacyIds.length
      ? supabase
          .from("reservation_guests")
          .select(
            "id, reservation_id, canonical_reservation_id, guest_identity_id, full_name, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
          )
          .in("reservation_id", legacyIds)
          .is("guest_identity_id", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const reservationOnlyProfiles = reservationOnlyResults.flatMap(
    (result) => (result.data as ReservationOnlyGuestRow[] | null) || []
  );

  return (
    <div className="space-y-6 p-6 text-white">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Guest CRM
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Consolidated guests</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          One record per known person, combining visit history, gastronomic
          preferences, dietary risks, and previous dining context.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-white/10 px-3 py-1 text-zinc-300">
            {consolidatedGuests.length} known people
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-zinc-300">
            {reservations.length} linked visits
          </span>
        </div>
      </header>

      {consolidatedGuests.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {consolidatedGuests.map((guest) => {
            const firstVisit = guest.reservations[0];
            const lastVisit = guest.reservations.at(-1);

            return (
              <article
                key={guest.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {guest.full_name?.trim() || "Known guest"}
                    </h2>
                    <div className="mt-2 space-y-1 text-sm text-zinc-500">
                      {guest.email ? <p>{guest.email}</p> : null}
                      {guest.phone ? <p>{guest.phone}</p> : null}
                    </div>
                  </div>
                  <Link
                    href={`/${locale}/business/guests/${guest.id}`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm font-medium hover:bg-white/10"
                  >
                    View guest
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs text-zinc-600">Visits</p>
                    <p className="mt-1 text-lg font-semibold">
                      {guest.reservations.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs text-zinc-600">First visit</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {formatGuestDate(
                        firstVisit
                          ? getVisitDate(firstVisit)
                          : guest.first_seen_at
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs text-zinc-600">Last visit</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {formatGuestDate(
                        lastVisit ? getVisitDate(lastVisit) : guest.last_seen_at
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ProfileSummary
                    label="Wine preferences"
                    values={guest.winePreferences}
                  />
                  <ProfileSummary label="Dislikes" values={guest.dislikes} />
                  <ProfileSummary
                    label="Allergies"
                    values={guest.allergies}
                  />
                  <ProfileSummary
                    label="Intolerances"
                    values={guest.intolerances}
                  />
                  <ProfileSummary
                    label="Dietary restrictions"
                    values={guest.dietaryRestrictions}
                  />
                  <ProfileSummary
                    label="Previous occasions"
                    values={guest.occasions}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-semibold">No consolidated guests yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            A consolidated record appears when a canonical reservation has an
            email or phone that can be linked to a guest identity.
          </p>
        </section>
      )}

      {reservationOnlyProfiles.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
              Compatibility
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Reservation-only profiles
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              These older or companion profiles have no stable email/phone
              identity. They remain available without being merged by name.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {reservationOnlyProfiles.map((guest) => {
              const profile = guest.guest_dietary_profiles?.[0];
              const reservationId =
                guest.canonical_reservation_id || guest.reservation_id;

              return (
                <article
                  key={guest.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.015] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium">
                        {guest.full_name?.trim() ||
                          `Guest ${guest.guest_position}`}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-600">
                        Saved {formatGuestDate(guest.created_at)}
                      </p>
                    </div>
                    {reservationId ? (
                      <Link
                        href={`/${locale}/business/reservations/${reservationId}`}
                        className="text-sm text-zinc-400 hover:text-white"
                      >
                        Reservation
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {summarize([
                      ...(profile?.allergies || []),
                      ...(profile?.intolerances || []),
                      ...(profile?.dietary_restrictions || []),
                      ...(profile?.dislikes || []),
                      ...(profile?.wine_preferences
                        ? [profile.wine_preferences]
                        : []),
                    ])}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
