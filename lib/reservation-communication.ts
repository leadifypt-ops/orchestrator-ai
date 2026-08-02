export const communicationStatuses = ["draft", "ready", "marked_sent", "failed", "cancelled"] as const;
export const communicationChannels = ["email", "phone", "whatsapp", "sms", "manual"] as const;
export const communicationTypes = ["confirmation", "update", "cancellation_notice", "reminder_draft", "internal_note"] as const;

export type ReservationCommunication = {
  id: string;
  reservation_id: string;
  channel: string;
  communication_type: string;
  status: string;
  subject: string | null;
  body: string;
  language: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  marked_sent_at: string | null;
  cancelled_at: string | null;
};

export const communicationStatusLabel = (status: string) =>
  ({ draft: "Draft", ready: "Ready", marked_sent: "Marked sent", failed: "Failed", cancelled: "Cancelled" })[status] ?? status;

export const communicationStatusClass = (status: string) =>
  status === "marked_sent"
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : status === "ready"
      ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
      : status === "cancelled" || status === "failed"
        ? "border-red-300/30 bg-red-300/10 text-red-100"
        : "border-amber-300/30 bg-amber-300/10 text-amber-100";
