"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createManualReservation } from "./actions";

type RestaurantOption = {
  id: string;
  name: string;
  location: string | null;
};

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function cleanList(value: FormDataEntryValue | null) {
  const text = clean(value);

  if (!text) return [];

  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function NewReservationRequestPage() {
  const router = useRouter();
  const params = useParams();
  const locale = String(params.locale || "pt");
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadRestaurants() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isActive) {
          setErrorMessage("You must be signed in to create a reservation.");
          setIsLoadingRestaurants(false);
        }
        return;
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from("business_memberships")
        .select("business_id")
        .eq("user_id", user.id);

      if (!isActive) return;

      if (membershipsError) {
        setErrorMessage(membershipsError.message);
        setIsLoadingRestaurants(false);
        return;
      }

      const businessIds = (memberships ?? []).map(
        (membership) => membership.business_id
      );

      if (businessIds.length === 0) {
        setErrorMessage(
          "Your user must belong to a business before creating a reservation."
        );
        setIsLoadingRestaurants(false);
        return;
      }

      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, location")
        .in("business_id", businessIds)
        .order("name", { ascending: true });

      if (!isActive) return;

      if (error) {
        setErrorMessage(error.message);
        setIsLoadingRestaurants(false);
        return;
      }

      const options = ((data as RestaurantOption[]) ?? []).filter(
        (restaurant) => restaurant.id && restaurant.name
      );
      setRestaurants(options);
      setRestaurantId(options[0]?.id || "");
      setIsLoadingRestaurants(false);

      if (options.length === 0) {
        setErrorMessage(
          "No owned restaurants are available for manual reservations."
        );
      }
    }

    void loadRestaurants();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const guestName = clean(formData.get("guest_name"));
    const phone = clean(formData.get("phone"));
    const email = clean(formData.get("email"));
    const selectedRestaurantId = clean(formData.get("restaurant_id"));
    const partySizeValue = clean(formData.get("party_size"));
    const partySize = partySizeValue ? Number.parseInt(partySizeValue, 10) : null;
    const requestedDate = clean(formData.get("requested_date"));
    const requestedTime = clean(formData.get("requested_time"));
    const occasion = clean(formData.get("occasion"));
    const initialNotes = clean(formData.get("initial_notes"));
    const hostGuestName = clean(formData.get("host_guest_name"));
    const allergies = cleanList(formData.get("allergies"));
    const intolerances = cleanList(formData.get("intolerances"));
    const dietaryRestrictions = cleanList(
      formData.get("dietary_restrictions")
    );
    const dislikes = cleanList(formData.get("dislikes"));
    const winePreferences = clean(formData.get("wine_preferences"));
    const profileNotes = clean(formData.get("profile_notes"));
    const hasGastronomicProfile =
      !!hostGuestName ||
      allergies.length > 0 ||
      intolerances.length > 0 ||
      dietaryRestrictions.length > 0 ||
      dislikes.length > 0 ||
      !!winePreferences ||
      !!profileNotes;

    if (
      partySize !== null &&
      (!Number.isInteger(partySize) || partySize < 1)
    ) {
      setErrorMessage("Party size must be at least 1.");
      setIsSaving(false);
      return;
    }

    if (!selectedRestaurantId || !guestName) {
      setErrorMessage("Restaurant and guest name are required.");
      setIsSaving(false);
      return;
    }

    const result = await createManualReservation({
      restaurantId: selectedRestaurantId,
      guestName,
      guestEmail: email,
      guestPhone: phone,
      requestedDate,
      requestedTime,
      partySize,
      occasion,
      specialRequest: initialNotes,
      hostGuestName: hasGastronomicProfile ? hostGuestName : null,
      allergies,
      intolerances,
      dietaryRestrictions,
      dislikes,
      winePreferences,
      profileNotes,
    });

    if (result.error || !result.reservationId) {
      setErrorMessage(result.error || "Could not create the reservation.");
      setIsSaving(false);
      return;
    }

    router.push(`/${locale}/business/reservations/${result.reservationId}`);
    router.refresh();
  }

  return (
    <div className="p-8 text-white">
      <div className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Reservations
        </p>

        <h1 className="mt-3 text-3xl font-semibold">
          Create reservation request
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Add a guest request received by phone, email, concierge partner, or
          the restaurant team. Find Dining will keep the request ready for
          confirmation and service briefing.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Guest details</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Guest name
                </label>
                <input
                  name="guest_name"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Guest full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Phone
                </label>
                <input
                  name="phone"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="+351 ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="guest@example.com"
                />
              </div>

            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Reservation request</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Restaurant
                </label>
                <select
                  name="restaurant_id"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={restaurantId}
                  onChange={(event) => setRestaurantId(event.target.value)}
                  disabled={isLoadingRestaurants || restaurants.length === 0}
                  required
                >
                  {restaurants.length === 0 ? (
                    <option value="">
                      {isLoadingRestaurants
                        ? "Loading restaurants..."
                        : "No owned restaurant available"}
                    </option>
                  ) : null}
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                      {restaurant.location ? ` — ${restaurant.location}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Party size
                </label>
                <input
                  name="party_size"
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Occasion
                </label>
                <input
                  name="occasion"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Birthday, anniversary, business dinner..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Requested date
                </label>
                <input
                  name="requested_date"
                  type="date"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Requested time
                </label>
                <input
                  name="requested_time"
                  type="time"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Initial message / notes
                </label>
                <textarea
                  name="initial_notes"
                  rows={5}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Add anything the team should know before reviewing the request."
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Gastronomic Profile</h2>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Optional host profile for service and kitchen briefing. Additional
              guests can be added later from the reservation detail page.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Host guest name
                </label>
                <input
                  name="host_guest_name"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Leave blank to use the main guest name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Allergies
                </label>
                <textarea
                  name="allergies"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Shellfish, peanuts..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Intolerances
                </label>
                <textarea
                  name="intolerances"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Lactose, gluten..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Dietary restrictions
                </label>
                <textarea
                  name="dietary_restrictions"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Vegetarian, halal, pregnancy restrictions..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Dislikes
                </label>
                <textarea
                  name="dislikes"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Coriander, oysters..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Wine preferences
                </label>
                <input
                  name="wine_preferences"
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Old world reds, Champagne, non-alcoholic pairing..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Notes
                </label>
                <textarea
                  name="profile_notes"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  placeholder="Any detail that should inform the service or kitchen briefing."
                />
              </div>
            </div>
          </section>

          {errorMessage ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || isLoadingRestaurants || !restaurantId}
              className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {isSaving
                ? "Creating reservation request..."
                : "Create reservation request"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/${locale}/business/reservations`)}
              className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
