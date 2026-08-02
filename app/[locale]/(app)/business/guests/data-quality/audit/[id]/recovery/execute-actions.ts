"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RecoveryActionState } from "./actions";

export async function executeGuestMergeRecovery(
  recoveryEventId: string,
  _previousState: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Authentication required." };

  const confirmation = formData.get("confirmation");
  if (formData.get("reviewed") !== "on" || confirmation !== "RECOVERY") {
    return { status: "error", message: 'Review the execution scope and type "RECOVERY" to confirm.' };
  }

  const { data, error } = await supabase.rpc("recover_guest_merge_v1", {
    p_recovery_event_id: recoveryEventId,
    p_confirmation: confirmation,
  });
  if (error) return { status: "error", message: error.message };

  const result = data && typeof data === "object"
    ? data as { recovered_record_count?: number; skipped_record_count?: number }
    : {};
  revalidatePath("/[locale]/business/guests/data-quality/audit", "layout");
  return {
    status: "success",
    message: `Recovery executed. ${result.recovered_record_count || 0} provenance-backed records restored; ${result.skipped_record_count || 0} unsupported provenance records left unchanged.`,
  };
}
