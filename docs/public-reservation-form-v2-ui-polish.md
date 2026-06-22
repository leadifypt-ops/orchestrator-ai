# Public Reservation Form V2 UI Polish

This follow-up changes only Business Reservations read models and presentation.
Persistence, the public form, reservation APIs, RPCs, migrations, and canonical
profile editing are unchanged.

- The canonical detail dietary card now acknowledges saved guest profiles.
- The reservation board builds a compact Service Briefing preview from each
  guest's wine preference, dislikes, and notes, with the special request as a
  fallback.
- Reservation experience context is shown separately from the host's own note
  on the detail page.
- Canonical guest profiles remain read-only.

V2 currently stores the host note followed by reservation experience context,
separated by a newline. The detail read model preserves that compatibility
contract by treating the first line as the host note and subsequent lines as
reservation-level experience context. A future persistence block should model
those values separately before supporting profile editing.
