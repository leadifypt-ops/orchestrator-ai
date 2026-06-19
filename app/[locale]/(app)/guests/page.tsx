import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type GuestsPageProps = {
  params: Promise<{
    locale: string;
  }>;
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
  reservation_id: string;
  full_name: string | null;
  guest_position: number;
  is_host: boolean;
  created_at: string;
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function summarizeList(values?: string[] | null) {
  if (!values?.length) return "None recorded";

  if (values.length <= 3) return values.join(", ");

  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
}

function preview(value?: string | null) {
  const text = value?.trim();

  if (!text) return "No notes yet";
  if (text.length <= 120) return text;

  return `${text.slice(0, 117)}...`;
}

function getGuestName(guest: ReservationGuestRow) {
  return guest.full_name?.trim() || `Guest ${guest.guest_position}`;
}

export default async function GuestsPage({ params }: GuestsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: guestRows = [] } = await supabase
    .from("reservation_guests")
    .select(
      `
        id,
        reservation_id,
        full_name,
        guest_position,
        is_host,
        created_at,
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
    )
    .order("created_at", { ascending: false });

  const guests = ((guestRows as ReservationGuestRow[]) || []).map((guest) => ({
    ...guest,
    dietary_profile: guest.guest_dietary_profiles?.[0] || null,
  }));

  return (
    <div className="space-y-6 p-6 text-white">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Guests
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Guest profiles</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
            Review saved gastronomic profiles across reservation requests,
            including dietary risks, wine preferences, and service notes.
          </p>
        </div>

        <Link
          href={`/${locale}/reservations/new`}
          className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Create reservation request
        </Link>
      </div>

      {guests.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {guests.map((guest) => {
            const profile = guest.dietary_profile;

            return (
              <article
                key={guest.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        {getGuestName(guest)}
                      </h2>
                      {guest.is_host ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                          Host
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Reservation {guest.reservation_id}
                    </p>
                  </div>

                  <Link
                    href={`/${locale}/reservations/${guest.reservation_id}`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Open reservation
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                      Allergies
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {summarizeList(profile?.allergies)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                      Intolerances
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {summarizeList(profile?.intolerances)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                      Dietary restrictions
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {summarizeList(profile?.dietary_restrictions)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                      Wine preferences
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {profile?.wine_preferences?.trim() || "None recorded"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Notes preview
                  </p>
                  <p className="mt-1 leading-6 text-zinc-300">
                    {preview(profile?.notes)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
                  <span>Created {formatDate(guest.created_at)}</span>
                  <span>Guest position {guest.guest_position}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-semibold text-white">
            No guest profiles yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Add a gastronomic profile while creating a manual reservation
            request, or add guests later from a reservation detail page.
          </p>
          <Link
            href={`/${locale}/reservations/new`}
            className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Create reservation request
          </Link>
        </div>
      )}
    </div>
  );
}
