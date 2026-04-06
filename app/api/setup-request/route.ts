import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const business =
      typeof body.business === "string" ? body.business.trim() : "";
    const instagram =
      typeof body.instagram === "string" ? body.instagram.trim() : "";
    const whatsapp =
      typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const plan =
      typeof body.plan === "string" && body.plan.trim()
        ? body.plan.trim()
        : "setup";

    console.log("SETUP REQUEST BODY:", {
      name,
      business,
      instagram,
      whatsapp,
      email,
      plan,
    });

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Nome é obrigatório." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("setup_requests").insert([
      {
        name,
        business: business || null,
        instagram: instagram || null,
        whatsapp: whatsapp || null,
        email: email || null,
        plan,
        status: "new",
      },
    ]);

    if (error) {
      console.log("SUPABASE INSERT ERROR:", error);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("SETUP REQUEST INTERNAL ERROR:", error);

    return NextResponse.json(
      { ok: false, error: "Erro interno ao guardar pedido." },
      { status: 500 }
    );
  }
}