import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, userId } = body;

    if (!plan) {
      return NextResponse.json(
        { error: "Plano não enviado" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User não autenticado" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let session: Stripe.Checkout.Session | null = null;

    /* ============================= */
    /* FOUNDERS (LIMITADO A 15)      */
    /* ============================= */

    if (plan === "founders") {
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("plan_name", "founders")
        .eq("plan_status", "active");

      if ((count ?? 0) >= 15) {
        return NextResponse.json(
          {
            error:
              "As vagas do Programa Fundadores já foram preenchidas.",
          },
          { status: 400 }
        );
      }

      session = await stripe.checkout.sessions.create({
        mode: "subscription",

        client_reference_id: userId,

        metadata: {
          userId,
          plan: "founders",
        },

        subscription_data: {
          metadata: {
            userId,
            plan: "founders",
          },
        },

        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Programa Fundadores - Acesso Mensal",
              },
              unit_amount: 3999,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Setup Fundadores",
              },
              unit_amount: 13000,
            },
            quantity: 1,
          },
        ],

        success_url: `${baseUrl}/pt/success`,
        cancel_url: `${baseUrl}/pt/pricing`,
      });
    }

    /* ============================= */
    /* SETUP                         */
    /* ============================= */

    if (plan === "setup") {
      session = await stripe.checkout.sessions.create({
        mode: "payment",

        client_reference_id: userId,

        metadata: {
          userId,
          plan: "setup",
        },

        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Setup Profissional",
              },
              unit_amount: 17999,
            },
            quantity: 1,
          },
        ],

        success_url: `${baseUrl}/pt/success`,
        cancel_url: `${baseUrl}/pt/pricing`,
      });
    }

    /* ============================= */
    /* MENSAL                        */
    /* ============================= */

    if (plan === "monthly") {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",

        client_reference_id: userId,

        metadata: {
          userId,
          plan: "monthly",
        },

        subscription_data: {
          metadata: {
            userId,
            plan: "monthly",
          },
        },

        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Plano Mensal",
              },
              unit_amount: 4999,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],

        success_url: `${baseUrl}/pt/success`,
        cancel_url: `${baseUrl}/pt/pricing`,
      });
    }

    /* ============================= */
    /* COMBO NORMAL                  */
    /* ============================= */

    if (plan === "combo") {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",

        client_reference_id: userId,

        metadata: {
          userId,
          plan: "combo",
        },

        subscription_data: {
          metadata: {
            userId,
            plan: "combo",
          },
        },

        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Acesso Mensal",
              },
              unit_amount: 4999,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Setup Profissional",
              },
              unit_amount: 17999,
            },
            quantity: 1,
          },
        ],

        success_url: `${baseUrl}/pt/success`,
        cancel_url: `${baseUrl}/pt/pricing`,
      });
    }

    if (!session?.url) {
      return NextResponse.json(
        { error: "Não foi possível criar a sessão Stripe." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.log("CHECKOUT ERROR", error);

    return NextResponse.json(
      { error: "Erro ao criar checkout" },
      { status: 500 }
    );
  }
}