import type { AvailabilityProjectionStatus } from "./availability-projection";

export const OPERATIONAL_NOTE_TYPES = [
  "reduced_team", "private_event", "maintenance", "partial_kitchen",
  "unavailable_room", "other",
] as const;

export type OperationalNoteType = (typeof OPERATIONAL_NOTE_TYPES)[number];

export const operationalNoteLabels: Record<OperationalNoteType, string> = {
  reduced_team: "Reduced team",
  private_event: "Private event",
  maintenance: "Maintenance",
  partial_kitchen: "Partial kitchen",
  unavailable_room: "Unavailable room",
  other: "Other",
};

export type OperationalNote = {
  id: string;
  note_type: OperationalNoteType;
  note: string;
  service_period_id: string | null;
  created_by: string;
  actor_email: string | null;
  created_at: string;
};

export type OperationalCapacityReview = {
  operational_date: string;
  service_period_id: string;
  service_period_name: string;
  scheduled: boolean;
  is_open: boolean;
  effective_start_time: string;
  effective_end_time: string;
  exception_type: string | null;
  exception_reason: string | null;
  original_capacity: number | null;
  adjusted_capacity: number | null;
  capacity_used: number;
  capacity_remaining: number;
  occupancy_percent: number | null;
  reservation_count: number;
  reservations_outside_effective_hours: number;
  availability_status: AvailabilityProjectionStatus;
  override_id: string | null;
  override_reason: string | null;
  override_created_by: string | null;
  override_actor_email: string | null;
  override_created_at: string | null;
  operational_notes: OperationalNote[];
};

export function capacityDelta(original: number | null, adjusted: number | null) {
  if (original === null || adjusted === null) return null;
  return adjusted - original;
}

export function hasActiveOverride(row: Pick<OperationalCapacityReview, "override_id">) {
  return Boolean(row.override_id);
}
