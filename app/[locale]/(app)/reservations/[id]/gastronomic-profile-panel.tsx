"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GuestDietaryProfile = {
  id: string | null;
  allergies: string[];
  intolerances: string[];
  dietary_restrictions: string[];
  dislikes: string[];
  wine_preferences: string | null;
  notes: string | null;
};

export type ReservationGuestProfile = {
  id: string;
  reservation_id: string;
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
  dietary_profile: GuestDietaryProfile | null;
};

type DraftGuest = ReservationGuestProfile & {
  allergiesText: string;
  intolerancesText: string;
  dietaryRestrictionsText: string;
  dislikesText: string;
  winePreferencesText: string;
  notesText: string;
};

type GastronomicProfilePanelProps = {
  reservationId: string;
  initialGuests: ReservationGuestProfile[];
};

function toText(values?: string[] | null) {
  return values?.join(", ") || "";
}

function toArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDraft(guest: ReservationGuestProfile): DraftGuest {
  return {
    ...guest,
    allergiesText: toText(guest.dietary_profile?.allergies),
    intolerancesText: toText(guest.dietary_profile?.intolerances),
    dietaryRestrictionsText: toText(
      guest.dietary_profile?.dietary_restrictions
    ),
    dislikesText: toText(guest.dietary_profile?.dislikes),
    winePreferencesText: guest.dietary_profile?.wine_preferences || "",
    notesText: guest.dietary_profile?.notes || "",
  };
}

export default function GastronomicProfilePanel({
  reservationId,
  initialGuests,
}: GastronomicProfilePanelProps) {
  const supabase = createClient();
  const [guests, setGuests] = useState<DraftGuest[]>(
    initialGuests.map(toDraft)
  );
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  function updateGuest(id: string, patch: Partial<DraftGuest>) {
    setGuests((current) =>
      current.map((guest) => (guest.id === id ? { ...guest, ...patch } : guest))
    );
  }

  async function addGuestProfile() {
    setCreating(true);
    setMessage("");

    const nextPosition =
      guests.length > 0
        ? Math.max(...guests.map((guest) => guest.guest_position)) + 1
        : 1;

    const { data: guest, error: guestError } = await supabase
      .from("reservation_guests")
      .insert({
        reservation_id: reservationId,
        full_name: "",
        guest_position: nextPosition,
        is_host: guests.length === 0,
      })
      .select("id, reservation_id, full_name, guest_position, is_host")
      .single();

    if (guestError || !guest) {
      setMessage(guestError?.message || "Could not add guest profile.");
      setCreating(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("guest_dietary_profiles")
      .insert({
        reservation_guest_id: guest.id,
      })
      .select(
        "id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes"
      )
      .single();

    if (profileError || !profile) {
      setMessage(profileError?.message || "Could not add dietary profile.");
      setCreating(false);
      return;
    }

    setGuests((current) => [
      ...current,
      toDraft({
        ...guest,
        dietary_profile: profile,
      }),
    ]);
    setCreating(false);
  }

  async function saveGuestProfile(guest: DraftGuest) {
    setSavingGuestId(guest.id);
    setMessage("");

    const { error: guestError } = await supabase
      .from("reservation_guests")
      .update({
        full_name: guest.full_name,
        guest_position: guest.guest_position,
        is_host: guest.is_host,
        updated_at: new Date().toISOString(),
      })
      .eq("id", guest.id);

    if (guestError) {
      setMessage(guestError.message);
      setSavingGuestId(null);
      return;
    }

    const profilePayload = {
      allergies: toArray(guest.allergiesText),
      intolerances: toArray(guest.intolerancesText),
      dietary_restrictions: toArray(guest.dietaryRestrictionsText),
      dislikes: toArray(guest.dislikesText),
      wine_preferences: guest.winePreferencesText.trim() || null,
      notes: guest.notesText.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (guest.dietary_profile?.id) {
      const { error } = await supabase
        .from("guest_dietary_profiles")
        .update(profilePayload)
        .eq("id", guest.dietary_profile.id);

      if (error) {
        setMessage(error.message);
        setSavingGuestId(null);
        return;
      }
    } else {
      const { data: profile, error } = await supabase
        .from("guest_dietary_profiles")
        .insert({
          reservation_guest_id: guest.id,
          ...profilePayload,
        })
        .select(
          "id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes"
        )
        .single();

      if (error || !profile) {
        setMessage(error?.message || "Could not save dietary profile.");
        setSavingGuestId(null);
        return;
      }

      updateGuest(guest.id, { dietary_profile: profile });
    }

    setMessage("Gastronomic profile saved.");
    setSavingGuestId(null);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
            Gastronomic Profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Capture each guest&apos;s dietary profile, wine preferences, and
            kitchen notes for this reservation request.
          </p>
        </div>

        <button
          type="button"
          onClick={addGuestProfile}
          disabled={creating}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          {creating ? "Adding..." : "Add guest profile"}
        </button>
      </div>

      {guests.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
          No guest profile added yet
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {guests.map((guest) => (
          <div
            key={guest.id}
            className="rounded-xl border border-white/10 bg-black/30 p-4"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem_9rem]">
              <label className="text-sm text-zinc-300">
                Guest name
                <input
                  value={guest.full_name || ""}
                  onChange={(event) =>
                    updateGuest(guest.id, { full_name: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Guest name"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Position
                <input
                  type="number"
                  min={1}
                  value={guest.guest_position}
                  onChange={(event) =>
                    updateGuest(guest.id, {
                      guest_position: Number(event.target.value) || 1,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                />
              </label>

              <label className="flex items-center gap-2 pt-7 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={guest.is_host}
                  onChange={(event) =>
                    updateGuest(guest.id, { is_host: event.target.checked })
                  }
                />
                Host guest
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">
                Allergies
                <input
                  value={guest.allergiesText}
                  onChange={(event) =>
                    updateGuest(guest.id, { allergiesText: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Comma-separated"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Intolerances
                <input
                  value={guest.intolerancesText}
                  onChange={(event) =>
                    updateGuest(guest.id, {
                      intolerancesText: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Comma-separated"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Dietary restrictions
                <input
                  value={guest.dietaryRestrictionsText}
                  onChange={(event) =>
                    updateGuest(guest.id, {
                      dietaryRestrictionsText: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Comma-separated"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Dislikes
                <input
                  value={guest.dislikesText}
                  onChange={(event) =>
                    updateGuest(guest.id, { dislikesText: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Comma-separated"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">
                Wine preferences
                <textarea
                  value={guest.winePreferencesText}
                  onChange={(event) =>
                    updateGuest(guest.id, {
                      winePreferencesText: event.target.value,
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Pairing interest, preferred styles, exclusions"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Notes
                <textarea
                  value={guest.notesText}
                  onChange={(event) =>
                    updateGuest(guest.id, { notesText: event.target.value })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
                  placeholder="Service or kitchen notes"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => saveGuestProfile(guest)}
                disabled={savingGuestId === guest.id}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {savingGuestId === guest.id ? "Saving..." : "Save guest"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}
    </section>
  );
}
