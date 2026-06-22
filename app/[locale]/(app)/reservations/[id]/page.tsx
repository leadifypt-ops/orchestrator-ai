import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GastronomicProfilePanel, {
  type ReservationGuestProfile,
} from "./gastronomic-profile-panel";
import InternalNotesPanel, {
  type ReservationInternalNote,
} from "./internal-notes-panel";

type ReservationDetailPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

type ReservationRequest = {
  id: string;
  recordType: "canonical" | "legacy";
  name: string | null;
  email?: string | null;
  phone: string | null;
  source: string | null;
  service: string | null;
  status: string | null;
  channel?: string | null;
  message?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  restaurant_name?: string | null;
  restaurant?: string | null;
  requested_experience?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  party_size?: number | string | null;
  dietary_notes?: string | null;
  occasion?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type GuestDietaryProfileRow = {
  id: string | null;
  allergies: string[] | null;
  intolerances: string[] | null;
  dietary_restrictions: string[] | null;
  dislikes: string[] | null;
  wine_preferences: string | null;
  notes: string | null;
};

type ReservationGuestRow = {
  id: string;
  reservation_id: string | null;
  guest_identity_id: string | null;
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};


type GuestIdentityRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type HistoricalReservationRow = {
  id: string;
  requested_date: string | null;
  requested_time: string | null;
  occasion: string | null;
  special_request: string | null;
  created_at: string;
};

type HistoricalGuestRow = {
  canonical_reservation_id: string | null;
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};

type ReservationTimelineEvent = {
  id: string;
  reservation_id: string | null;
  event_type: string;
  event_label: string;
  event_description: string | null;
  created_by: string | null;
  created_at: string;
};

function getStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    new: "New request",
    contacted: "Awaiting confirmation",
    active: "Awaiting confirmation",
    qualified: "Confirmed interest",
    converted: "Confirmed",
    booked: "Confirmed",
    lost: "Cancelled / No-show risk",
    closed: "Service completed",
    pending: "New request",
    reviewing: "Awaiting confirmation",
    confirmed: "Confirmed",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Service completed",
  };

  return labels[String(status || "new").toLowerCase()] || "New request";
}

function getContactChannel(request: ReservationRequest) {
  return (
    request.source ||
    request.channel ||
    (request.instagram ? "Instagram" : null) ||
    (request.whatsapp ? "WhatsApp" : null) ||
    (request.phone ? "Phone" : null) ||
    "Unknown channel"
  );
}

function getExperienceName(request: ReservationRequest) {
  return (
    request.requested_experience ||
    request.service ||
    request.restaurant_name ||
    request.restaurant ||
    "Dining experience to confirm"
  );
}

function getRequestedSlot(request: ReservationRequest) {
  if (request.requested_date && request.requested_time) {
    return `${request.requested_date} at ${request.requested_time}`;
  }

  return request.requested_date || request.requested_time || "Not specified";
}

