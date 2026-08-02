"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GuestDataQualityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialError = (message: string): GuestDataQualityActionState => ({
  status: "error",
  message,
});

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateCompanionContact(
  guestId: string,
  _previousState: GuestDataQualityActionState,
  formData: FormData
): Promise<GuestDataQualityActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return initialError("Authentication required.");

  const { error } = await supabase.rpc(
    "update_reservation_guest_contact_v1",
    {
      p_reservation_guest_id: guestId,
      p_full_name: text(formData, "full_name") || null,
      p_email: text(formData, "email") || null,
      p_phone: text(formData, "phone") || null,
    }
  );

  if (error) {
    return initialError(
      error.code === "23505"
        ? "This contact belongs to another identity. Review it as a possible duplicate."
        : error.message
    );
  }

  revalidatePath("/[locale]/business/guests", "layout");
  return {
    status: "success",
    message: "Guest contact saved and identity matching completed.",
  };
}

export async function updateGuestCorrection(
  identityId: string,
  _previousState: GuestDataQualityActionState,
  formData: FormData
): Promise<GuestDataQualityActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return initialError("Authentication required.");

  const { error } = await supabase.rpc("update_guest_crm_profile_v1", {
    p_guest_identity_id: identityId,
    p_full_name: text(formData, "full_name") || null,
    p_email: text(formData, "email") || null,
    p_phone: text(formData, "phone") || null,
    p_wine_preferences: text(formData, "wine_preferences") || null,
    p_notes: text(formData, "notes") || null,
  });

  if (error) {
    return initialError(
      error.code === "23505"
        ? "Email or phone belongs to another identity. Use duplicate review before any merge."
        : error.message
    );
  }

  revalidatePath("/[locale]/business/guests", "layout");
  return {
    status: "success",
    message: "CRM correction saved. Reservation history was not changed.",
  };
}

export async function mergeGuestIdentities(
  sourceIdentityId: string,
  targetIdentityId: string,
  _previousState: GuestDataQualityActionState,
  formData: FormData
): Promise<GuestDataQualityActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return initialError("Authentication required.");

  const confirmation = text(formData, "confirmation");
  const reviewed = formData.get("reviewed") === "on";

  if (!reviewed || confirmation !== "MERGE") {
    return initialError(
      'Review the impact and type "MERGE" to confirm this operation.'
    );
  }

  const { data, error } = await supabase.rpc("merge_guest_identities_v1", {
    p_source_identity_id: sourceIdentityId,
    p_target_identity_id: targetIdentityId,
    p_confirmation: confirmation,
  });

  if (error) return initialError(error.message);

  const result =
    data && typeof data === "object"
      ? (data as {
          reservations_reassigned?: number;
          profiles_reassigned?: number;
        })
      : {};

  return {
    status: "success",
    message: `Merge completed. ${result.reservations_reassigned || 0} reservations and ${result.profiles_reassigned || 0} guest profiles were reassociated.`,
  };
}
