import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type ReservationPayload = {
  party_size?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  occasion?: string | null;
  restaurant_or_experience?: string | null;
};

type ReservationRequest = {
  id: string;
  name: string | null;
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
  payload?: ReservationPayload | null;
  created_at: string | null;
};

type GuestDietaryProfileRow = {
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
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};

type ReservationBriefing = {
  guestCount: number;
  alertCount: number;
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  dislikes: string[];
  winePreferences: string[];
  notes: string[];
};

export const dynamic = "force-dynamic";

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
  };

  return labels[String(status || "new").toLowerCase()] || "New request";
}

function getLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "Date not set";

  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRequestedDate(request: ReservationRequest) {
  return request.requested_date || request.payload?.requested_date || null;
}

function getRequestedTime(request: ReservationRequest) {
  return request.requested_time || request.payload?.requested_time || null;
}

function getPartySize(request: ReservationRequest) {
  return request.party_size || request.payload?.party_size || null;
}

function getOccasion(request: ReservationRequest) {
  return request.occasion || request.payload?.occasion || null;
}

function getExperienceName(request: ReservationRequest) {
  return (
    request.requested_experience ||
    request.service ||
    request.payload?.restaurant_or_experience ||
    request.restaurant_name ||
    request.restaurant ||
    "Dining experience to confirm"
  );
}

function isPendingConfirmation(request: ReservationRequest) {
  return ["new", "contacted", "active", "qualified"].includes(
    String(request.status || "new").toLowerCase()
  );
}

function getNoShowRisk(request: ReservationRequest) {
  if (request.status === "lost") return true;

  return !request.phone && !request.whatsapp && !request.instagram;
}

function summarizeValues(values: string[]) {
  if (values.length === 0) return "None recorded";
  if (values.length <= 3) return values.join(", ");

  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
}

function makeEmptyBriefing(): ReservationBriefing {
  return {
    guestCount: 0,
    alertCount: 0,
    allergies: [],
    intolerances: [],
    dietaryRestrictions: [],
    dislikes: [],
    winePreferences: [],
    notes: [],
  };
}

function buildBriefingMap(guests: ReservationGuestRow[]) {
  const map = new Map<string, ReservationBriefing>();

  for (const guest of guests) {
    const briefing = map.get(guest.reservation_id) || makeEmptyBriefing();
    const profile = guest.guest_dietary_profiles?.[0] || null;
    const guestName = guest.full_name || `Guest ${guest.guest_position}`;

    briefing.guestCount += 1;

    const allergies = profile?.allergies || [];
    const intolerances = profile?.intolerances || [];
    const dietaryRestrictions = profile?.dietary_restrictions || [];

    briefing.allergies.push(...allergies.map((item) => `${guestName}: ${item}`));
    briefing.intolerances.push(
      ...intolerances.map((item) => `${guestName}: ${item}`)
    );
    briefing.dietaryRestrictions.push(
      ...dietaryRestrictions.map((item) => `${guestName}: ${item}`)
    );
    briefing.dislikes.push(
      ...(profile?.dislikes || []).map((item) => `${guestName}: ${item}`)
    );

    if (profile?.wine_preferences?.trim()) {
      briefing.winePreferences.push(
        `${guestName}: ${profile.wine_preferences.trim()}`
      );
    }

    if (profile?.notes?.trim()) {
      briefing.notes.push(`${guestName}: ${profile.notes.trim()}`);
    }

    briefing.alertCount +=
      allergies.length + intolerances.length + dietaryRestrictions.length;

    map.set(guest.reservation_id, briefing);
  }

  return map;
}

