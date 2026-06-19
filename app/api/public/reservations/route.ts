import { createClient } from "@supabase/supabase-js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function textValue(payload: Record<string, unknown>, field: string, maxLength: number) {
  const raw = payload[field];
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxLength);
}

function listValue(payload: Record<string, unknown>, field: string) {
  return textValue(payload, field, 1000)
    .split(",")
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 20);
}

function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function errorResponse(message: string, status: number) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Invalid reservation request.", 400);
    }
    payload = body as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid reservation request.", 400);
  }

  const restaurantSlug = textValue(payload, "restaurant_slug", 120).toLowerCase();
  const guestName = textValue(payload, "name", 160);
  const guestEmail = textValue(payload, "email", 320).toLowerCase();
  const requestedDate = textValue(payload, "requested_date", 10);
  const requestedTime = textValue(payload, "requested_time", 5);
  const partySize = Number(textValue(payload, "party_size", 2));

  if (!restaurantSlug || !guestName || !guestEmail || !requestedDate || !requestedTime) {
    return errorResponse("Please complete all required fields.", 400);
  }

  if (!emailPattern.test(guestEmail)) {
    return errorResponse("Please enter a valid email address.", 400);
  }

  if (!isRealDate(requestedDate) || !timePattern.test(requestedTime)) {
    return errorResponse("Please enter a valid date and time.", 400);
  }

  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return errorResponse("Party size must be between 1 and 20.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return errorResponse("Reservation requests are temporarily unavailable.", 503);
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.rpc("create_public_reservation_v1", {
      p_restaurant_slug: restaurantSlug,
      p_guest_name: guestName,
      p_guest_email: guestEmail,
      p_guest_phone: textValue(payload, "phone", 50) || null,
      p_requested_date: requestedDate,
      p_requested_time: requestedTime,
      p_party_size: partySize,
      p_occasion: textValue(payload, "occasion", 200) || null,
      p_special_request: textValue(payload, "special_request", 2000) || null,
      p_allergies: listValue(payload, "allergies"),
      p_intolerances: listValue(payload, "intolerances"),
      p_dietary_restrictions: listValue(payload, "dietary_restrictions"),
      p_dislikes: listValue(payload, "dislikes"),
      p_wine_preferences: textValue(payload, "wine_preferences", 2000) || null,
      p_experience_notes: textValue(payload, "experience_notes", 2000) || null,
    });

    if (error) {
      return errorResponse("We could not submit your request. Please try again.", 503);
    }
  } catch {
    return errorResponse("We could not submit your request. Please try again.", 503);
  }

  return Response.json({
    success: true,
    message:
      "Your reservation request has been received and will be reviewed by the restaurant.",
  });
}
