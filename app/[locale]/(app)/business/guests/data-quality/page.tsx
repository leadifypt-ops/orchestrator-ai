import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  detectDuplicateCandidates,
  type GuestContactProfileRow,
} from "@/lib/guest-data-quality";
import type { GuestIdentityRow } from "@/lib/guest-history";

type DataQualityPageProps = {
  params: Promise<{ locale: string }>;
};

type ScopedGuestRow = GuestContactProfileRow & {
  reservation_id: string | null;
};

export const dynamic = "force-dynamic";

export default async function GuestDataQualityPage({
  params,
}: DataQualityPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: identityData = [] }, { data: canonicalRows = [] }, { data: legacyRows = [] }] =
    await Promise.all([
      supabase
        .from("guest_identities")
        .select("id, full_name, email, phone, first_seen_at, last_seen_at")
        .order("last_seen_at", { ascending: false }),
      supabase.from("reservations").select("id"),
      supabase.from("leads").select("id").eq("user_id", user?.id),
    ]);

  const identities = (identityData as GuestIdentityRow[]) || [];
  const canonicalIds = (canonicalRows || []).map((row) => String(row.id));
  const legacyIds = (legacyRows || []).map((row) => String(row.id));
  const profileResults = await Promise.all([
    canonicalIds.length
      ? supabase
          .from("reservation_guests")
          .select(
            "id, reservation_id, canonical_reservation_id, guest_identity_id, full_name, email, phone, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
          )
          .in("canonical_reservation_id", canonicalIds)
      : Promise.resolve({ data: [] }),
    legacyIds.length
      ? supabase
          .from("reservation_guests")
          .select(
            "id, reservation_id, canonical_reservation_id, guest_identity_id, full_name, email, phone, guest_position, is_host, created_at, guest_dietary_profiles(id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)"
          )
          .in("reservation_id", legacyIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = profileResults.flatMap(
    (result) => (result.data as ScopedGuestRow[] | null) || []
  );
  const duplicates = detectDuplicateCandidates(identities, profiles);
  const identitiesById = new Map(
    identities.map((identity) => [identity.id, identity])
  );
  const unlinkedProfiles = profiles.filter(
    (profile) => !profile.guest_identity_id
  );

  return (
    <div className="space-y-6 p-6 text-white">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Guest CRM
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Data quality</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Complete companion contacts, review possible duplicate identities,
          and apply controlled guest corrections without rewriting reservation
          history.
        </p>
        <Link
          href={`/${locale}/business/guests`}
          className="mt-5 inline-flex text-sm text-zinc-400 hover:text-white"
        >
          Back to consolidated guests
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
            Known identities
          </p>
          <p className="mt-2 text-3xl font-semibold">{identities.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
            Possible duplicate pairs
          </p>
          <p className="mt-2 text-3xl font-semibold">{duplicates.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
            Profiles without identity
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {unlinkedProfiles.length}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Possible duplicates</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Signals are review-only. No identity is merged automatically.
        </p>
        {duplicates.length > 0 ? (
          <div className="mt-5 space-y-3">
            {duplicates.map((candidate) => {
              const source = identitiesById.get(candidate.sourceId);
              const target = identitiesById.get(candidate.targetId);
              return (
                <article
                  key={`${candidate.sourceId}-${candidate.targetId}`}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {source?.full_name || "Known guest"} ↔{" "}
                        {target?.full_name || "Known guest"}
                      </p>
                      <p className="mt-1 text-sm text-amber-200/70">
                        {candidate.reasons.join(" · ")}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/business/guests/data-quality/merge?source=${candidate.sourceId}&target=${candidate.targetId}`}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
                    >
                      Review merge
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-500">
            No duplicate signals were detected.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Companion contact completion</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Add email or phone only when supplied by the guest. Names are never
          used for identity matching.
        </p>
        {unlinkedProfiles.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {unlinkedProfiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {profile.full_name ||
                        `Guest ${profile.guest_position}`}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {profile.is_host ? "Host" : "Companion"} · No stable
                      contact
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/business/guests/data-quality/contacts/${profile.id}`}
                    className="text-sm text-zinc-400 hover:text-white"
                  >
                    Add contact
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-500">
            Every visible profile with contact data is linked.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xl font-semibold">Controlled corrections</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {identities.map((identity) => (
            <article
              key={identity.id}
              className="rounded-xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {identity.full_name || "Known guest"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {identity.email || identity.phone}
                  </p>
                </div>
                <Link
                  href={`/${locale}/business/guests/data-quality/corrections/${identity.id}`}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Correct profile
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
