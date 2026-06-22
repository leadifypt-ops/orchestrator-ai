import { createClient } from "@supabase/supabase-js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const allowedSlots = new Set(["19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30", "21:45", "22:00"]);

type GuestProfile = { name: string; allergies: string[]; intolerances: string[]; dietary_restrictions: string[]; dislikes: string[]; wine_preference: string; notes: string; reviewed: true };

function textValue(payload: Record<string, unknown>, field: string, maxLength: number) {
  const raw = payload[field];
  return typeof raw === "string" ? raw.trim().slice(0, maxLength) : "";
}
function listValue(payload: Record<string, unknown>, field: string) {
  return textValue(payload, field, 1000).split(",").map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
}
function stringList(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length > 120) return null;
    const normalized = item.trim();
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}
function normalizeProfiles(value: unknown, partySize: number): GuestProfile[] | null {
  if (!Array.isArray(value) || value.length !== partySize) return null;
  const profiles: GuestProfile[] = [];
  for (const valueProfile of value) {
    if (!valueProfile || typeof valueProfile !== "object" || Array.isArray(valueProfile)) return null;
    const profile = valueProfile as Record<string, unknown>;
    const allergies = stringList(profile.allergies);
    const intolerances = stringList(profile.intolerances);
    const restrictions = stringList(profile.dietary_restrictions);
    const dislikes = typeof profile.dislikes === "string" ? profile.dislikes.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20) : null;
    if (profile.reviewed !== true || !allergies || !intolerances || !restrictions || !dislikes || dislikes.some((item) => item.length > 120)) return null;
    const name = typeof profile.name === "string" ? profile.name.trim() : "";
    const wine = typeof profile.wine_preference === "string" ? profile.wine_preference.trim() : "";
    const notes = typeof profile.notes === "string" ? profile.notes.trim() : "";
    if (name.length > 160 || wine.length > 2000 || notes.length > 2000) return null;
    profiles.push({ name, allergies, intolerances, dietary_restrictions: restrictions, dislikes, wine_preference: wine, notes, reviewed: true });
  }
  return profiles;
}
function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}
function errorResponse(message: string, status: number) { return Response.json({ success: false, message }, { status }); }

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("Invalid reservation request.", 400);
    payload = body as Record<string, unknown>;
  } catch { return errorResponse("Invalid reservation request.", 400); }

  const restaurantSlug = textValue(payload, "restaurant_slug", 120).toLowerCase();
  const guestName = textValue(payload, "name", 160);
  const guestEmail = textValue(payload, "email", 320).toLowerCase();
  const requestedDate = textValue(payload, "requested_date", 10);
  const requestedTime = textValue(payload, "requested_time", 5);
  const partySize = Number(payload.party_size);
  if (!restaurantSlug || !guestName || !guestEmail || !requestedDate || !requestedTime) return errorResponse("Please complete all required fields.", 400);
  if (!emailPattern.test(guestEmail)) return errorResponse("Please enter a valid email address.", 400);
  if (!isRealDate(requestedDate) || !timePattern.test(requestedTime)) return errorResponse("Please select a valid reservation date and time.", 400);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) return errorResponse("Party size must be between 1 and 20.", 400);
  const isV2 = payload.guest_profiles !== undefined;
  const profiles = isV2 ? normalizeProfiles(payload.guest_profiles, partySize) : null;
  if (isV2 && (!allowedSlots.has(requestedTime) || !profiles)) return errorResponse("Please review every guest profile and select a valid time before submitting.", 400);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return errorResponse("Reservation requests are temporarily unavailable.", 503);
  try {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const rpc = isV2 ? "create_public_reservation_v2" : "create_public_reservation_v1";
    const args = isV2
      ? { p_restaurant_slug: restaurantSlug, p_guest_name: guestName, p_guest_email: guestEmail, p_guest_phone: textValue(payload, "phone", 50) || null, p_requested_date: requestedDate, p_requested_time: requestedTime, p_party_size: partySize, p_occasion: textValue(payload, "occasion", 200) || null, p_special_request: textValue(payload, "special_request", 2000) || null, p_experience_notes: textValue(payload, "experience_notes", 2000) || null, p_guest_profiles: profiles }
      : { p_restaurant_slug: restaurantSlug, p_guest_name: guestName, p_guest_email: guestEmail, p_guest_phone: textValue(payload, "phone", 50) || null, p_requested_date: requestedDate, p_requested_time: requestedTime, p_party_size: partySize, p_occasion: textValue(payload, "occasion", 200) || null, p_special_request: textValue(payload, "special_request", 2000) || null, p_allergies: listValue(payload, "allergies"), p_intolerances: listValue(payload, "intolerances"), p_dietary_restrictions: listValue(payload, "dietary_restrictions"), p_dislikes: listValue(payload, "dislikes"), p_wine_preferences: textValue(payload, "wine_preferences", 2000) || null, p_experience_notes: textValue(payload, "experience_notes", 2000) || null };
    const { error } = await supabase.rpc(rpc, args);
    if (error) {
      console.error("Public reservation RPC failed", { code: error.code, rpc });
      return errorResponse("We could not submit your request. Please try again.", 503);
    }
  } catch (error) {
    console.error("Public reservation RPC request failed", { error: error instanceof Error ? error.name : "UnknownError", rpc: "create_public_reservation_v2" });
    return errorResponse("We could not submit your request. Please try again.", 503);
  }
  return Response.json({ success: true, message: "Your reservation request has been received and will be reviewed by the restaurant." });
}
