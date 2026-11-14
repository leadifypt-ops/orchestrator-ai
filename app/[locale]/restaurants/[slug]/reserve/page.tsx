import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReservationRequestForm from "./reservation-request-form";

type PublicReservationPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};
type PublicReservationReadiness = {
  reservation_ready?: boolean | null;
};

export const metadata: Metadata = {
  title: "Request a table | Find Dining",
  description:
    "Start a reservation request. Requests are reviewed by the restaurant and are not automatically confirmed.",
};

export default async function PublicReservationPage({
  params,
}: PublicReservationPageProps) {
  const { locale, slug } = await params;
  const supabase = await createClient();

  const [{ data: restaurant }, { data: readiness }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, slug, location, michelin_status, image_url")
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .rpc("public_reservation_readiness_v1", { p_restaurant_slug: slug })
      .maybeSingle(),
  ]);
  const reservationReadiness = readiness as PublicReservationReadiness | null;

  if (!restaurant || !reservationReadiness?.reservation_ready) {
    notFound();
  }

  const isFeitoria = slug === "feitoria";
  const restaurantName = restaurant.name || "Restaurant";
  const heroImage = isFeitoria ? "/assets/feitoria-v1/hero-sala-1.jpeg" : restaurant.image_url;

  return (
    <main className="min-h-screen bg-[#080806] text-[#f4f0e7]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link
            href={`/${locale}`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.34em]"
          >
            Find Dining
          </Link>
          <Link
            href={`/${locale}/restaurants/${slug}`}
            className="rounded-full border border-white/20 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition hover:border-white hover:bg-white hover:text-black"
          >
            Back to {restaurantName}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[90rem] lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="relative min-h-[24rem] overflow-hidden border-b border-white/10 lg:min-h-full lg:border-b-0 lg:border-r">
          {isFeitoria ? (
            <Image
              src="/assets/feitoria-v1/hero-sala-1.jpeg"
              alt={`The dining room at ${restaurantName}`}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          ) : heroImage ? (
            <img
              src={heroImage}
              alt={`The dining room at ${restaurantName}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-12">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#e2c873]">
              {restaurant.michelin_status || "Find Dining"} / {restaurant.location || "Location shared after review"}
            </p>
            <h1 className="mt-5 text-5xl font-light tracking-[-0.04em] sm:text-6xl">
              {restaurantName}
            </h1>
            <p className="mt-5 max-w-md text-sm font-light leading-7 text-white/65">
              Begin with the details that matter. Share individual preferences so
              kitchen and service can prepare for every guest.
            </p>
          </div>
        </aside>

        <section className="px-5 py-14 sm:px-8 sm:py-20 lg:px-14 xl:px-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#cdb984]">
              Reservation request
            </p>
            <h2 className="mt-5 text-4xl font-light leading-tight tracking-[-0.035em] sm:text-5xl">
              Request your experience.
            </h2>
            <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-white/55 sm:text-base">
              This is a request, not an automatic confirmation. Reservation
              requests and each guest profile are reviewed by the restaurant before
              a table is confirmed.
            </p>

            <ReservationRequestForm restaurantSlug={slug} restaurantName={restaurantName} />
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[90rem] flex-col justify-between gap-4 text-[0.68rem] text-white/35 sm:flex-row">
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
          </div>
        </div>
      </footer>
    </main>
  );
}
