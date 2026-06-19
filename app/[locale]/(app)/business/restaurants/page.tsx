import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type RestaurantsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type Restaurant = {
  id: string;
  name: string | null;
  slug: string | null;
  location: string | null;
  michelin_status: string | null;
  description: string | null;
  image_url: string | null;
  logo_url: string | null;
  chef_name: string | null;
  chef_story: string | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

function getIdentityCompleteness(restaurant: Restaurant) {
  const fields = [
    restaurant.logo_url,
    restaurant.image_url,
    restaurant.chef_name,
    restaurant.chef_story,
    restaurant.brand_primary_color,
    restaurant.brand_accent_color,
  ];

  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

function getReservationReadiness(restaurant: Restaurant) {
  const fields = [
    restaurant.name,
    restaurant.slug,
    restaurant.location,
    restaurant.description,
    restaurant.image_url,
  ];

  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

function formatDate(value?: string | null) {
  if (!value) return "Not updated yet";

  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const dynamic = "force-dynamic";

export default async function RestaurantsPage({ params }: RestaurantsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: memberships = [], error: membershipsError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user?.id || "");
  const businessIds = (memberships ?? []).map(
    (membership) => membership.business_id
  );
  const restaurantResult = businessIds.length
    ? await supabase
        .from("restaurants")
        .select("*")
        .in("business_id", businessIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const { data: restaurants = [] } = restaurantResult;
  const error = membershipsError || restaurantResult.error;

  const safeRestaurants = (restaurants as Restaurant[]) ?? [];

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
            Restaurants
          </p>

          <h1 className="text-3xl font-semibold">Restaurant management</h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage each restaurant profile, public page readiness, culinary
            identity, and reservation setup from the Find Dining backoffice.
          </p>
        </div>

        <Link
          href={`/${locale}/restaurants/new`}
          className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
        >
          Create new restaurant
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
          Could not load restaurants: {error.message}
        </div>
      ) : null}

      {!error && safeRestaurants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-semibold">No restaurants yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Create the first restaurant profile to prepare its public experience,
            dining identity, and reservation request flow.
          </p>
          <Link
            href={`/${locale}/restaurants/new`}
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
          >
            Create new restaurant
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4">
        {safeRestaurants.map((restaurant) => {
          const slug = restaurant.slug || restaurant.id;
          const identityCompleteness = getIdentityCompleteness(restaurant);
          const reservationReadiness = getReservationReadiness(restaurant);
          const publicPageStatus = restaurant.slug ? "Published" : "Draft";
          const lastUpdated = restaurant.updated_at || restaurant.created_at;

          return (
            <article
              key={restaurant.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
            >
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">
                      {restaurant.name || "Unnamed restaurant"}
                    </h2>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {publicPageStatus}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
                    <span>
                      Michelin: {restaurant.michelin_status || "Not set"}
                    </span>
                    <span>Location: {restaurant.location || "Not set"}</span>
                    <span>
                      Last updated: {formatDate(lastUpdated)}
                    </span>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                    {restaurant.description ||
                      "Add a restaurant story to help guests understand the dining experience before they request a table."}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link
                    href={`/${locale}/restaurants/${slug}/manage`}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Manage restaurant
                  </Link>
                  <Link
                    href={`/${locale}/restaurants/${slug}`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white"
                  >
                    View public page
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Chef / identity
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {identityCompleteness}%
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {restaurant.chef_name || "Chef not assigned"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Reservation readiness
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {reservationReadiness}%
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Public profile and request flow inputs
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Brand colors
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span
                      className="h-8 w-8 rounded-full border border-white/10"
                      style={{
                        backgroundColor:
                          restaurant.brand_primary_color || "#0f0f0f",
                      }}
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-white/10"
                      style={{
                        backgroundColor:
                          restaurant.brand_accent_color || "#d4af37",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Logo {restaurant.logo_url ? "ready" : "missing"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
