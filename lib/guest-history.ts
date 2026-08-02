export type GuestDietaryProfileRow = {
  id: string | null;
  allergies: string[] | null;
  intolerances: string[] | null;
  dietary_restrictions: string[] | null;
  dislikes: string[] | null;
  wine_preferences: string | null;
  notes: string | null;
};

export type GuestIdentityRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type GuestReservationRow = {
  id: string;
  guest_identity_id: string | null;
  guest_name: string;
  requested_date: string | null;
  requested_time: string | null;
  party_size: number | null;
  status: string;
  occasion: string | null;
  special_request: string | null;
  created_at: string;
  restaurants:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

export type IdentityGuestProfileRow = {
  id: string;
  guest_identity_id: string | null;
  canonical_reservation_id: string | null;
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
  created_at: string;
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};

export type ConsolidatedGuest = GuestIdentityRow & {
  reservations: GuestReservationRow[];
  profiles: IdentityGuestProfileRow[];
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  dislikes: string[];
  winePreferences: string[];
  notes: string[];
  occasions: string[];
  reservationContexts: string[];
};

export function uniqueValues(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value) continue;

    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}

export function getVisitDate(reservation: GuestReservationRow) {
  return reservation.requested_date || reservation.created_at;
}

export function formatGuestDate(value?: string | null) {
  if (!value) return "Not recorded";

  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Date(normalized).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getRestaurantName(reservation: GuestReservationRow) {
  const restaurant = Array.isArray(reservation.restaurants)
    ? reservation.restaurants[0]
    : reservation.restaurants;

  return restaurant?.name?.trim() || "Restaurant not recorded";
}

export function consolidateGuest(
  identity: GuestIdentityRow,
  reservations: GuestReservationRow[],
  profiles: IdentityGuestProfileRow[]
): ConsolidatedGuest {
  const dietaryProfiles = profiles
    .map((profile) => profile.guest_dietary_profiles?.[0] || null)
    .filter((profile): profile is GuestDietaryProfileRow => Boolean(profile));

  return {
    ...identity,
    reservations: [...reservations].sort(
      (a, b) =>
        new Date(getVisitDate(a)).getTime() -
        new Date(getVisitDate(b)).getTime()
    ),
    profiles,
    allergies: uniqueValues(
      dietaryProfiles.flatMap((profile) => profile.allergies || [])
    ),
    intolerances: uniqueValues(
      dietaryProfiles.flatMap((profile) => profile.intolerances || [])
    ),
    dietaryRestrictions: uniqueValues(
      dietaryProfiles.flatMap((profile) => profile.dietary_restrictions || [])
    ),
    dislikes: uniqueValues(
      dietaryProfiles.flatMap((profile) => profile.dislikes || [])
    ),
    winePreferences: uniqueValues(
      dietaryProfiles.map((profile) => profile.wine_preferences)
    ),
    notes: uniqueValues(dietaryProfiles.map((profile) => profile.notes)),
    occasions: uniqueValues(
      reservations.map((reservation) => reservation.occasion)
    ),
    reservationContexts: uniqueValues(
      reservations.map((reservation) => reservation.special_request)
    ),
  };
}
