import Link from "next/link";

const restaurants = [
  {
    id: "feitoria",
    name: "Feitoria",
    chef: "André Cruz",
    city: "Lisboa",
    michelin: "1 estrela Michelin",
    description:
      "Experiência gastronómica contemporânea com foco no produto português, vinho e serviço de excelência.",
  },
];

export default function RestaurantsPage() {
  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">
            Find Dining
          </p>

          <h1 className="text-3xl font-bold mb-2">Restaurantes</h1>

          <p className="text-zinc-500">
            Gere os restaurantes disponíveis na plataforma.
          </p>
        </div>

        <Link
          href="/pt/projects/new"
          className="bg-white text-black px-5 py-3 rounded-lg text-sm font-medium"
        >
          Novo Restaurante
        </Link>
      </div>

      <div className="grid gap-4 max-w-4xl">
        {restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            className="border border-white/10 rounded-xl bg-zinc-950 p-5"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold">{restaurant.name}</h2>

                <p className="text-sm text-zinc-500 mt-1">
                  Chef: {restaurant.chef}
                </p>

                <p className="text-sm text-zinc-500">
                  {restaurant.city} · {restaurant.michelin}
                </p>

                <p className="text-zinc-400 mt-4 max-w-2xl">
                  {restaurant.description}
                </p>
              </div>

              <Link
                href={`/pt/restaurants/${restaurant.id}`}
                className="border border-white/10 px-4 py-2 rounded-lg text-sm hover:bg-white hover:text-black"
              >
                Ver Restaurante
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
