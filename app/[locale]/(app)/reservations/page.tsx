import { createClient } from "@/lib/supabase/server";
import ReservationsBoard from "./reservations-board";

export const dynamic = "force-dynamic";

export type ReservationRequest = {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: canonicalRows = [] }, { data: leads = [] }] =
    await Promise.all([
      supabase
        .from("reservations")
        .select(
          "id, guest_name, guest_email, guest_phone, requested_date, requested_time, party_size, status, occasion, special_request, source, created_at, updated_at, restaurants!reservations_restaurant_id_fkey(name, slug)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("leads")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false }),
    ]);

  const canonicalRequests = ((canonicalRows as CanonicalReservationRow[]) ?? []).map(
    (row): ReservationRequest => {
      const restaurant = Array.isArray(row.restaurants)
        ? row.restaurants[0]
        : row.restaurants;

      return {
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
    }
  );
  const legacyRequests = ((leads as Omit<ReservationRequest, "recordType">[]) ?? []).map(
    (lead): ReservationRequest => ({ ...lead, recordType: "legacy" })
  );
  const requests = [...canonicalRequests, ...legacyRequests].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
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
    newRequests: requests.filter((request) =>
      ["new", "pending"].includes(String(request.status || "").toLowerCase())
    ).length,
    awaitingConfirmation: requests.filter((request) =>
      ["contacted", "active", "reviewing"].includes(
        String(request.status || "").toLowerCase()
      )
    ).length,
    confirmedInterest: requests.filter(
      (request) => request.status === "qualified"
    ).length,
    confirmed: requests.filter((request) =>
      ["booked", "converted", "confirmed"].includes(
        String(request.status || "").toLowerCase()
      )
    ).length,
    noShowRisk: requests.filter((request) =>
      ["lost", "declined", "cancelled"].includes(
        String(request.status || "").toLowerCase()
      )
    ).length,
    today,
    week,
  };

  return <ReservationsBoard requests={requests} metrics={metrics} />;
}
