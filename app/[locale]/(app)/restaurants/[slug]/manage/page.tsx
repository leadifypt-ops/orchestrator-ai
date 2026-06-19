import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type ManageRestaurantPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

export default async function ManageRestaurantPage({
  params,
}: ManageRestaurantPageProps) {
  const { locale, slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: memberships = [] } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user?.id || "");
  const businessIds = (memberships ?? []).map(
    (membership) => membership.business_id
  );

  if (businessIds.length === 0) {
    notFound();
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("name, slug, location, michelin_status, chef_name")
    .eq("slug", slug)
    .in("business_id", businessIds)
    .maybeSingle();

  if (error || !restaurant) {
    notFound();
  }

  return (
    <div className="p-8 text-white">
      <div className="max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Restaurant management
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{restaurant.name}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Detailed editing for restaurant identity, reservation rules, menus,
          and guest preferences will live here. The public page and create flow
          are already connected to the restaurant profile.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              Location
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {restaurant.location || "Not set"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              Michelin status
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {restaurant.michelin_status || "Not set"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              Chef
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {restaurant.chef_name || "Not set"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              Public page
            </p>
            <Link
              href={`/${locale}/restaurants/${restaurant.slug}`}
              className="mt-2 inline-flex text-sm text-white underline decoration-white/30 underline-offset-4"
            >
              View guest experience
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
