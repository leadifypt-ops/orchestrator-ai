import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, userId } = body;

    let priceId = "";

    if (plan === "monthly") {
      priceId = process.env.STRIPE_PRICE_MONTHLY!;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pt/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pt/dashboard`,
      metadata: {
        userId,
        plan,
      },
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: "error" });
  }
}