import type {
  GuestIdentityRow,
  IdentityGuestProfileRow,
} from "@/lib/guest-history";

export type GuestContactProfileRow = IdentityGuestProfileRow & {
  email: string | null;
  phone: string | null;
};

export type GuestCrmProfileRow = {
  guest_identity_id: string;
  wine_preferences: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type GuestCrmAuditEventRow = {
  id: string;
  changed_by: string | null;
  previous_values: Record<string, string | null>;
  new_values: Record<string, string | null>;
  created_at: string;
};

export type DuplicateCandidate = {
  sourceId: string;
  targetId: string;
  reasons: string[];
};

export function normalizeGuestEmail(value?: string | null) {
  return value?.trim().toLocaleLowerCase() || null;
}

export function normalizeGuestPhone(value?: string | null) {
  return value?.trim().replace(/[^0-9+]/g, "") || null;
}

export function detectDuplicateCandidates(
  identities: GuestIdentityRow[],
  profiles: GuestContactProfileRow[]
) {
  const candidates = new Map<string, DuplicateCandidate>();
  const addCandidate = (firstId: string, secondId: string, reason: string) => {
    if (firstId === secondId) return;
    const [sourceId, targetId] = [firstId, secondId].sort();
    const key = `${sourceId}:${targetId}`;
    const candidate = candidates.get(key) || {
      sourceId,
      targetId,
      reasons: [],
    };
    if (!candidate.reasons.includes(reason)) candidate.reasons.push(reason);
    candidates.set(key, candidate);
  };
  const emails = new Map<string, string>();
  const phones = new Map<string, string>();

  for (const identity of identities) {
    const email = normalizeGuestEmail(identity.email);
    const phone = normalizeGuestPhone(identity.phone);
    if (email) {
      const existing = emails.get(email);
      if (existing) addCandidate(existing, identity.id, "Same email");
      else emails.set(email, identity.id);
    }
    if (phone) {
      const existing = phones.get(phone);
      if (existing) addCandidate(existing, identity.id, "Same phone");
      else phones.set(phone, identity.id);
    }
  }

  for (const profile of profiles) {
    const emailIdentity = profile.email
      ? emails.get(normalizeGuestEmail(profile.email) || "")
      : null;
    const phoneIdentity = profile.phone
      ? phones.get(normalizeGuestPhone(profile.phone) || "")
      : null;

    if (emailIdentity && phoneIdentity && emailIdentity !== phoneIdentity) {
      addCandidate(
        emailIdentity,
        phoneIdentity,
        "Email and phone resolve to different identities"
      );
    }
    if (
      profile.guest_identity_id &&
      emailIdentity &&
      profile.guest_identity_id !== emailIdentity
    ) {
      addCandidate(
        profile.guest_identity_id,
        emailIdentity,
        "Saved guest email belongs to another identity"
      );
    }
    if (
      profile.guest_identity_id &&
      phoneIdentity &&
      profile.guest_identity_id !== phoneIdentity
    ) {
      addCandidate(
        profile.guest_identity_id,
        phoneIdentity,
        "Saved guest phone belongs to another identity"
      );
    }
  }

  return [...candidates.values()];
}