function ReservationServiceItem({
  locale,
  request,
  briefing,
}: {
  locale: string;
  request: ReservationRequest;
  briefing: ReservationBriefing;
}) {
  const requestedTime = getRequestedTime(request);
  const requestedDate = getRequestedDate(request);
  const partySize = getPartySize(request);
  const occasion = getOccasion(request);
  const dietarySummary = [
    ...briefing.allergies,
    ...briefing.intolerances,
    ...briefing.dietaryRestrictions,
  ];

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-zinc-200">
              {requestedTime || "Time not set"}
            </span>
            <h3 className="text-lg font-semibold text-white">
              {request.name || "Unnamed guest"}
            </h3>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
            <p>
              <span className="text-zinc-600">Experience:</span>{" "}
              {getExperienceName(request)}
            </p>
            <p>
              <span className="text-zinc-600">Party:</span>{" "}
              {partySize || "Not specified"}
            </p>
            <p>
              <span className="text-zinc-600">Status:</span>{" "}
              {getStatusLabel(request.status)}
            </p>
            <p>
              <span className="text-zinc-600">Date:</span>{" "}
              {formatDisplayDate(requestedDate)}
            </p>
          </div>

          {occasion ? (
            <p className="mt-3 text-sm text-amber-200">
              Occasion: {occasion}
            </p>
          ) : null}

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Dietary alerts:{" "}
            <span className={dietarySummary.length ? "text-red-300" : ""}>
              {dietarySummary.length
                ? summarizeValues(dietarySummary)
                : "None recorded"}
            </span>
          </p>
        </div>

        <Link
          href={`/${locale}/reservations/${request.id}`}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-center text-sm font-medium text-black"
        >
          Open briefing
        </Link>
      </div>
    </article>
  );
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads = [] } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  const reservationRequests = (leads as ReservationRequest[]) ?? [];
  const reservationIds = reservationRequests.map((request) => request.id);

  const { data: guestRows = [] } = reservationIds.length
    ? await supabase
        .from("reservation_guests")
        .select(
          `
            id,
            reservation_id,
            full_name,
            guest_position,
            is_host,
            guest_dietary_profiles (
              allergies,
              intolerances,
              dietary_restrictions,
              dislikes,
              wine_preferences,
              notes
            )
          `
        )
        .in("reservation_id", reservationIds)
    : { data: [] };

  const briefingByReservation = buildBriefingMap(
    (guestRows as ReservationGuestRow[]) || []
  );

  const todayKey = getLocalDateKey(new Date());
  const datedReservations = reservationRequests.filter(getRequestedDate);
  const todaysReservations = datedReservations
    .filter((request) => getRequestedDate(request) === todayKey)
    .sort((a, b) =>
      String(getRequestedTime(a) || "99:99").localeCompare(
        String(getRequestedTime(b) || "99:99")
      )
    );

  const upcomingReservations = datedReservations
    .filter((request) => {
      const requestedDate = getRequestedDate(request);
      return !!requestedDate && requestedDate > todayKey;
    })
    .sort((a, b) => {
      const dateCompare = String(getRequestedDate(a)).localeCompare(
        String(getRequestedDate(b))
      );

      if (dateCompare !== 0) return dateCompare;

      return String(getRequestedTime(a) || "99:99").localeCompare(
        String(getRequestedTime(b) || "99:99")
      );
    })
    .slice(0, 6);

  const pendingConfirmations = reservationRequests.filter(isPendingConfirmation);
  const noShowRisk = reservationRequests.filter(getNoShowRisk);
  const specialOccasions = reservationRequests.filter(getOccasion);
  const criticalDietaryAlerts = reservationRequests.filter((request) => {
    const briefing =
      briefingByReservation.get(request.id) || makeEmptyBriefing();
    return briefing.alertCount > 0 || !!request.dietary_notes;
  });

  const totalGuestProfiles = Array.from(briefingByReservation.values()).reduce(
    (sum, briefing) => sum + briefing.guestCount,
    0
  );

  const overviewCards = [
    {
      label: "Today",
      value: todaysReservations.length,
      href: `/${locale}/reservations/new`,
      action: "Add reservation",
      helper: "Build today's service list",
    },
    {
      label: "Pending confirmations",
      value: pendingConfirmations.length,
      href: `/${locale}/reservations`,
      action: "Confirm requests",
      helper: "Move guests toward service",
    },
    {
      label: "Critical dietary alerts",
      value: criticalDietaryAlerts.length,
      href: criticalDietaryAlerts[0]
        ? `/${locale}/reservations/${criticalDietaryAlerts[0].id}`
        : `/${locale}/reservations`,
      action: "Review alerts",
      helper: "Prepare kitchen briefing",
    },
    {
      label: "Special occasions",
      value: specialOccasions.length,
      href: specialOccasions[0]
        ? `/${locale}/reservations/${specialOccasions[0].id}`
        : `/${locale}/reservations`,
      action: "Review occasions",
      helper: "Prepare service touches",
    },
    {
      label: "No-show risk",
      value: noShowRisk.length,
      href: `/${locale}/reservations`,
      action: "Check risk",
      helper: "Look for missing contacts",
    },
    {
      label: "Guest profiles",
      value: totalGuestProfiles,
      href: `/${locale}/guests`,
      action: "Open profiles",
      helper: "Review guest context",
    },
  ];

  const serviceBriefingCount = reservationRequests.filter((request) => {
    const briefing =
      briefingByReservation.get(request.id) || makeEmptyBriefing();
    return (
      briefing.winePreferences.length > 0 ||
      briefing.dislikes.length > 0 ||
      briefing.notes.length > 0 ||
      !!getOccasion(request)
    );
  }).length;

  return (
    <div className="space-y-6 p-6 text-white">
      <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Service Dashboard
          </div>
          <h1 className="mt-2 text-3xl font-semibold">
            Today&apos;s restaurant service
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Prepare the floor and kitchen around reservations, confirmations,
            dietary risks, occasions, and briefing notes before guests arrive.
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <Link
            href={`/${locale}/reservations/new`}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
          >
            Create reservation request
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${locale}/reservations`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
            >
              Open reservation board
            </Link>
            <Link
              href={`/${locale}/guests`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
            >
              View guest profiles
            </Link>
            <Link
              href={`/${locale}/restaurants`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
            >
              Manage restaurants
            </Link>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {overviewCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {card.value}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {card.helper}
            </p>
            <p className="mt-3 text-sm font-medium text-zinc-200">
              {card.action}
            </p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.8fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Reservations for today</h2>
            <p className="text-sm text-zinc-500">
              {new Date().toLocaleDateString("pt-PT", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
          </div>

          <div className="space-y-3">
            {todaysReservations.length ? (
              todaysReservations.map((request) => (
                <ReservationServiceItem
                  key={request.id}
                  locale={locale}
                  request={request}
                  briefing={
                    briefingByReservation.get(request.id) ||
                    makeEmptyBriefing()
                  }
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6">
                <h3 className="text-lg font-semibold">
                  No timed reservations for today
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Reservations without requested dates are still available on
                  the reservation board and can be prepared from their detail
                  pages.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/${locale}/reservations/new`}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Create today&apos;s first reservation
                  </Link>
                  <Link
                    href={`/${locale}/reservations`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white"
                  >
                    Open reservation board
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
              Today&apos;s service overview
            </h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-600">Guests expected:</span>{" "}
                {todaysReservations.reduce(
                  (sum, request) => sum + Number(getPartySize(request) || 0),
                  0
                ) || "Pending party sizes"}
              </p>
              <p>
                <span className="text-zinc-600">Briefings ready:</span>{" "}
                {serviceBriefingCount}
              </p>
              <p>
                <span className="text-zinc-600">Confirmations pending:</span>{" "}
                {pendingConfirmations.length}
              </p>
              <p>
                <span className="text-zinc-600">Kitchen alerts:</span>{" "}
                {criticalDietaryAlerts.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
              Analytics
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Insights will move to a dedicated analytics area later. This
              dashboard now prioritizes service readiness.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-xl font-semibold">Upcoming service reservations</h2>
          <div className="mt-4 space-y-3">
            {upcomingReservations.length ? (
              upcomingReservations.map((request) => (
                <ReservationServiceItem
                  key={request.id}
                  locale={locale}
                  request={request}
                  briefing={
                    briefingByReservation.get(request.id) ||
                    makeEmptyBriefing()
                  }
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-500">
                No upcoming dated reservations yet
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-semibold">Critical dietary alerts</h2>
            <div className="mt-4 space-y-3">
              {criticalDietaryAlerts.slice(0, 5).map((request) => {
                const briefing =
                  briefingByReservation.get(request.id) ||
                  makeEmptyBriefing();
                const alerts = [
                  ...briefing.allergies,
                  ...briefing.intolerances,
                  ...briefing.dietaryRestrictions,
                  request.dietary_notes || "",
                ].filter(Boolean);

                return (
                  <Link
                    key={request.id}
                    href={`/${locale}/reservations/${request.id}`}
                    className="block rounded-xl border border-white/10 bg-black/25 p-3 hover:bg-white/[0.04]"
                  >
                    <p className="font-medium">{request.name || "Unnamed guest"}</p>
                    <p className="mt-1 text-sm leading-6 text-red-300">
                      {summarizeValues(alerts)}
                    </p>
                  </Link>
                );
              })}

              {criticalDietaryAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm text-zinc-500">
                  No critical dietary alerts recorded
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-xl font-semibold">Special occasions</h2>
            <div className="mt-4 space-y-3">
              {specialOccasions.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  href={`/${locale}/reservations/${request.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3 hover:bg-white/[0.04]"
                >
                  <span className="font-medium">
                    {request.name || "Unnamed guest"}
                  </span>
                  <span className="text-sm text-amber-200">
                    {getOccasion(request)}
                  </span>
                </Link>
              ))}

              {specialOccasions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm text-zinc-500">
                  No special occasions recorded
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-xl font-semibold">Service briefing summary</h2>
          <div className="mt-4 space-y-3">
            {reservationRequests
              .filter((request) => {
                const briefing =
                  briefingByReservation.get(request.id) ||
                  makeEmptyBriefing();
                return (
                  briefing.dislikes.length > 0 ||
                  briefing.winePreferences.length > 0 ||
                  briefing.notes.length > 0 ||
                  !!getOccasion(request)
                );
              })
              .slice(0, 5)
              .map((request) => {
                const briefing =
                  briefingByReservation.get(request.id) ||
                  makeEmptyBriefing();

                return (
                  <Link
                    key={request.id}
                    href={`/${locale}/reservations/${request.id}`}
                    className="block rounded-xl border border-white/10 bg-black/25 p-3 hover:bg-white/[0.04]"
                  >
                    <p className="font-medium">{request.name || "Unnamed guest"}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Wine: {summarizeValues(briefing.winePreferences)}
                    </p>
                    <p className="text-sm leading-6 text-zinc-400">
                      Notes: {summarizeValues(briefing.notes)}
                    </p>
                  </Link>
                );
              })}

            {serviceBriefingCount === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm text-zinc-500">
                No service briefing details recorded yet
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-xl font-semibold">Kitchen briefing summary</h2>
          <div className="mt-4 space-y-3">
            {criticalDietaryAlerts.slice(0, 5).map((request) => {
              const briefing =
                briefingByReservation.get(request.id) || makeEmptyBriefing();
              const kitchenNotes = [
                ...briefing.allergies,
                ...briefing.intolerances,
                ...briefing.dietaryRestrictions,
                request.dietary_notes || "",
              ].filter(Boolean);

              return (
                <Link
                  key={request.id}
                  href={`/${locale}/reservations/${request.id}`}
                  className="block rounded-xl border border-white/10 bg-black/25 p-3 hover:bg-white/[0.04]"
                >
                  <p className="font-medium">{request.name || "Unnamed guest"}</p>
                  <p className="mt-1 text-sm leading-6 text-red-300">
                    {summarizeValues(kitchenNotes)}
                  </p>
                </Link>
              );
            })}

            {criticalDietaryAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm text-zinc-500">
                No kitchen briefing risks recorded yet
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
