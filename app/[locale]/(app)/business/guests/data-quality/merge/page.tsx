import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  uniqueValues,
  type GuestDietaryProfileRow,
  type GuestIdentityRow,
} from "@/lib/guest-history";
import type { GuestCrmProfileRow } from "@/lib/guest-data-quality";
import { mergeGuestIdentities } from "../actions";
import MergeConfirmationForm from "./merge-confirmation-form";

type MergePreviewPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    source?: string | string[];
    target?: string | string[];
  }>;
};

type MergeIdentityRow = GuestIdentityRow & {
  merged_into_identity_id: string | null;
};

type MergeGuestProfileRow = {
  guest_identity_id: string | null;
  canonical_reservation_id: string | null;
  guest_dietary_profiles: GuestDietaryProfileRow[] | null;
};

type IdentityReservationRow = {
  id: string;
  guest_identity_id: string | null;
};

export const dynamic = "force-dynamic";

function single(value?: string | string[]) {
  return typeof value === "string" ? value : null;
}

function Difference({
  label,
  source,
  target,
}: {
  label: string;
  source: string | null;
  target: string | null;
}) {
  const differs = source !== target;
  return (
    <div
      className={`rounded-xl border p-3 ${
        differs
          ? "border-amber-500/20 bg-amber-500/[0.05]"
          : "border-white/10 bg-black/30"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
        {label}
      </p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <span className="text-zinc-600">Source:</span>{" "}
          {source || "Not recorded"}
        </p>
        <p>
          <span className="text-zinc-600">Destination:</span>{" "}
          {target || "Not recorded"}
        </p>
      </div>
    </div>
  );
}

function historicalValues(
  profiles: MergeGuestProfileRow[],
  identityId: string,
  key: "allergies" | "intolerances" | "dietary_restrictions"
) {
  return uniqueValues(
    profiles
      .filter((profile) => profile.guest_identity_id === identityId)
      .flatMap((profile) => profile.guest_dietary_profiles?.[0]?.[key] || [])
  );
}

function countVisits(
  identityId: string,
  reservations: IdentityReservationRow[],
  profiles: MergeGuestProfileRow[]
) {
  return new Set([
    ...reservations
      .filter((reservation) => reservation.guest_identity_id === identityId)
      .map((reservation) => reservation.id),
    ...profiles
      .filter((profile) => profile.guest_identity_id === identityId)
      .flatMap((profile) =>
        profile.canonical_reservation_id
          ? [profile.canonical_reservation_id]
          : []
      ),
  ]).size;
}

export default async function MergePreviewPage({
  params,
  searchParams,
}: MergePreviewPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const sourceId = single(query.source);
  const targetId = single(query.target);
  if (!sourceId || !targetId || sourceId === targetId) notFound();

  const supabase = await createClient();
  const [identitiesResult, crmProfilesResult, guestProfilesResult, reservationsResult] =
    await Promise.all([
      supabase
        .from("guest_identities")
        .select(
          "id, full_name, email, phone, first_seen_at, last_seen_at, merged_into_identity_id"
        )
        .in("id", [sourceId, targetId]),
      supabase
        .from("guest_crm_profiles")
        .select(
          "guest_identity_id, wine_preferences, notes, updated_at, updated_by"
        )
        .in("guest_identity_id", [sourceId, targetId]),
      supabase
        .from("reservation_guests")
        .select(
          "guest_identity_id, canonical_reservation_id, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
        )
        .in("guest_identity_id", [sourceId, targetId]),
      supabase
        .from("reservations")
        .select("id, guest_identity_id")
        .in("guest_identity_id", [sourceId, targetId]),
    ]);

  const identities =
    (identitiesResult.data as MergeIdentityRow[] | null) || [];
  const source = identities.find((identity) => identity.id === sourceId);
  const target = identities.find((identity) => identity.id === targetId);
  if (
    !source ||
    !target ||
    source.merged_into_identity_id ||
    target.merged_into_identity_id
  ) {
    notFound();
  }

  const crmProfiles =
    (crmProfilesResult.data as GuestCrmProfileRow[] | null) || [];
  const sourceProfile = crmProfiles.find(
    (profile) => profile.guest_identity_id === sourceId
  );
  const targetProfile = crmProfiles.find(
    (profile) => profile.guest_identity_id === targetId
  );
  const guestProfiles =
    (guestProfilesResult.data as MergeGuestProfileRow[] | null) || [];
  const reservations =
    (reservationsResult.data as IdentityReservationRow[] | null) || [];
  const sourceVisits = countVisits(sourceId, reservations, guestProfiles);
  const targetVisits = countVisits(targetId, reservations, guestProfiles);
  const sourceAllergies = historicalValues(
    guestProfiles,
    sourceId,
    "allergies"
  );
  const targetAllergies = historicalValues(
    guestProfiles,
    targetId,
    "allergies"
  );
  const sourceIntolerances = historicalValues(
    guestProfiles,
    sourceId,
    "intolerances"
  );
  const targetIntolerances = historicalValues(
    guestProfiles,
    targetId,
    "intolerances"
  );
  const sourceRestrictions = historicalValues(
    guestProfiles,
    sourceId,
    "dietary_restrictions"
  );
  const targetRestrictions = historicalValues(
    guestProfiles,
    targetId,
    "dietary_restrictions"
  );
  const mergeAction = mergeGuestIdentities.bind(null, sourceId, targetId);

  return (
    <div className="space-y-6 p-6 text-white">
      <Link
        href={`/${locale}/business/guests/data-quality`}
        className="text-sm text-zinc-500 hover:text-white"
      >
        Back to data quality
      </Link>

      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Manual identity merge
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Merge preview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          The destination remains the principal identity. Every reservation and
          guest profile linked to the source is reassociated transactionally;
          no reservation, dietary profile, timeline event, or identity is
          deleted.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-red-300/60">
            Source · becomes inactive
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {source.full_name || "Known guest"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {sourceVisits} linked visits
          </p>
        </section>
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-emerald-300/60">
            Destination · remains principal
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {target.full_name || "Known guest"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {targetVisits} current visits · {sourceVisits + targetVisits}{" "}
            projected before overlap deduplication
          </p>
        </section>
      </div>

      <Link
        href={`/${locale}/business/guests/data-quality/merge?source=${targetId}&target=${sourceId}`}
        className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
      >
        Swap source and destination
      </Link>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Conflicts and retained data</h2>
        <p className="text-sm leading-6 text-zinc-500">
          Destination identity and CRM fields win. Source CRM values remain on
          the inactive identity and in the immutable audit snapshot. Historical
          dietary profiles from both identities remain linked to their original
          reservation guests.
        </p>
        <Difference
          label="Name"
          source={source.full_name}
          target={target.full_name}
        />
        <Difference label="Email" source={source.email} target={target.email} />
        <Difference label="Phone" source={source.phone} target={target.phone} />
        <Difference
          label="CRM wine preference"
          source={sourceProfile?.wine_preferences || null}
          target={targetProfile?.wine_preferences || null}
        />
        <Difference
          label="CRM notes"
          source={sourceProfile?.notes || null}
          target={targetProfile?.notes || null}
        />
        <Difference
          label="Historical allergies"
          source={sourceAllergies.join(", ") || null}
          target={targetAllergies.join(", ") || null}
        />
        <Difference
          label="Historical intolerances"
          source={sourceIntolerances.join(", ") || null}
          target={targetIntolerances.join(", ") || null}
        />
        <Difference
          label="Historical dietary restrictions"
          source={sourceRestrictions.join(", ") || null}
          target={targetRestrictions.join(", ") || null}
        />
      </section>

      <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5">
        <h2 className="text-xl font-semibold">Explicit confirmation</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This action cannot be undone from the UI. The source identity is
          retained and marked as merged for auditability.
        </p>
        <MergeConfirmationForm
          action={mergeAction}
          targetName={target.full_name || "Known guest"}
          targetHref={`/${locale}/business/guests/${targetId}`}
        />
      </section>
    </div>
  );
}