function getNoShowRisk(request: ReservationRequest) {
  if (["lost", "declined", "cancelled"].includes(request.status || "")) {
    return "High";
  }
  if (
    !request.email &&
    !request.phone &&
    !request.whatsapp &&
    !request.instagram
  ) {
    return "Medium";
  }
  return "Low";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatVisitDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Date(value + (value.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString(
    "pt-PT",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

function getGuestName(guest: ReservationGuestProfile) {
  return guest.full_name?.trim() || `Guest ${guest.guest_position}`;
}

function getHostName(guests: ReservationGuestProfile[], request: ReservationRequest) {
  const host = guests.find((guest) => guest.is_host) || guests[0];
  return host ? getGuestName(host) : request.name || "Host not identified";
}

function joinValues(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None recorded";
}

function collectGuestValues(
  guests: ReservationGuestProfile[],
  key:
    | "allergies"
    | "intolerances"
    | "dietary_restrictions"
    | "dislikes"
) {
  return guests.flatMap((guest) =>
    (guest.dietary_profile?.[key] || []).map((item) => ({
      guest: getGuestName(guest),
      value: item,
    }))
  );
}

function collectTextValues(
  guests: ReservationGuestProfile[],
  key: "wine_preferences" | "notes"
) {
  return guests
    .map((guest) => ({
      guest: getGuestName(guest),
      value: guest.dietary_profile?.[key]?.trim() || "",
    }))
    .filter((item) => item.value);
}

function renderGuestValueList(
  items: Array<{ guest: string; value: string }>,
  empty: string
) {
  if (items.length === 0) return <p>{empty}</p>;

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.guest}-${item.value}-${index}`}>
          <span className="text-zinc-500">{item.guest}:</span> {item.value}
        </li>
      ))}
    </ul>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-6 text-zinc-300">{children}</div>
    </section>
  );
}

export const dynamic = "force-dynamic";

type CanonicalReservationRow = {
  id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  requested_date: string | null;
  requested_time: string | null;
  party_size: number | null;
  status: string;
  occasion: string | null;
  special_request: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  restaurants:
    | { name: string | null; slug: string | null }
    | { name: string | null; slug: string | null }[]
    | null;
};

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: canonicalData } = await supabase
    .from("reservations")
    .select(
      "id, guest_name, guest_email, guest_phone, requested_date, requested_time, party_size, status, occasion, special_request, source, created_at, updated_at, restaurants!reservations_restaurant_id_fkey(name, slug)"
    )
    .eq("id", id)
    .maybeSingle();

  let request: ReservationRequest;

  if (canonicalData) {
    const row = canonicalData as CanonicalReservationRow;
    const restaurant = Array.isArray(row.restaurants)
      ? row.restaurants[0]
      : row.restaurants;

    request = {
      id: row.id,
      recordType: "canonical",
      name: row.guest_name,
      email: row.guest_email,
      phone: row.guest_phone,
      source: row.source,
      service: restaurant?.name || null,
      status: row.status,
      channel: "Canonical reservation",
      message: row.special_request,
      restaurant_name: restaurant?.name || null,
      restaurant: restaurant?.slug || null,
      requested_date: row.requested_date,
      requested_time: row.requested_time,
      party_size: row.party_size,
      occasion: row.occasion,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } else {
    const { data: legacyData, error: legacyError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .eq("user_id", user?.id)
      .maybeSingle();

    if (legacyError || !legacyData) {
      notFound();
    }

    request = {
      ...(legacyData as Omit<ReservationRequest, "recordType">),
      recordType: "legacy",
    };
  }

  let guestQuery = supabase
    .from("reservation_guests")
    .select(
      `
        id,
        reservation_id,
        guest_identity_id,
        full_name,
        guest_position,
        is_host,
        guest_dietary_profiles (
          id,
          allergies,
          intolerances,
          dietary_restrictions,
          dislikes,
          wine_preferences,
          notes
        )
      `
    );
  guestQuery =
    request.recordType === "canonical"
      ? guestQuery.eq("canonical_reservation_id", id)
      : guestQuery.eq("reservation_id", id);
  const { data: guestRows = [] } = await guestQuery.order("guest_position", {
    ascending: true,
  });

  const guestProfiles: ReservationGuestProfile[] = (
    (guestRows as ReservationGuestRow[]) || []
  ).map((guest) => {
    const profile = guest.guest_dietary_profiles?.[0] || null;

    return {
      id: guest.id,
      reservation_id: guest.reservation_id || id,
      guest_identity_id: guest.guest_identity_id,
      full_name: guest.full_name,
      guest_position: guest.guest_position,
      is_host: guest.is_host,
      dietary_profile: profile
        ? {
            id: profile.id,
            allergies: profile.allergies || [],
            intolerances: profile.intolerances || [],
            dietary_restrictions: profile.dietary_restrictions || [],
            dislikes: profile.dislikes || [],
            wine_preferences: profile.wine_preferences,
            notes: profile.notes,
          }
        : null,
    };
  });

  const linkedHost =
    guestProfiles.find((guest) => guest.is_host) || guestProfiles[0];
  let guestIdentity: GuestIdentityRow | null = null;
  let historicalReservations: HistoricalReservationRow[] = [];
  let historicalGuestRows: HistoricalGuestRow[] = [];

  if (request.recordType === "canonical" && linkedHost?.guest_identity_id) {
    const [identityResult, reservationsResult, guestsResult] = await Promise.all([
      supabase
        .from("guest_identities")
        .select("id, full_name, email, phone, first_seen_at, last_seen_at")
        .eq("id", linkedHost.guest_identity_id)
        .maybeSingle(),
      supabase
        .from("reservations")
        .select(
          "id, requested_date, requested_time, occasion, special_request, created_at"
        )
        .eq("guest_identity_id", linkedHost.guest_identity_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("reservation_guests")
        .select(
          "canonical_reservation_id, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
        )
        .eq("guest_identity_id", linkedHost.guest_identity_id),
    ]);

    guestIdentity = identityResult.data as GuestIdentityRow | null;
    historicalReservations =
      (reservationsResult.data as HistoricalReservationRow[]) || [];
    historicalGuestRows =
      (guestsResult.data as HistoricalGuestRow[]) || [];
  }

  const historyProfiles = historicalGuestRows
    .map((guest) => ({
      reservationId: guest.canonical_reservation_id,
      profile: guest.guest_dietary_profiles?.[0] || null,
    }))
    .filter((item) => item.profile);
  const previousProfiles = historyProfiles.filter(
    (item) => item.reservationId !== id
  );
  const knownAllergies = uniqueValues(
    historyProfiles.flatMap((item) => item.profile?.allergies || [])
  );
  const knownIntolerances = uniqueValues(
    historyProfiles.flatMap((item) => item.profile?.intolerances || [])
  );
  const knownRestrictions = uniqueValues(
    historyProfiles.flatMap(
      (item) => item.profile?.dietary_restrictions || []
    )
  );
  const knownDislikes = uniqueValues(
    historyProfiles.flatMap((item) => item.profile?.dislikes || [])
  );
  const knownWinePreferences = uniqueValues(
    historyProfiles.flatMap((item) =>
      item.profile?.wine_preferences?.trim()
        ? [item.profile.wine_preferences.trim()]
        : []
    )
  );
  const previousNotes = previousProfiles.flatMap((item) =>
    item.profile?.notes?.trim() ? [item.profile.notes.trim()] : []
  );
  const historicalAllergies = uniqueValues(
    previousProfiles.flatMap((item) => item.profile?.allergies || [])
  );
  const historicalIntolerances = uniqueValues(
    previousProfiles.flatMap((item) => item.profile?.intolerances || [])
  );
  const historicalRestrictions = uniqueValues(
    previousProfiles.flatMap(
      (item) => item.profile?.dietary_restrictions || []
    )
  );
  const historicalDislikes = uniqueValues(
    previousProfiles.flatMap((item) => item.profile?.dislikes || [])
  );
  const historicalWinePreferences = uniqueValues(
    previousProfiles.flatMap((item) =>
      item.profile?.wine_preferences?.trim()
        ? [item.profile.wine_preferences.trim()]
        : []
    )
  );
  const previousReservations = historicalReservations.filter(
    (reservation) => reservation.id !== id
  );
  const previousOccasions = uniqueValues(
    previousReservations.flatMap((reservation) =>
      reservation.occasion?.trim() ? [reservation.occasion.trim()] : []
    )
  );
  const previousReservationContext = uniqueValues(
    previousReservations.flatMap((reservation) =>
      reservation.special_request?.trim()
        ? [reservation.special_request.trim()]
        : []
    )
  );
  const isReturningGuest = previousReservations.length > 0;
  const firstReservation = historicalReservations[0];
  const lastReservation =
    historicalReservations[historicalReservations.length - 1];
  const lastPreviousReservation =
    previousReservations[previousReservations.length - 1];
  const currentHostAllergies = linkedHost?.dietary_profile?.allergies || [];
  const currentHostIntolerances =
    linkedHost?.dietary_profile?.intolerances || [];
  const currentHostRestrictions =
    linkedHost?.dietary_profile?.dietary_restrictions || [];
  const isCurrentlyConfirmed = (current: string[], historical: string) =>
    current.some(
      (value) => value.trim().toLowerCase() === historical.trim().toLowerCase()
    );
  const dietaryConflicts = [
    ...historicalAllergies
      .filter((value) => !isCurrentlyConfirmed(currentHostAllergies, value))
      .map((value) => ({ category: "allergy", value })),
    ...historicalIntolerances
      .filter((value) => !isCurrentlyConfirmed(currentHostIntolerances, value))
      .map((value) => ({ category: "intolerance", value })),
    ...historicalRestrictions
      .filter((value) => !isCurrentlyConfirmed(currentHostRestrictions, value))
      .map((value) => ({ category: "restriction", value })),
  ];

  const guestNames = guestProfiles.map(getGuestName);
  const hostName = getHostName(guestProfiles, request);
  const winePreferences = collectTextValues(guestProfiles, "wine_preferences");
  const host = linkedHost;
  const hostNotes = host?.dietary_profile?.notes?.trim() || "";
  const [hostGuestNote, ...experienceNoteLines] = hostNotes.split("\n");
  const reservationExperienceNotes = experienceNoteLines.join("\n").trim();
  const importantNotes = guestProfiles
    .map((guest) => ({
      guest: getGuestName(guest),
      value:
        guest.id === host?.id && reservationExperienceNotes
          ? hostGuestNote.trim()
          : guest.dietary_profile?.notes?.trim() || "",
    }))
    .filter((item) => item.value);
  const dislikes = collectGuestValues(guestProfiles, "dislikes");
  const allergies = collectGuestValues(guestProfiles, "allergies");
  const intolerances = collectGuestValues(guestProfiles, "intolerances");
  const dietaryRestrictions = collectGuestValues(
    guestProfiles,
    "dietary_restrictions"
  );
  const criticalWarnings = [...allergies, ...intolerances];

  let internalNotesQuery = supabase
    .from("reservation_internal_notes")
    .select("id, reservation_id, note, created_by, created_at");
  internalNotesQuery =
    request.recordType === "canonical"
      ? internalNotesQuery.eq("canonical_reservation_id", id)
      : internalNotesQuery.eq("reservation_id", id);
  const { data: internalNotes = [] } = await internalNotesQuery.order(
    "created_at",
    { ascending: false }
  );

  let timelineQuery = supabase
    .from("reservation_timeline_events")
    .select(
      "id, reservation_id, event_type, event_label, event_description, created_by, created_at"
    );
  timelineQuery =
    request.recordType === "canonical"
      ? timelineQuery.eq("canonical_reservation_id", id)
      : timelineQuery.eq("reservation_id", id);
  const { data: timelineEvents = [] } = await timelineQuery.order(
    "created_at",
    { ascending: false }
  );

  return (
    <div className="space-y-6 p-6 text-white">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/${locale}/business/reservations`}
            className="text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-white"
          >
            Back to reservations
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            {request.name || "Unnamed guest"}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
            {request.recordType === "canonical"
              ? "Canonical reservation"
              : "Legacy reservation"}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Reservation request detail for guest profile preparation, dining
            experience confirmation, and future Gastronomic Profile V1.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-zinc-200">
          {getStatusLabel(request.status)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <DetailCard title="Reservation overview">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-zinc-500">Status:</span>{" "}
                {getStatusLabel(request.status)}
              </p>
              <p>
                <span className="text-zinc-500">No-show risk:</span>{" "}
                {getNoShowRisk(request)}
              </p>
              <p>
                <span className="text-zinc-500">Received:</span>{" "}
                {formatDateTime(request.created_at)}
              </p>
              <p>
                <span className="text-zinc-500">Updated:</span>{" "}
                {formatDateTime(request.updated_at)}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Requested experience">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-zinc-500">Dining experience:</span>{" "}
                {getExperienceName(request)}
              </p>
              <p>
                <span className="text-zinc-500">Requested date/time:</span>{" "}
                {getRequestedSlot(request)}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Party details">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-zinc-500">Party size:</span>{" "}
                {request.party_size || "Not specified"}
              </p>
              <p>
                <span className="text-zinc-500">Occasion:</span>{" "}
                {request.occasion || "Not provided"}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Dietary profile">
            <p>
              {guestProfiles.length > 0
                ? guestProfiles.length +
                  " guest " +
                  (guestProfiles.length === 1 ? "profile" : "profiles") +
                  " captured. Review the guest-specific Kitchen briefing below."
                : request.dietary_notes || "No dietary notes captured yet."}
            </p>
          </DetailCard>

          <DetailCard title="Special request">
            <p>{request.message || "No special request provided."}</p>
          </DetailCard>

          <DetailCard title="Reservation experience context">
            <p>
              {reservationExperienceNotes ||
                "No reservation-level experience notes provided."}
            </p>
          </DetailCard>

          {request.recordType === "legacy" ? (
            <GastronomicProfilePanel
              reservationId={id}
              initialGuests={guestProfiles}
            />
          ) : (
            <DetailCard title="Gastronomic profile editing">
              <p>
                Canonical guest profiles are read-only until membership-scoped
                policies replace the temporary guest profile policies.
              </p>
            </DetailCard>
          )}

          <DetailCard title="Guest identity and history">
            {!guestIdentity ? (
              <p>
                No stable guest identity is linked. Email or phone is required
                for returning-guest recognition.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <p>
                    <span className="text-zinc-500">Guest status:</span>{" "}
                    {isReturningGuest ? "Returning guest" : "First visit"}
                  </p>
                  <p>
                    <span className="text-zinc-500">First visit:</span>{" "}
                    {formatVisitDate(
                      firstReservation?.requested_date ||
                        firstReservation?.created_at ||
                        guestIdentity.first_seen_at
                    )}
                  </p>
                  <p>
                    <span className="text-zinc-500">Last visit:</span>{" "}
                    {formatVisitDate(
                      lastReservation?.requested_date ||
                        lastReservation?.created_at ||
                        guestIdentity.last_seen_at
                    )}
                  </p>
                  <p>
                    <span className="text-zinc-500">Total visits:</span>{" "}
                    {historicalReservations.length}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p><span className="text-zinc-500">Known allergies:</span> {joinValues(knownAllergies)}</p>
                  <p><span className="text-zinc-500">Known intolerances:</span> {joinValues(knownIntolerances)}</p>
                  <p><span className="text-zinc-500">Known restrictions:</span> {joinValues(knownRestrictions)}</p>
                  <p><span className="text-zinc-500">Known dislikes:</span> {joinValues(knownDislikes)}</p>
                  <p className="sm:col-span-2"><span className="text-zinc-500">Known wine preferences:</span> {joinValues(knownWinePreferences)}</p>
                </div>
                <div>
                  <p className="font-medium text-zinc-200">Previous notes / context</p>
                  {previousNotes.length ? (
                    <ul className="mt-2 space-y-2">
                      {previousNotes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No previous notes recorded.</p>
                  )}
                </div>
              </div>
            )}
          </DetailCard>

          {isReturningGuest ? (
            <section className="rounded-2xl border border-[#d8c16f]/30 bg-[#d8c16f]/[0.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-[#e2cf8a]">
                  Returning Guest Experience
                </h2>
                <span className="rounded-full border border-[#d8c16f]/40 bg-[#d8c16f]/10 px-3 py-1 text-xs font-medium text-[#eadb9f]">
                  Returning guest
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-300 sm:grid-cols-2">
                <p><span className="text-zinc-500">Previous visits:</span> {previousReservations.length}</p>
                <p><span className="text-zinc-500">Last visit:</span> {formatVisitDate(lastPreviousReservation?.requested_date || lastPreviousReservation?.created_at)}</p>
                <p><span className="text-zinc-500">Remembered preferences:</span> {previousNotes.length ? previousNotes.join(" | ") : "None recorded"}</p>
                <p><span className="text-zinc-500">Remembered dislikes:</span> {joinValues(historicalDislikes)}</p>
                <p><span className="text-zinc-500">Remembered wine:</span> {joinValues(historicalWinePreferences)}</p>
                <p><span className="text-zinc-500">Remembered dietary risks:</span> {joinValues([...historicalAllergies, ...historicalIntolerances, ...historicalRestrictions])}</p>
                <p><span className="text-zinc-500">Previous occasion:</span> {joinValues(previousOccasions)}</p>
                <p><span className="text-zinc-500">Previous context:</span> {joinValues(previousReservationContext)}</p>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-300">
                <p className="font-medium text-zinc-100">Practical service suggestions</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Avoid welcoming the host as a first-time guest.</li>
                  <li>Use previous occasion and service context discreetly.</li>
                  <li>Reconfirm remembered preferences before acting on them.</li>
                  <li>Reconfirm every historical dietary risk with the guest and kitchen.</li>
                </ul>
              </div>
            </section>
          ) : null}

          <DetailCard title="Service briefing">
            {guestProfiles.length === 0 ? (
              <p>
                No gastronomic profile added yet. Add guest profiles to generate
                a service briefing.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-zinc-500">Host:</span> {hostName}
                  </p>
                  <p>
                    <span className="text-zinc-500">Guests:</span>{" "}
                    {joinValues(guestNames)}
                  </p>
                  <p>
                    <span className="text-zinc-500">Occasion:</span>{" "}
                    {request.occasion || "Not provided"}
                  </p>
                  <p>
                    <span className="text-zinc-500">No-show risk:</span>{" "}
                    {getNoShowRisk(request)}
                  </p>
                  <p>
                    <span className="text-zinc-500">Guest history:</span>{" "}
                    {guestIdentity
                      ? isReturningGuest
                        ? "Returning guest (" + historicalReservations.length + " visits)"
                        : "First visit"
                      : "Not linked"}
                  </p>
                </div>

                <div>
                  <p className="font-medium text-zinc-200">Wine preferences</p>
                  {renderGuestValueList(
                    winePreferences,
                    "No wine preferences recorded."
                  )}
                </div>

                <div>
                  <p className="font-medium text-zinc-200">Dislikes</p>
                  {renderGuestValueList(dislikes, "No dislikes recorded.")}
                </div>

                <div>
                  <p className="font-medium text-zinc-200">Important notes</p>
                  {renderGuestValueList(
                    importantNotes,
                    request.message ||
                      "No important notes recorded for service."
                  )}
                </div>

                {isReturningGuest ? (
                  <div className="rounded-xl border border-[#d8c16f]/25 bg-[#d8c16f]/[0.06] p-3">
                    <p className="font-medium text-[#e2cf8a]">Returning guest</p>
                    <ul className="mt-2 space-y-1 text-zinc-300">
                      <li>Last visited on {formatVisitDate(lastPreviousReservation?.requested_date || lastPreviousReservation?.created_at)}.</li>
                      <li>Previously preferred: {joinValues(historicalWinePreferences)}.</li>
                      <li>Previous dislikes: {joinValues(historicalDislikes)}.</li>
                      <li>Avoid mentioning or welcoming the host as a new guest.</li>
                      <li>Use previous context carefully and reconfirm preferences before service.</li>
                    </ul>
                    {previousNotes.length ? (
                      <p className="mt-2 text-zinc-400">Previous context: {previousNotes.join(" | ")}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="font-medium text-zinc-200">
                    Service attention points
                  </p>
                  <p className="mt-1 text-zinc-400">
                    Confirm the host, acknowledge the occasion if appropriate,
                    and review guest-specific dislikes or wine preferences before
                    arrival.
                  </p>
                </div>
              </div>
            )}
          </DetailCard>

          <DetailCard title="Kitchen briefing">
            {guestProfiles.length === 0 ? (
              <p>
                No gastronomic profile added yet. Add guest profiles to generate
                a kitchen briefing.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-zinc-200">Allergies</p>
                  {renderGuestValueList(allergies, "No allergies recorded.")}
                </div>

                <div>
                  <p className="font-medium text-zinc-200">Intolerances</p>
                  {renderGuestValueList(
                    intolerances,
                    "No intolerances recorded."
                  )}
                </div>

                <div>
                  <p className="font-medium text-zinc-200">
                    Dietary restrictions
                  </p>
                  {renderGuestValueList(
                    dietaryRestrictions,
                    "No dietary restrictions recorded."
                  )}
                </div>

                <div>
                  <p className="font-medium text-zinc-200">
                    Guest-by-guest risks
                  </p>
                  {criticalWarnings.length > 0 ? (
                    renderGuestValueList(criticalWarnings, "")
                  ) : (
                    <p>No critical guest risks recorded.</p>
                  )}
                </div>

                {isReturningGuest &&
                (historicalAllergies.length > 0 ||
                  historicalIntolerances.length > 0 ||
                  historicalRestrictions.length > 0) ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
                    <p className="font-medium">Historical dietary risks</p>
                    <p className="mt-1">
                      Previous allergies: {joinValues(historicalAllergies)}.
                      Previous intolerances: {joinValues(historicalIntolerances)}.
                      Previous restrictions: {joinValues(historicalRestrictions)}.
                    </p>
                  </div>
                ) : null}

                {dietaryConflicts.length > 0 ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-100">
                    <p className="font-medium">Historical profile conflicts</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {dietaryConflicts.map((conflict) => (
                        <li key={conflict.category + conflict.value}>
                          Historical {conflict.value} {conflict.category} exists but was not confirmed in the current profile.
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-red-200">Treat historical dietary risks as unresolved until the guest and kitchen reconfirm them.</p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">
                  <p className="font-medium">Critical warnings</p>
                  <p className="mt-1">
                    {criticalWarnings.length > 0
                      ? "Review all allergy and intolerance entries with the kitchen before service."
                      : "No allergy or intolerance warnings recorded."}
                  </p>
                </div>
              </div>
            )}
          </DetailCard>

          <DetailCard title="Timeline / status history">
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="font-medium text-zinc-200">Request received</p>
                <p className="text-zinc-500">{formatDateTime(request.created_at)}</p>
              </div>
              {(timelineEvents as ReservationTimelineEvent[]).length ? (
                (timelineEvents as ReservationTimelineEvent[]).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                  >
                    <p className="font-medium text-zinc-200">
                      {event.event_label}
                    </p>
                    {event.event_description ? (
                      <p className="mt-1 text-zinc-400">
                        {event.event_description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-600">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-zinc-500">
                  No timeline events yet
                </div>
              )}
            </div>
          </DetailCard>
        </div>

        <aside className="space-y-4">
          <DetailCard title="Guest contact details">
            <div className="space-y-2">
              <p>
                <span className="text-zinc-500">Channel:</span>{" "}
                {getContactChannel(request)}
              </p>
              <p>
                <span className="text-zinc-500">Email:</span>{" "}
                {request.email || "Not captured"}
              </p>
              <p>
                <span className="text-zinc-500">Phone:</span>{" "}
                {request.phone || "Not captured"}
              </p>
              <p>
                <span className="text-zinc-500">WhatsApp:</span>{" "}
                {request.whatsapp || "Not captured"}
              </p>
              <p>
                <span className="text-zinc-500">Instagram:</span>{" "}
                {request.instagram || "Not captured"}
              </p>
            </div>
          </DetailCard>

          {request.recordType === "legacy" ? (
            <InternalNotesPanel
              reservationId={id}
              initialNotes={(internalNotes as ReservationInternalNote[]) || []}
            />
          ) : (
            <DetailCard title="Internal notes">
              {(internalNotes as ReservationInternalNote[]).length ? (
                <div className="space-y-3">
                  {(internalNotes as ReservationInternalNote[]).map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-white/10 bg-black/30 p-3"
                    >
                      <p>{note.note}</p>
                      <p className="mt-2 text-xs text-zinc-600">
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No canonical internal notes yet.</p>
              )}
              <p className="mt-3 text-xs text-zinc-600">
                Canonical notes are read-only in this version.
              </p>
            </DetailCard>
          )}
        </aside>
      </div>
    </div>
  );
}
