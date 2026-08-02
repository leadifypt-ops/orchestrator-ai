"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommunicationActionState = { status: "idle" | "success" | "error"; message: string };
export const initialCommunicationState: CommunicationActionState = { status: "idle", message: "" };
const value = (data: FormData, name: string) => {
  const item = data.get(name);
  return typeof item === "string" ? item.trim() : "";
};

async function client() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}
function refresh(reservationId?: string) {
  revalidatePath("/[locale]/business/reservations/communications", "page");
  if (reservationId) revalidatePath("/[locale]/business/reservations/decisions/[id]", "page");
}
const failure = (message: string): CommunicationActionState => ({ status: "error", message });

export async function createConfirmationDraft(_: CommunicationActionState, data: FormData): Promise<CommunicationActionState> {
  const supabase = await client();
  if (!supabase) return failure("Authentication required.");
  const reservationId = value(data, "reservation_id");
  const channel = value(data, "channel");
  const language = value(data, "language");
  if (!reservationId) return failure("Reservation is required.");
  const { error } = await supabase.rpc("create_reservation_confirmation_draft", {
    p_reservation_id: reservationId, p_channel: channel || "email", p_language: language || "en",
  });
  if (error) return failure(error.message);
  refresh(reservationId);
  return { status: "success", message: "Confirmation draft created. Nothing was sent." };
}

export async function updateCommunicationDraft(_: CommunicationActionState, data: FormData): Promise<CommunicationActionState> {
  const supabase = await client();
  if (!supabase) return failure("Authentication required.");
  const communicationId = value(data, "communication_id"), reservationId = value(data, "reservation_id");
  const subject = value(data, "subject"), body = value(data, "body"), channel = value(data, "channel");
  if (!communicationId || !body || body.length > 10000 || subject.length > 300) return failure("Valid communication content is required.");
  const { error } = await supabase.rpc("update_reservation_communication_draft", {
    p_communication_id: communicationId, p_subject: subject, p_body: body, p_channel: channel,
  });
  if (error) return failure(error.message);
  refresh(reservationId);
  return { status: "success", message: "Draft updated and returned to review." };
}

async function transition(kind: "ready" | "sent" | "cancel", _: CommunicationActionState, data: FormData): Promise<CommunicationActionState> {
  const supabase = await client();
  if (!supabase) return failure("Authentication required.");
  const communicationId = value(data, "communication_id"), reservationId = value(data, "reservation_id"), reason = value(data, "reason");
  if (!communicationId) return failure("Communication is required.");
  if (kind === "cancel" && !reason) return failure("A cancellation reason is required.");
  const result = kind === "ready"
    ? await supabase.rpc("mark_reservation_communication_ready", { p_communication_id: communicationId })
    : kind === "sent"
      ? await supabase.rpc("mark_reservation_communication_sent", { p_communication_id: communicationId })
      : await supabase.rpc("cancel_reservation_communication", { p_communication_id: communicationId, p_reason: reason });
  if (result.error) return failure(result.error.message);
  refresh(reservationId);
  return { status: "success", message: kind === "ready" ? "Communication marked ready." : kind === "sent" ? "Communication marked sent. No provider was called." : "Communication cancelled." };
}
export const markCommunicationReady = transition.bind(null, "ready");
export const markCommunicationSent = transition.bind(null, "sent");
export const cancelCommunication = transition.bind(null, "cancel");
