"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type RestaurantDiscoveryProps = {
  locale: string;
};

type Restaurant = {
  name: string;
  city: string;
  country: string;
  michelinStatus: string;
  chef?: string;
  description: string;
  image?: string;
  slug?: string;
  detail: string;
};

const restaurants: Restaurant[] = [
  {
    name: "Feitoria",
    city: "Lisbon",
    country: "Portugal",
    michelinStatus: "One Michelin Star",
    chef: "Andre Cruz",
    description:
      "Portuguese ingredients and maritime memory meet a precise contemporary language beside the Tagus.",
    image: "/assets/feitoria-v1/hero-sala-1.jpeg",
    slug: "feitoria",
    detail: "Tasting menu / Portuguese contemporary",
  },
  {
    name: "Fifty Seconds",
    city: "Lisbon",
    country: "Portugal",
    michelinStatus: "One Michelin Star",
    description:
      "A destination dining room above Lisbon, shaped around panoramic views and a modern tasting experience.",
    detail: "Tasting menu / Destination dining",
  },
];

const michelinStatuses = [
  "All Michelin statuses",
  ...Array.from(new Set(restaurants.map((restaurant) => restaurant.michelinStatus))),
];

const cities = [
  "All cities",
  ...Array.from(new Set(restaurants.map((restaurant) => restaurant.city))),
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export default function RestaurantDiscovery({
  locale,
}: RestaurantDiscoveryProps) {
  const [query, setQuery] = useState("");
  const [michelinStatus, setMichelinStatus] = useState(michelinStatuses[0]);
  const [city, setCity] = useState(cities[0]);

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return restaurants.filter((restaurant) => {
      const matchesQuery =
        !normalizedQuery ||
        [restaurant.name, restaurant.city, restaurant.chef]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      const matchesMichelin =
        michelinStatus === michelinStatuses[0] ||
        restaurant.michelinStatus === michelinStatus;
      const matchesCity = city === cities[0] || restaurant.city === city;

      return matchesQuery && matchesMichelin && matchesCity;
    });
  }, [city, michelinStatus, query]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#080806] text-[#f4f0e7]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link
            href={`/${locale}`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.34em]"
          >
            Find Dining
          </Link>
          <div className="flex items-center gap-5">
            <nav
              aria-label="Public navigation"
              className="hidden items-center gap-6 text-xs text-white/55 md:flex"
            >
              <Link className="text-white" href={`/${locale}/restaurants`}>
                Explore Restaurants
              </Link>
              <Link
                className="transition hover:text-white"
                href={`/${locale}/business/dashboard`}
              >
                For Restaurants
              </Link>
            </nav>
            <Link
              href={`/${locale}/login`}
              className="rounded-full border border-white/20 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.15em] transition hover:border-white hover:bg-white hover:text-black"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b border-white/10 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <div className="absolute -right-24 -top-40 h-96 w-96 rounded-full bg-[#9a7b3a]/10 blur-3xl" />
        <div className="relative mx-auto max-w-[90rem]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#cdb984]">
            The Find Dining selection
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-light leading-[1.02] tracking-[-0.045em] sm:text-7xl lg:text-[5.8rem]">
            Discover Michelin-level restaurants
          </h1>
          <p className="mt-7 max-w-2xl text-base font-light leading-8 text-white/56 sm:text-lg">
            Explore selected restaurants, signature experiences and contextual
            reservations.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#10100d] p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white/45 focus-within:border-[#cdb984]/60">
              <SearchIcon />
              <span className="sr-only">Search by restaurant or city</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by restaurant or city"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5">
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/35">
                Michelin status
              </span>
              <select
                value={michelinStatus}
                onChange={(event) => setMichelinStatus(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-white outline-none [&>option]:bg-[#151510]"
              >
                {michelinStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5">
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/35">
                City
              </span>
              <select
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-white outline-none [&>option]:bg-[#151510]"
              >
                {cities.map((cityOption) => (
                  <option key={cityOption}>{cityOption}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-10 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/35">
                Curated directory
              </p>
              <h2 className="mt-2 text-2xl font-light">
                {filteredRestaurants.length}{" "}
                {filteredRestaurants.length === 1 ? "restaurant" : "restaurants"}
              </h2>
            </div>
            <p className="hidden text-xs text-white/35 sm:block">Lisbon edition</p>
          </div>

          {filteredRestaurants.length > 0 ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {filteredRestaurants.map((restaurant) => (
                <article
                  key={restaurant.name}
                  className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11110e]"
                >
                  <div className="relative h-[22rem] overflow-hidden sm:h-[28rem]">
                    {restaurant.image ? (
                      <Image
                        src={restaurant.image}
                        alt={`${restaurant.name} dining room`}
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(204,178,113,0.2),transparent_35%),linear-gradient(145deg,#202018_0%,#0b0b09_65%)]">
                        <div className="absolute inset-x-7 bottom-7 border-t border-white/15 pt-5">
                          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-white/35">
                            Above the city / Lisbon
                          </p>
                          <p className="mt-2 text-5xl font-light text-white/15 sm:text-6xl">
                            120m
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/45 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
                      {restaurant.michelinStatus}
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#cdb984]">
                          {restaurant.city}, {restaurant.country}
                        </p>
                        <h3 className="mt-3 text-3xl font-light tracking-[-0.03em] sm:text-4xl">
                          {restaurant.name}
                        </h3>
                      </div>
                      <span className="mt-1 text-xs text-white/30">FD / 0{restaurants.indexOf(restaurant) + 1}</span>
                    </div>

                    {restaurant.chef ? (
                      <p className="mt-4 text-xs text-white/45">
                        Chef {restaurant.chef}
                      </p>
                    ) : null}
                    <p className="mt-5 text-sm font-light leading-7 text-white/55">
                      {restaurant.description}
                    </p>
                    <p className="mt-5 text-[0.62rem] uppercase tracking-[0.18em] text-white/30">
                      {restaurant.detail}
                    </p>

                    <div className="mt-7 border-t border-white/10 pt-6">
                      {restaurant.slug ? (
                        <Link
                          href={`/${locale}/restaurants/${restaurant.slug}`}
                          className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] transition hover:text-[#d8c28f]"
                        >
                          View restaurant
                          <ArrowIcon />
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-flex cursor-not-allowed items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35"
                        >
                          Coming soon
                          <span className="h-px w-8 bg-white/15" />
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-16 text-center">
              <h2 className="text-2xl font-light">No matching restaurants</h2>
              <p className="mt-3 text-sm text-white/45">
                Try a different restaurant name, city, or Michelin status.
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-16 border-t border-white/10 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[90rem] flex-col justify-between gap-5 text-[0.68rem] text-white/35 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Find Dining</p>
          <div className="flex flex-wrap gap-5">
            <Link className="transition hover:text-white" href={`/${locale}`}>
              Home
            </Link>
            <Link
              className="transition hover:text-white"
              href={`/${locale}/restaurants`}
            >
              Explore Restaurants
            </Link>
            <Link
              className="transition hover:text-white"
              href={`/${locale}/business/dashboard`}
            >
              For Restaurants
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
