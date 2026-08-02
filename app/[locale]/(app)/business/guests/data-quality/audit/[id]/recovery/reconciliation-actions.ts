"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RecoveryActionState } from "./actions";

export async function recordGuestMergeReconciliationReview(
  executionEventId: string,
  _previousState: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Authentication required." };

  const status = formData.get("review_status");
  const notes = formData.get("notes");
  if (typeof status !== "string" || !["pending", "completed", "requires_follow_up"].includes(status)) {
    return { status: "error", message: "Select a valid review status." };
  }

  const { error } = await supabase.rpc("record_guest_merge_reconciliation_review_v1", {
    p_recovery_execution_event_id: executionEventId,
    p_review_status: status,
    p_notes: typeof notes === "string" ? notes.trim() || null : null,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/[locale]/business/guests/data-quality/audit", "layout");
  revalidatePath("/[locale]/business/reconciliation", "layout");
  return {
    status: "success",
    message: status === "requires_follow_up"
      ? "Immutable review recorded and routed to the reconciliation queue."
      : "Immutable reconciliation review recorded.",
  };
}
