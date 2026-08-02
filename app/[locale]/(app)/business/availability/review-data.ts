import { createClient } from "@/lib/supabase/server";
import type { OperationalCapacityReview } from "@/lib/operational-capacity";
import { loadAvailabilityFoundation } from "./data";

export async function loadOperationalCapacityReview(
  businessId: string,
  restaurantId: string,
  dateFrom: string,
  dateTo: string
) {
  const supabase = await createClient();
  const result = await supabase.rpc("project_operational_capacity_review_v1", {
    p_business_id: businessId,
    p_restaurant_id: restaurantId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  return { rows: (result.data || []) as OperationalCapacityReview[], error: result.error };
}

export async function loadOperationalReviewConfiguration() {
  return loadAvailabilityFoundation();
}
