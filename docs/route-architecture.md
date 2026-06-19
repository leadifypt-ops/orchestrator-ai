# Find Dining Route Architecture

This document prepares the codebase for separating Find Dining into three
product surfaces without moving routes yet.

## Target Route Namespaces

### Guest Marketplace

- `/${locale}`
- `/${locale}/restaurants`
- `/${locale}/restaurants/[slug]`
- `/${locale}/search`
- `/${locale}/favorites`
- `/${locale}/account`
- `/${locale}/membership`

### Business Operations

- `/${locale}/business/dashboard`
- `/${locale}/business/reservations`
- `/${locale}/business/guests`
- `/${locale}/business/restaurants`
- `/${locale}/business/experiences`
- `/${locale}/business/channels`
- `/${locale}/business/settings`
- `/${locale}/business/billing`

### Find Dining Admin

- `/${locale}/admin`
- `/${locale}/admin/restaurants`
- `/${locale}/admin/businesses`
- `/${locale}/admin/reservations`

## Current Route Conflicts

### `/${locale}/restaurants`

Current links and redirects that point to restaurant routes:

- `components/Sidebar.tsx`
  - Business sidebar points Restaurants to `/${locale}/restaurants`.
- `app/[locale]/restaurants/[slug]/page.tsx`
  - Public restaurant page links back to `/${locale}/restaurants`.
  - This currently conflicts with the authenticated business restaurants route.
- `app/[locale]/(app)/dashboard/page.tsx`
  - Service dashboard quick action links to `/${locale}/restaurants`.
- `app/[locale]/(app)/restaurants/page.tsx`
  - Links to `/${locale}/restaurants/new`.
  - Links to `/${locale}/restaurants/${slug}/manage`.
  - Links to `/${locale}/restaurants/${slug}`.
- `app/[locale]/(app)/restaurants/new/page.tsx`
  - Redirects after create to `/${locale}/restaurants`.
- `app/[locale]/(app)/restaurants/[slug]/manage/page.tsx`
  - Links to `/${locale}/restaurants/${restaurant.slug}`.
- `app/[locale]/(app)/experiences/page.tsx`
  - Links to `/${locale}/restaurants/new`.
  - Links to `/${locale}/restaurants/${slug}/manage`.
- `app/[locale]/(app)/projects/page.tsx`
  - Legacy redirect to `/${locale}/restaurants`.
- `app/[locale]/(app)/projects/new/page.tsx`
  - Legacy redirect to `/${locale}/restaurants/new`.
- `app/[locale]/(app)/projects/[id]/page.tsx`
  - Legacy redirect to `/${locale}/restaurants`.

Conflict:

- Guest Marketplace should own `/${locale}/restaurants` as public restaurant
  discovery.
- Business Operations currently owns `/${locale}/restaurants` as authenticated
  restaurant management.

### `/${locale}/dashboard`

Current links and redirects that point to dashboard routes:

- `components/Sidebar.tsx`
  - Business sidebar points Dashboard to `/${locale}/dashboard`.
- `app/[locale]/login/page.tsx`
  - Login redirects every authenticated user to `/${locale}/dashboard`.
- `app/[locale]/success/page.tsx`
  - Success page links to `/${locale}/dashboard`.
- `app/api/stripe/change-plan/route.ts`
  - Stripe success and cancel URLs point to `/pt/dashboard`.

Conflict:

- `/${locale}/dashboard` currently assumes a business user.
- Target architecture should move this to `/${locale}/business/dashboard`.
- Future guest accounts and admin users need role-aware post-auth routing.

## Current Business-User Assumptions

These areas assume an authenticated user is a business operator:

- `app/[locale]/(app)/layout.tsx`
  - Authenticated app shell renders the Business sidebar for every signed-in
    user.
- `components/Sidebar.tsx`
  - Navigation is entirely Business Operations oriented.
- `app/[locale]/login/page.tsx`
  - Sends every user to the Business dashboard.
- `app/[locale]/success/page.tsx`
  - Sends checkout success users to the Business dashboard.
- `app/[locale]/pricing/page.tsx`
  - Requires auth for checkout and still uses automation/business SaaS
    language.
- `app/[locale]/(app)/dashboard/page.tsx`
  - Reads `leads` by `user_id` and presents restaurant operations.
- `app/[locale]/(app)/reservations/page.tsx`
  - Reads `leads` by `user_id`.
- `app/[locale]/(app)/reservations/[id]/page.tsx`
  - Reads a reservation request from `leads` by `id` and `user_id`.
- `app/[locale]/(app)/reservations/new/page.tsx`
  - Creates `leads` with the authenticated `user_id`.
- `app/[locale]/(app)/guests/page.tsx`
  - Reads profile tables with temporary authenticated-user RLS, not scoped to a
    restaurant/business yet.
- `app/[locale]/(app)/restaurants/*`
  - Business restaurant management is mounted at public-looking URLs.
- `app/[locale]/(app)/billing/page.tsx`
  - Business placeholder.
- `app/[locale]/(app)/settings/page.tsx`
  - Business placeholder.

Legacy automation surfaces also assume signed-in business users:

- `/`
- `/${locale}`
- `/${locale}/automations`
- `/${locale}/automations/[id]`
- `/automations`
- `/${locale}/integrations/manychat`
- `/api/automations/*`
- `/api/generate-automation`
- `/api/save-automation`
- `/api/execute-automation`
- `/api/runner`
- `/api/scheduler`
- `/api/dispatch`

## Migration Plan

### Step 1: Introduce target namespaces as compatibility wrappers

- Create `/${locale}/business/*` routes that render or redirect to the current
  Business Operations pages.
- Keep existing routes working during the transition.
- Add role-aware destination helpers for login, checkout success, and app shell
  redirects.

### Step 2: Move Business navigation to `/business`

- Update the Business sidebar links to `/${locale}/business/*`.
- Keep old Business routes as redirects for bookmarked URLs:
  - `/${locale}/dashboard` -> `/${locale}/business/dashboard`
  - `/${locale}/reservations` -> `/${locale}/business/reservations`
  - `/${locale}/guests` -> `/${locale}/business/guests`
  - `/${locale}/experiences` -> `/${locale}/business/experiences`
  - `/${locale}/channels` -> `/${locale}/business/channels`
  - `/${locale}/billing` -> `/${locale}/business/billing`
  - `/${locale}/settings` -> `/${locale}/business/settings`

### Step 3: Give Guest Marketplace the public namespace

- Replace `/${locale}` with the guest marketplace homepage.
- Make `/${locale}/restaurants` the public discovery page.
- Keep `/${locale}/restaurants/[slug]` as the public restaurant detail page.
- Move Business restaurant management fully under
  `/${locale}/business/restaurants`.

### Step 4: Introduce Admin namespace and retire legacy automation routes

- Create `/${locale}/admin` routes for internal Find Dining operations.
- Move any still-needed legacy automation diagnostics behind Admin or remove
  them after compatibility expires.
- Remove public access to root automation builder and localized automation list.

## Estimated Complexity

- Step 1: Medium
  - Mostly wrappers and redirects, but auth destination helpers need care.
- Step 2: Medium
  - Sidebar and internal links are straightforward; route compatibility must be
    verified.
- Step 3: High
  - `/${locale}/restaurants` conflict is central. Public discovery and Business
    restaurant management must be separated without breaking public restaurant
    detail pages.
- Step 4: Medium to High
  - Admin surface is new, and legacy automation routes/APIs need product
    decisions before removal.
