"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecoveryActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function recordGuestMergeRecoveryPreview(
  mergeAuditEventId: string,
  _previousState: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Authentication required." };

  const confirmation = formData.get("confirmation");
  if (formData.get("reviewed") !== "on" || confirmation !== "RECOVERY") {
    return { status: "error", message: 'Review the preview and type "RECOVERY" to confirm.' };
  }

  const { error } = await supabase.rpc("record_guest_merge_recovery_preview_v1", {
    p_merge_audit_event_id: mergeAuditEventId,
    p_confirmation: confirmation,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/[locale]/business/guests/data-quality/audit", "layout");
  return { status: "success", message: "Governed recovery review recorded. No guest data was changed." };
}
