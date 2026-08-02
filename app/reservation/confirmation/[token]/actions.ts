"use server";

import { createClient } from "@/lib/supabase/server";

export type GuestFormState = { status: "idle" | "success" | "error"; message: string };
export const initialGuestFormState: GuestFormState = { status: "idle", message: "" };
const value = (data: FormData, name: string) => { const item = data.get(name); return typeof item === "string" ? item.trim() : ""; };
const error = (message: string): GuestFormState => ({ status: "error", message });

export async function submitCommunicationPreferences(_: GuestFormState, data: FormData): Promise<GuestFormState> {
  const token = value(data, "token"), channel = value(data, "preferred_channel"), language = value(data, "preferred_language");
  if (token.length !== 64 || !["email", "phone", "whatsapp", "sms"].includes(channel) || !["pt", "en"].includes(language)) return error("Please provide valid communication preferences.");
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("submit_guest_communication_preferences", {
    p_token: token, p_preferred_channel: channel, p_preferred_language: language,
    p_can_contact: data.get("can_contact_about_reservation") === "yes",
  });
  if (rpcError) return error("This confirmation link is no longer available.");
  return { status: "success", message: language === "pt" ? "As suas preferências foram enviadas para revisão." : "Your preferences were sent for review." };
}

export async function submitGuestNotes(_: GuestFormState, data: FormData): Promise<GuestFormState> {
  const token = value(data, "token");
  const allergies = value(data, "allergies_dietary_note"), occasion = value(data, "special_occasion_note"), arrival = value(data, "arrival_accessibility_note"), general = value(data, "general_note");
  if (token.length !== 64 || ![allergies, occasion, arrival, general].some(Boolean)) return error("Please share at least one note.");
  if (allergies.length > 2000 || occasion.length > 1000 || arrival.length > 2000 || general.length > 2000) return error("One or more notes are too long.");
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("submit_guest_reservation_notes", {
    p_token: token, p_allergies_dietary_note: allergies || null, p_special_occasion_note: occasion || null,
    p_arrival_accessibility_note: arrival || null, p_general_note: general || null,
  });
  if (rpcError) return error("This confirmation link is no longer available.");
  return { status: "success", message: "Thank you. The restaurant team will review your update before your visit." };
}
