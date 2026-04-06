import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { leadId, value } = await req.json();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!leadId) {
      return NextResponse.json({ error: "Lead inválida." }, { status: 400 });
    }

    const parsedValue =
      value === "" || value === null || value === undefined
        ? null
        : Number(value);

    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const { error } = await supabase
      .from("leads")
      .update({
        value: parsedValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}