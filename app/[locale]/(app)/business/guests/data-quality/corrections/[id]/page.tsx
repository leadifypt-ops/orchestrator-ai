import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatGuestDate, type GuestIdentityRow } from "@/lib/guest-history";
import type {
  GuestCrmAuditEventRow,
  GuestCrmProfileRow,
} from "@/lib/guest-data-quality";
import DataQualityForm from "../../data-quality-form";
import { updateGuestCorrection } from "../../actions";

type CorrectionPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export const dynamic = "force-dynamic";

export default async function GuestCorrectionPage({
  params,
}: CorrectionPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const [identityResult, profileResult, auditResult] = await Promise.all([
    supabase
      .from("guest_identities")
      .select("id, full_name, email, phone, first_seen_at, last_seen_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("guest_crm_profiles")
      .select(
        "guest_identity_id, wine_preferences, notes, updated_at, updated_by"
      )
      .eq("guest_identity_id", id)
      .maybeSingle(),
    supabase
      .from("guest_crm_audit_events")
      .select(
        "id, changed_by, previous_values, new_values, created_at"
      )
      .eq("guest_identity_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (!identityResult.data) notFound();

  const identity = identityResult.data as GuestIdentityRow;
  const profile = profileResult.data as GuestCrmProfileRow | null;
  const latestAudit = (
    (auditResult.data as GuestCrmAuditEventRow[] | null) || []
  )[0];
  const action = updateGuestCorrection.bind(null, identity.id);

  return (
    <div className="space-y-6 p-6 text-white">
      <Link
        href={`/${locale}/business/guests/data-quality`}
        className="text-sm text-zinc-500 hover:text-white"
      >
        Back to data quality
      </Link>

      <section className="max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Controlled correction
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {identity.full_name || "Known guest"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Contact corrections update the identity used by the existing matching
          algorithm. CRM preference and note corrections are stored separately
          and never overwrite reservation profiles or visit history.
        </p>

        <div className="mt-6">
          <DataQualityForm
            action={action}
            submitLabel="Save correction"
            fields={[
              {
                name: "full_name",
                label: "Corrected name",
                value: identity.full_name || "",
              },
              {
                name: "email",
                label: "Corrected email",
                value: identity.email || "",
                type: "email",
              },
              {
                name: "phone",
                label: "Corrected phone",
                value: identity.phone || "",
                type: "tel",
              },
              {
                name: "wine_preferences",
                label: "CRM wine preference",
                value: profile?.wine_preferences || "",
                type: "textarea",
              },
              {
                name: "notes",
                label: "CRM notes",
                value: profile?.notes || "",
                type: "textarea",
              },
            ]}
          />
        </div>
      </section>

      <section className="max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
          Audit foundation
        </h2>
        {latestAudit ? (
          <div className="mt-4 text-sm leading-6 text-zinc-400">
            <p>Latest correction: {formatGuestDate(latestAudit.created_at)}</p>
            <p>
              Actor: {latestAudit.changed_by || "User no longer available"}
            </p>
            <p className="mt-2 text-zinc-500">
              Previous and new values are stored as immutable audit payloads.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No corrections have been recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
