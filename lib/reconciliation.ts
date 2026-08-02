export const RECONCILIATION_TYPES = [
  "merge_review",
  "recovery_review",
  "crm_review",
  "conflict_review",
] as const;

export const RECONCILIATION_STATUSES = [
  "pending",
  "in_review",
  "completed",
] as const;

export const RECONCILIATION_PRIORITIES = ["low", "medium", "high"] as const;

export type ReconciliationType = (typeof RECONCILIATION_TYPES)[number];
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];
export type ReconciliationPriority = (typeof RECONCILIATION_PRIORITIES)[number];

export type ReconciliationAssignee = {
  user_id: string;
  email: string | null;
  role: string;
  business_id?: string;
};

export type ReconciliationQueueItem = {
  id: string;
  business_id: string;
  reconciliation_type: ReconciliationType;
  status: ReconciliationStatus;
  priority: ReconciliationPriority;
  restaurant_id: string | null;
  guest_identity_id: string | null;
  reservation_id: string | null;
  audit_event_id: string | null;
  merge_audit_event_id: string | null;
  recovery_event_id: string | null;
  recovery_execution_event_id: string | null;
  reconciliation_review_id: string | null;
  origin: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  restaurant?: { id: string; name: string | null } | null;
  guest?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  reservation?: {
    id: string;
    guest_name: string;
    requested_date: string | null;
  } | null;
  audit_event?: { id: string; change_type: string; created_at: string } | null;
  merge_event?: { id: string; change_type: string; created_at: string } | null;
  recovery_event?: {
    id: string;
    merge_audit_event_id: string;
    status: string;
    created_at: string;
  } | null;
};

export const reconciliationTypeLabels: Record<ReconciliationType, string> = {
  merge_review: "Merge Review",
  recovery_review: "Recovery Review",
  crm_review: "CRM Review",
  conflict_review: "Conflict Review",
};

export const reconciliationStatusLabels: Record<ReconciliationStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  completed: "Completed",
};

export const reconciliationPriorityLabels: Record<ReconciliationPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function formatReconciliationDate(value: string, locale = "pt-PT") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
