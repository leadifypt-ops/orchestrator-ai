"use server";

import { createClient } from "@/lib/supabase/server";

export type CreateManualReservationInput = {
  restaurantId: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  partySize: number | null;
  occasion: string | null;
  specialRequest: string | null;
  hostGuestName: string | null;
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  dislikes: string[];
  winePreferences: string | null;
  profileNotes: string | null;
};

export type CreateManualReservationResult =
  | { reservationId: string; error: null }
  | { reservationId: null; error: string };

export async function createManualReservation(
  input: CreateManualReservationInput
): Promise<CreateManualReservationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { reservationId: null, error: "Authentication required." };
  }

  const guestName = input.guestName.trim();

  if (!guestName || !input.restaurantId) {
    return {
      reservationId: null,
      error: "Restaurant and guest name are required.",
    };
  }

  if (
    input.partySize !== null &&
    (!Number.isInteger(input.partySize) || input.partySize < 1)
  ) {
    return { reservationId: null, error: "Party size must be at least 1." };
  }

  const { data, error } = await supabase.rpc(
    "create_manual_reservation_v1",
    {
      p_restaurant_id: input.restaurantId,
      p_guest_name: guestName,
      p_guest_email: input.guestEmail,
      p_guest_phone: input.guestPhone,
      p_requested_date: input.requestedDate,
      p_requested_time: input.requestedTime,
      p_party_size: input.partySize,
      p_occasion: input.occasion,
      p_special_request: input.specialRequest,
      p_host_guest_name: input.hostGuestName,
      p_allergies: input.allergies,
      p_intolerances: input.intolerances,
      p_dietary_restrictions: input.dietaryRestrictions,
      p_dislikes: input.dislikes,
      p_wine_preferences: input.winePreferences,
      p_profile_notes: input.profileNotes,
    }
  );

  if (error || !data) {
    const schemaUnavailable = ["PGRST202", "PGRST205", "42P01", "42883"].includes(
      error?.code || ""
    );

    return {
      reservationId: null,
      error: schemaUnavailable
        ? "Canonical reservation migrations must be applied before creating reservations."
        : error?.message || "Could not create the canonical reservation.",
    };
  }

  return { reservationId: String(data), error: null };
}
