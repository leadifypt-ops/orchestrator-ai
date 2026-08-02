"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OPERATIONAL_NOTE_TYPES } from "@/lib/operational-capacity";

export type ReviewActionState = { status: "idle" | "success" | "error"; message: string };
export const initialReviewActionState: ReviewActionState = { status: "idle", message: "" };

function text(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate.trim() : "";
}
function optional(formData: FormData, name: string) { return text(formData, name) || null; }
function failure(message: string): ReviewActionState { return { status: "error", message }; }
async function client() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
function complete(message: string): ReviewActionState {
  revalidatePath("/[locale]/business/availability", "layout");
  return { status: "success", message };
}

export async function saveCapacityOverride(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const { supabase, user } = await client();
  if (!user) return failure("Authentication required.");
  const capacity = Number(text(formData, "adjusted_capacity"));
  const reason = text(formData, "reason");
  const date = text(formData, "operational_date");
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 5000 || !reason || reason.length > 500 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return failure("Provide a date, capacity from 0 to 5000 and a reason.");
  const { data, error } = await supabase.rpc("save_operational_capacity_override_v1", {
    p_business_id: text(formData, "business_id"), p_restaurant_id: text(formData, "restaurant_id"),
    p_service_period_id: text(formData, "service_period_id"), p_operational_date: date,
    p_adjusted_capacity: capacity, p_reason: reason,
  });
  if (error) return failure(error.message);
  return complete((data as { changed?: boolean } | null)?.changed ? "Manual override saved and audited." : "This override is already current.");
}

export async function endCapacityOverride(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const { supabase, user } = await client();
  if (!user) return failure("Authentication required.");
  const reason = text(formData, "reason");
  if (!reason || reason.length > 500) return failure("A reason is required.");
  const { error } = await supabase.rpc("end_operational_capacity_override_v1", { p_override_id: text(formData, "override_id"), p_reason: reason });
  if (error) return failure(error.message);
  return complete("Manual override ended and audited.");
}

export async function saveOperationalNote(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const { supabase, user } = await client();
  if (!user) return failure("Authentication required.");
  const noteType = text(formData, "note_type");
  const note = text(formData, "note");
  const date = text(formData, "operational_date");
  if (!OPERATIONAL_NOTE_TYPES.includes(noteType as never) || !note || note.length > 1000 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return failure("Provide a valid date, note type and note.");
  const { error } = await supabase.rpc("save_operational_capacity_note_v1", {
    p_business_id: text(formData, "business_id"), p_restaurant_id: text(formData, "restaurant_id"),
    p_service_period_id: optional(formData, "service_period_id"), p_operational_date: date,
    p_note_type: noteType, p_note: note,
  });
  if (error) return failure(error.message);
  return complete("Operational note saved and audited.");
}

export async function endOperationalNote(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const { supabase, user } = await client();
  if (!user) return failure("Authentication required.");
  const reason = text(formData, "reason");
  if (!reason || reason.length > 500) return failure("A reason is required.");
  const { error } = await supabase.rpc("end_operational_capacity_note_v1", { p_note_id: text(formData, "note_id"), p_reason: reason });
  if (error) return failure(error.message);
  return complete("Operational note ended and audited.");
}
