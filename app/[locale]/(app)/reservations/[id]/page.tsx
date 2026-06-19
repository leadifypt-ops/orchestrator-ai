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
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
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

  const guestNames = guestProfiles.map(getGuestName);
  const hostName = getHostName(guestProfiles, request);
  const winePreferences = collectTextValues(guestProfiles, "wine_preferences");
  const importantNotes = collectTextValues(guestProfiles, "notes");
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
            <p>{request.dietary_notes || "No dietary notes captured yet."}</p>
          </DetailCard>

          <DetailCard title="Special request">
            <p>{request.message || "No special request provided."}</p>
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
