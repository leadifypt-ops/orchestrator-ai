import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ExperiencesPageProps = {
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
  chef_name: string | null;
  chef_story: string | null;
  image_url: string | null;
  logo_url: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

const EXPERIENCE_TEMPLATES = [
  {
    name: "Signature Experience",
    type: "Tasting menu",
    description:
      "A flagship guest journey shaped around the restaurant identity, chef story, and seasonal menu direction.",
  },
  {
    name: "Vegetarian Experience",
    type: "Tasting menu",
    description:
      "A plant-led menu path for guests who need a vegetarian dining experience without losing the restaurant point of view.",
  },
  {
    name: "Wine Pairing",
    type: "Wine pairing",
    description:
      "A pairing track for service teams to align the tasting menu with guest preferences and cellar highlights.",
  },
];

export const dynamic = "force-dynamic";

function getPublicPageStatus(restaurant: Restaurant) {
  return restaurant.slug ? "Published" : "Draft";
}

function getRestaurantIdentity(restaurant: Restaurant) {
  const identityParts = [
    restaurant.chef_name ? `Chef ${restaurant.chef_name}` : null,
    restaurant.michelin_status,
    restaurant.location,
  ].filter(Boolean);

  return identityParts.length ? identityParts.join(" · ") : "Identity pending";
}

function getExperienceReadiness(restaurant: Restaurant) {
  const fields = [
    restaurant.name,
    restaurant.slug,
    restaurant.description,
    restaurant.chef_name,
    restaurant.michelin_status,
  ];

  return Math.round(
    (fields.filter(Boolean).length / fields.length) * 100
  );
}

export default async function ExperiencesPage({ params }: ExperiencesPageProps) {
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
        .select(
          "id, name, slug, location, michelin_status, description, chef_name, chef_story, image_url, logo_url, created_at, updated_at"
        )
        .in("business_id", businessIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const { data: restaurants = [] } = restaurantResult;
  const error = membershipsError || restaurantResult.error;

  const safeRestaurants = (restaurants as Restaurant[]) ?? [];

  return (
    <div className="space-y-6 p-8 text-white">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Experiences
          </p>

          <h1 className="mt-3 text-3xl font-semibold">
            Menus and guest journeys
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Shape tasting menus, wine pairing paths, and restaurant-specific
            experiences from the identity already captured in Find Dining.
          </p>
        </div>

        <Link
          href={`/${locale}/restaurants/new`}
          className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
        >
          Create restaurant
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
          Could not load restaurant experiences: {error.message}
        </div>
      ) : null}

      {!error && safeRestaurants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-semibold">
            No restaurant experiences yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Create a restaurant profile first, then Find Dining can prepare
            tasting menu and wine pairing placeholders for that restaurant.
          </p>
          <Link
            href={`/${locale}/restaurants/new`}
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
          >
            Create restaurant
          </Link>
        </div>
      ) : null}

      <div className="space-y-5">
        {safeRestaurants.map((restaurant) => {
          const slug = restaurant.slug || restaurant.id;
          const publicPageStatus = getPublicPageStatus(restaurant);
          const readiness = getExperienceReadiness(restaurant);

          return (
            <section
              key={restaurant.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">
                      {restaurant.name || "Unnamed restaurant"}
                    </h2>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {publicPageStatus}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-500">
                    {getRestaurantIdentity(restaurant)}
                  </p>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                    {restaurant.description ||
                      "Add restaurant identity and chef context to make these experience placeholders more specific."}
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
                    href={`/${locale}/restaurants/new`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white"
                  >
                    Create restaurant
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Michelin status
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {restaurant.michelin_status || "Not set"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Chef
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {restaurant.chef_name || "Chef not assigned"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Experience readiness
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {readiness}%
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {EXPERIENCE_TEMPLATES.map((experience) => (
                  <article
                    key={`${restaurant.id}-${experience.name}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                      {experience.type}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {experience.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {experience.description}
                    </p>
                    <p className="mt-4 text-xs text-zinc-600">
                      Placeholder menu generated from restaurant profile data.
                    </p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
