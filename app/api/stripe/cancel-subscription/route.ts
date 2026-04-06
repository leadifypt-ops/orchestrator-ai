import { supabase } from "@/lib/supabase-client";

async function cancelPlan() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await fetch("/api/stripe/cancel-subscription", {
    method: "POST",
    body: JSON.stringify({
      userId: user?.id,
    }),
  });

  window.location.href = "/pt/pricing";
}