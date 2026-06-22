import { createClient } from "@/lib/supabase/server";
import ReservationsBoard from "./reservations-board";

export const dynamic = "force-dynamic";

export type ReservationRequest = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  service: string | null;
  status: string | null;
  message: string | null;
  service_briefing: string | null;
  restaurant_name?: string | null;
  restaurant?: string | null;
  requested_date: string | null;
  requested_time: string | null;
  party_size: number | null;
  occasion: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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

type GuestBriefingRow = {
  canonical_reservation_id: string | null;
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
  guest_dietary_profiles:
    | {
        dislikes: string[] | null;
        wine_preferences: string | null;
        notes: string | null;
      }[]
    | null;
};

function buildServiceBriefing(guests: GuestBriefingRow[]) {
  const details = guests.flatMap((guest) => {
    const profile = guest.guest_dietary_profiles?.[0];
    if (!profile) return [];
    const name = guest.full_name?.trim() || "Guest " + guest.guest_position;
    const notes = profile.notes?.trim() || "";
    const [guestNote, ...experienceLines] = notes.split("\n");
    const experienceContext = guest.is_host
      ? experienceLines.join("\n").trim()
      : "";
    const context = [
      profile.wine_preferences?.trim()
        ? "wine: " + profile.wine_preferences.trim()
        : "",
      profile.dislikes?.length
        ? "dislikes: " + profile.dislikes.join(", ")
        : "",
      (experienceContext ? guestNote : notes)
        ? "notes: " + (experienceContext ? guestNote : notes)
        : "",
    ].filter(Boolean);
    const guestSummary = context.length
      ? [name + " - " + context.join("; ")]
      : [];

    return experienceContext
      ? [...guestSummary, "Reservation context: " + experienceContext]
      : guestSummary;
  });

  return details.join(" | ") || null;
}

export type ReservationMetrics = {
  total: number;
  newRequests: number;
  awaitingConfirmation: number;
  confirmedInterest: number;
  confirmed: number;
  noShowRisk: number;
  today: number;
  week: number;
};

export default async function ReservationsPage() {
  const supabase = await createClient();
  const { data: canonicalRows = [] } = await supabase
    .from("reservations")
    .select(
      "id, guest_name, guest_email, guest_phone, requested_date, requested_time, party_size, status, occasion, special_request, source, created_at, updated_at, restaurants!reservations_restaurant_id_fkey(name, slug)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const canonicalIds = (canonicalRows || []).map((row) => row.id);
  let guestRows: GuestBriefingRow[] = [];
  if (canonicalIds.length > 0) {
    const { data = [] } = await supabase
      .from("reservation_guests")
      .select(
        "canonical_reservation_id, full_name, guest_position, is_host, guest_dietary_profiles(dislikes, wine_preferences, notes)"
      )
      .in("canonical_reservation_id", canonicalIds)
      .order("guest_position", { ascending: true });
    guestRows = (data as GuestBriefingRow[]) || [];
  }

  const briefingByReservation = new Map<string, string | null>();
  for (const reservationId of canonicalIds) {
    briefingByReservation.set(
      reservationId,
      buildServiceBriefing(
        guestRows.filter(
          (guest) => guest.canonical_reservation_id === reservationId
        )
      )
    );
  }


  const requests = ((canonicalRows as CanonicalReservationRow[]) ?? []).map(
    (row): ReservationRequest => {
      const restaurant = Array.isArray(row.restaurants)
        ? row.restaurants[0]
        : row.restaurants;

      return {
        id: row.id,
        name: row.guest_name,
        email: row.guest_email,
        phone: row.guest_phone,
        source: row.source,
        service: restaurant?.name || null,
        status: row.status,
        message: row.special_request,
        service_briefing: briefingByReservation.get(row.id) || null,
        restaurant_name: restaurant?.name || null,
        restaurant: restaurant?.slug || null,
        requested_date: row.requested_date,
        requested_time: row.requested_time,
        party_size: row.party_size,
        occasion: row.occasion,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
  );
  const now = new Date();

  const today = requests.filter((request) => {
    if (!request.created_at) return false;
    const createdAt = new Date(request.created_at);
    return createdAt.toDateString() === now.toDateString();
  }).length;

  const week = requests.filter((request) => {
    if (!request.created_at) return false;
    const createdAt = new Date(request.created_at);
    const diff = now.getTime() - createdAt.getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const metrics: ReservationMetrics = {
    total: requests.length,
    newRequests: requests.length,
    awaitingConfirmation: 0,
    confirmedInterest: 0,
    confirmed: 0,
    noShowRisk: 0,
    today,
    week,
  };

  return <ReservationsBoard requests={requests} metrics={metrics} />;
}
