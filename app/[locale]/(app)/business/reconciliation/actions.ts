"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  RECONCILIATION_PRIORITIES,
  RECONCILIATION_STATUSES,
  RECONCILIATION_TYPES,
} from "@/lib/reconciliation";

export type ReconciliationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialReconciliationActionState: ReconciliationActionState = {
  status: "idle",
  message: "",
};

function value(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate.trim() : "";
}

function optionalUuid(formData: FormData, name: string) {
  return value(formData, name) || null;
}

function integerValue(formData: FormData, name: string) {
  const candidate = Number(value(formData, name));
  return Number.isInteger(candidate) ? candidate : null;
}

function error(message: string): ReconciliationActionState {
  return { status: "error", message };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createReconciliationItem(
  _previousState: ReconciliationActionState,
  formData: FormData
): Promise<ReconciliationActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");

  const businessId = value(formData, "business_id");
  const type = value(formData, "reconciliation_type");
  const priority = value(formData, "priority");
  const origin = value(formData, "origin");

  if (!businessId || !origin || origin.length > 500) {
    return error("Select a Business and provide an origin up to 500 characters.");
  }
  if (!RECONCILIATION_TYPES.includes(type as never)) {
    return error("Select a valid reconciliation type.");
  }
  if (!RECONCILIATION_PRIORITIES.includes(priority as never)) {
    return error("Select a valid priority.");
  }

  const { error: rpcError } = await supabase.rpc(
    "create_reconciliation_queue_item_v1",
    {
      p_business_id: businessId,
      p_reconciliation_type: type,
      p_priority: priority,
      p_origin: origin,
      p_restaurant_id: optionalUuid(formData, "restaurant_id"),
      p_guest_identity_id: optionalUuid(formData, "guest_identity_id"),
      p_reservation_id: optionalUuid(formData, "reservation_id"),
      p_audit_event_id: optionalUuid(formData, "audit_event_id"),
      p_merge_audit_event_id: optionalUuid(formData, "merge_audit_event_id"),
      p_recovery_event_id: optionalUuid(formData, "recovery_event_id"),
      p_assigned_to: optionalUuid(formData, "assigned_to"),
    }
  );

  if (rpcError) return error(rpcError.message);
  revalidatePath("/[locale]/business/reconciliation", "layout");
  return { status: "success", message: "Reconciliation added to the queue." };
}

export async function updateReconciliationStatus(
  itemId: string,
  _previousState: ReconciliationActionState,
  formData: FormData
): Promise<ReconciliationActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");

  const status = value(formData, "status");
  if (!RECONCILIATION_STATUSES.includes(status as never)) {
    return error("Select a valid status.");
  }

  const { error: rpcError } = await supabase.rpc(
    "update_reconciliation_queue_status_v1",
    { p_item_id: itemId, p_status: status }
  );
  if (rpcError) return error(rpcError.message);

  revalidatePath("/[locale]/business/reconciliation", "layout");
  return { status: "success", message: "Status updated and audited." };
}

export async function updateReconciliationPriority(
  itemId: string,
  _previousState: ReconciliationActionState,
  formData: FormData
): Promise<ReconciliationActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");

  const priority = value(formData, "priority");
  if (!RECONCILIATION_PRIORITIES.includes(priority as never)) {
    return error("Select a valid priority.");
  }

  const { error: rpcError } = await supabase.rpc(
    "update_reconciliation_queue_priority_v1",
    { p_item_id: itemId, p_priority: priority }
  );
  if (rpcError) return error(rpcError.message);

  revalidatePath("/[locale]/business/reconciliation", "layout");
  return { status: "success", message: "Priority updated and audited." };
}

export async function assignReconciliationItem(
  itemId: string,
  _previousState: ReconciliationActionState,
  formData: FormData
): Promise<ReconciliationActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");

  const { error: rpcError } = await supabase.rpc(
    "assign_reconciliation_queue_item_v1",
    { p_item_id: itemId, p_assigned_to: optionalUuid(formData, "assigned_to") }
  );
  if (rpcError) return error(rpcError.message);

  revalidatePath("/[locale]/business/reconciliation", "layout");
  return { status: "success", message: "Assignee updated and audited." };
}

export async function updateReconciliationSlaPolicy(
  _previousState: ReconciliationActionState,
  formData: FormData
): Promise<ReconciliationActionState> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return error("Authentication required.");

  const businessId = value(formData, "business_id");
  const highHours = integerValue(formData, "high_priority_hours");
  const mediumHours = integerValue(formData, "medium_priority_hours");
  const lowHours = integerValue(formData, "low_priority_hours");

  if (
    !businessId
    || highHours === null || highHours < 1 || highHours > 720
    || mediumHours === null || mediumHours < 1 || mediumHours > 720
    || lowHours === null || lowHours < 1 || lowHours > 720
  ) {
    return error("SLA hours must be whole numbers between 1 and 720.");
  }

  const { data, error: rpcError } = await supabase.rpc(
    "set_reconciliation_sla_policy_v1",
    {
      p_business_id: businessId,
      p_high_priority_hours: highHours,
      p_medium_priority_hours: mediumHours,
      p_low_priority_hours: lowHours,
    }
  );
  if (rpcError) return error(rpcError.message);

  revalidatePath("/[locale]/business/reconciliation", "layout");
  const changed = Boolean((data as { changed?: unknown } | null)?.changed);
  return {
    status: "success",
    message: changed
      ? "SLA policy updated and audited."
      : "SLA policy is already up to date.",
  };
}
