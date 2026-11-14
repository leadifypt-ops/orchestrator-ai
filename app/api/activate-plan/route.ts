import { NextResponse } from "next/server";

// Deliberately retired: this route previously promoted arbitrary user IDs to
// an active paid plan via the service-role client without authorization.
// Only verified Stripe events or a separately approved admin flow may
// activate subscriptions. This endpoint must never be re-enabled casually.
export async function POST() {
  return NextResponse.json(
    { error: "Plan activation through this endpoint is disabled." },
    { status: 410 }
  );
}
