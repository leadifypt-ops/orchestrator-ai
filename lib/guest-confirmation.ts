export type GuestConfirmation = {
  restaurant_name: string;
  reservation_date: string | null;
  reservation_time: string | null;
  party_size: number | null;
  guest_display_name: string | null;
  confirmation_status: string;
  restaurant_phone: string | null;
  restaurant_email: string | null;
  change_instructions: string;
};

export type ConfirmationTokenRecord = {
  id: string;
  reservation_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  last_viewed_at: string | null;
  view_count: number;
};

export type GuestSubmission = {
  id: string;
  submission_type: "communication_preferences" | "guest_notes";
  preferred_channel: string | null;
  preferred_language: string | null;
  can_contact_about_reservation: boolean | null;
  allergies_dietary_note: string | null;
  special_occasion_note: string | null;
  arrival_accessibility_note: string | null;
  general_note: string | null;
  review_status: string;
  created_at: string;
};
