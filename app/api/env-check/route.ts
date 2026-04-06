import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    anonExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}