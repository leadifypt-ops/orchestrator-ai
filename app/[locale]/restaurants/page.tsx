import { createClient } from "@/lib/supabase/server";

export default async function RestaurantsPage() {
  const supabase = await createClient();

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Restaurants</h1>
        <p className="mt-4 text-red-500">
          Error loading restaurants: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Restaurants</h1>

      <div className="mt-6 grid gap-4">
        {restaurants?.map((restaurant) => (
          <div
            key={restaurant.id}
            className="rounded-xl border p-4 shadow-sm"
          >
            <h2 className="text-xl font-medium">{restaurant.name}</h2>
            <p className="text-sm text-gray-500">{restaurant.location}</p>
            <p className="mt-2 text-sm">{restaurant.michelin_status}</p>
            <p className="mt-3 text-gray-700">{restaurant.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}