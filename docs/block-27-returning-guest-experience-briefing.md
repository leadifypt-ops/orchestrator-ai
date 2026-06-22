# Block 27 - Returning Guest Experience Briefing

## Scope

Block 27 is a read-only operational layer over the Block 26 guest identity and
history foundation. It changes only Business Reservation Detail presentation
and briefing derivation. There are no schema, migration, RPC, identity matching,
public form, or persistence changes.

## Returning Guest Experience

The section appears only when the linked guest identity has at least one other
canonical reservation. It shows:

- a returning-guest badge;
- previous visit count and most recent previous visit date;
- remembered notes/preferences, dislikes, and wine preferences;
- historical allergies, intolerances, and restrictions;
- previous occasion and reservation context;
- practical service guidance that requires human reconfirmation.

## Service Briefing

Returning guests receive a dedicated note with the last visit date, previous
wine preferences and dislikes, guidance not to welcome the host as a first-time
guest, and a reminder to use historical context carefully.

## Kitchen Briefing and conflicts

Historical dietary risks remain separate from the current profile. Conflict
warnings are derived in memory for the linked host when a historical allergy,
intolerance, or restriction is absent from the current reservation profile.
The warning says that the historical item was not confirmed in the current
profile and must remain unresolved until reconfirmed with the guest and kitchen.

No historical value silently modifies the current profile, and canonical guest
profiles remain read-only.

## Validation

The existing two-reservation test identity was used. The second reservation
shows one previous visit, the previous date and context, historical
Shellfish/Lactose/Pescatarian risks, and conflict warnings because the current
profile contains Egg/Gluten/Vegetarian instead.

Verification commands:

    npx tsc --noEmit
    npx eslint 'app/[locale]/(app)/reservations/[id]/page.tsx'
    git diff --check
    npm run build
