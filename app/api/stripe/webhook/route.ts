import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const event = await req.json();

    console.log("✅ Evento recebido no webhook:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      const userId =
        typeof session.metadata?.userId === "string"
          ? session.metadata.userId
          : typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : null;

      const plan =
        typeof session.metadata?.plan === "string"
          ? session.metadata.plan
          : null;

      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const currentPeriodEndRaw = (subscription as any).current_period_end;

        currentPeriodEnd =
          typeof currentPeriodEndRaw === "number"
            ? new Date(currentPeriodEndRaw * 1000).toISOString()
            : null;
      }

      console.log("🧾 checkout.session.completed data:", {
        sessionId: session.id,
        customerId,
        subscriptionId,
        userId,
        plan,
        metadata: session.metadata,
        client_reference_id: session.client_reference_id,
        currentPeriodEnd,
      });

      if (!userId) {
        console.log("❌ userId não encontrado no metadata nem client_reference_id");
        return NextResponse.json({ received: true });
      }

      const payload = {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_status: "active",
        plan_name: plan,
        current_period_end: currentPeriodEnd,
      };

      console.log("📦 Payload para Supabase:", payload);

      const { data, error } = await supabase
        .from("subscriptions")
        .upsert(payload, { onConflict: "user_id" })
        .select();

      if (error) {
        console.log("❌ Erro ao guardar no Supabase:", error);
      } else {
        console.log("✅ Guardado no Supabase:", data);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : null;

      const currentPeriodEndRaw = (subscription as any).current_period_end;
      const currentPeriodEnd =
        typeof currentPeriodEndRaw === "number"
          ? new Date(currentPeriodEndRaw * 1000).toISOString()
          : null;

      console.log("🔄 customer.subscription.updated:", {
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        currentPeriodEnd,
      });

      const { error } = await supabase
        .from("subscriptions")
        .update({
          stripe_subscription_id: subscription.id,
          plan_status: subscription.status,
          current_period_end: currentPeriodEnd,
        })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.log("❌ Erro ao atualizar subscription:", error);
      } else {
        console.log("✅ Subscription atualizada");
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : null;

      console.log("🛑 customer.subscription.deleted:", {
        subscriptionId: subscription.id,
        customerId,
      });

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_status: "canceled",
          stripe_subscription_id: subscription.id,
        })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.log("❌ Erro ao marcar cancelado:", error);
      } else {
        console.log("✅ Subscription cancelada");
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;

      console.log("💥 invoice.payment_failed:", {
        invoiceId: invoice.id,
        customerId,
      });

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_status: "past_due",
        })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.log("❌ Erro ao marcar past_due:", error);
      } else {
        console.log("✅ Subscription marcada como past_due");
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.log("❌ Erro interno no webhook:", error);
    return NextResponse.json(
      { error: "Erro interno no webhook" },
      { status: 500 }
    );
  }
}