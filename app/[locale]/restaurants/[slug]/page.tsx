import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type RestaurantPageProps = {
  params: Promise<{
    slug: string;
    locale: string;
  }>;
};

export default async function RestaurantPage({ params }: RestaurantPageProps) {
  const { slug, locale } = await params;
  const supabase = await createClient();

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !restaurant) {
    notFound();
  }

  // Fetch featured dishes
  const { data: featuredDishesData } = await supabase
    .from("restaurant_featured_dishes")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("display_order", { ascending: true });
  const featuredDishes = featuredDishesData ?? [];

  const accentColor = restaurant.brand_accent_color || "#d4af37";
  const primaryColor = restaurant.brand_primary_color || "#0f0f0f";

  // For Feitoria demo, use local assets
  const isFeitoria = slug === "feitoria";
  const heroImage = isFeitoria ? "/assets/feitoria-v1/hero-sala-1.jpeg" : restaurant.image_url;
  const chefImage = isFeitoria ? "/assets/feitoria-v1/chef-andre.jpg" : restaurant.chef_image_url;
  const teamImage = isFeitoria ? "/assets/feitoria-v1/team-feitoria.jpg" : null;
  const kitchenImage = isFeitoria ? "/assets/feitoria-v1/kitchen-behind-scenes.jpg" : null;
  const chefName = restaurant.chef_name || "Chef André Cruz";
  const reservationHref = isFeitoria
    ? `/${locale}/restaurants/feitoria/reserve`
    : null;

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor: primaryColor }}>
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/10 bg-black/15 backdrop-blur-sm">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link
            href={`/${locale}`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-white"
          >
            Find Dining
          </Link>
          <nav
            aria-label="Public navigation"
            className="flex items-center gap-5 text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
          >
            <Link
              href={`/${locale}/restaurants`}
              className="hidden text-white/65 transition hover:text-white sm:block"
            >
              Explore Restaurants
            </Link>
            <Link
              href={`/${locale}/business/dashboard`}
              className="rounded-full border border-white/25 px-4 py-2 text-white transition hover:border-white hover:bg-white hover:text-black"
            >
              For Restaurants
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section with Background Image */}
      <section className="relative flex min-h-[72vh] sm:min-h-[75vh] md:min-h-[85vh] items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('${heroImage}')`,
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

        <div className="relative z-10 w-full px-6 pb-10 pt-32 sm:pb-14 md:px-12 md:pb-16 lg:px-20">
          <Link
            href={`/${locale}/restaurants`}
            className="mb-12 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-white/60 hover:text-white transition"
          >
            Explore Restaurants
          </Link>

          <div
            className="inline-block px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.2em] mb-6"
            style={{ backgroundColor: accentColor, color: primaryColor }}
          >
            {restaurant.michelin_status}
          </div>

          <h1 className="mt-6 max-w-5xl text-6xl md:text-8xl font-light tracking-tight leading-tight">
            {restaurant.name}
          </h1>

          <p className="mt-6 text-lg text-white/70">{restaurant.location}</p>

          <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:gap-4">
            {reservationHref ? (
              <Link
                href={reservationHref}
                className="inline-flex w-full items-center justify-center rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition hover:opacity-85 sm:w-auto"
                style={{ backgroundColor: accentColor, color: primaryColor }}
              >
                Reserve Experience
              </Link>
            ) : (
              <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full border border-white/20 px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white/40 sm:w-auto">
                Reserve Experience
              </span>
            )}

            <Link
              href={`/${locale}/restaurants`}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/10 sm:w-auto"
            >
              Explore Restaurants
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/55">
            Reservation requests are reviewed by the restaurant.
          </p>
        </div>
      </section>

      {/* The Experience Section */}
      <section className="border-t border-white/10 px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:px-20 lg:py-28">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.5fr] max-w-6xl mx-auto">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
              The Experience
            </p>

            <h2 className="mt-6 text-4xl md:text-5xl font-light leading-tight">
              A fine dining journey begins before the first bite.
            </h2>
          </div>

          <div>
            <p className="text-lg leading-8 text-white/70 font-light">
              {restaurant.description}
            </p>
          </div>
        </div>
      </section>

      {/* Chef Section - Meet Chef André Cruz */}
      <section className="px-6 py-14 sm:py-16 md:py-28 md:px-12 lg:px-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-8 sm:gap-12 lg:gap-20 lg:grid-cols-2 items-center">
            {chefImage && (
              <div className="relative h-[30rem] sm:h-[34rem] md:h-[34rem] lg:h-[36rem] rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={chefImage}
                  alt={chefName}
                  className="w-full h-full object-contain object-center"
                />
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
                Meet the Chef
              </p>

              <h2 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-light leading-tight">
                {chefName}
              </h2>

              <p
                className="mt-6 text-sm font-semibold uppercase tracking-[0.2em]"
                style={{ color: accentColor }}
              >
                Executive Chef
              </p>

              <div className="mt-8 space-y-5 md:mt-10 md:space-y-6">
                <p className="text-lg leading-8 text-white/70 font-light">
                  {restaurant.chef_story}
                </p>

                <p className="text-lg leading-8 text-white/70 font-light">
                  Chef André Cruz brings decades of culinary mastery to create an unforgettable dining experience rooted in Portuguese tradition and contemporary innovation. Every plate is a reflection of his philosophy: respect for the ingredient, precision in technique, and passion for storytelling.
                </p>

                <p className="text-lg leading-8 text-white/70 font-light">
                  At Feitoria, we believe that fine dining is not just about food—it is about creating memories through the marriage of flavor, art, and human connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Dishes Section */}
      {isFeitoria && (
        <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10 sm:mb-12 md:mb-16">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
                Signature Moments
              </p>

              <h2 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-light leading-tight">
                Signature Dishes
              </h2>

              <p className="mt-6 text-lg text-white/70 font-light">
                Each dish tells the story of our culinary vision—a celebration of Portuguese heritage, seasonal ingredients, and meticulous technique.
              </p>
            </div>

            <div className="space-y-12 sm:space-y-14 lg:space-y-24">
              {/* Açorda */}
              <div className="grid gap-8 sm:gap-10 lg:gap-12 lg:grid-cols-2 items-center">
              <div className="relative h-[24rem] sm:h-[30rem] md:h-72 lg:h-80 xl:h-96 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src="/assets/feitoria-v1/featured-acorda.jpeg"
                  alt="Açorda"
                  className="w-full h-full object-cover object-top md:object-center"
                />
                </div>

                <div>
                  <h3 className="text-4xl md:text-5xl font-light">Açorda</h3>

                  <p
                    className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]"
                    style={{ color: accentColor }}
                  >
                    A Portuguese Classic
                  </p>

                  <p className="mt-6 text-lg leading-8 text-white/70 font-light">
                    A timeless Portuguese dish reimagined with contemporary technique. Silky bread soup infused with garlic, coriander, and the finest ingredients, finished with a perfectly poached egg at the heart of the plate.
                  </p>

                  <p className="mt-4 text-white/60 text-sm">
                    Bread · Garlic · Coriander · Egg Yolk · Seasonal Greens
                  </p>
                </div>
              </div>

              {/* Cozido do Mar */}
              <div className="grid gap-8 sm:gap-10 lg:gap-12 lg:grid-cols-2 items-center lg:grid-flow-dense">
              <div className="relative h-[24rem] sm:h-[30rem] md:h-72 lg:h-80 xl:h-96 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src="/assets/feitoria-v1/featured-cozido-do-mar.jpeg"
                  alt="Cozido do Mar"
                  className="w-full h-full object-cover object-top md:object-center"
                />
                </div>

                <div>
                  <h3 className="text-4xl md:text-5xl font-light">Cozido do Mar</h3>

                  <p
                    className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]"
                    style={{ color: accentColor }}
                  >
                    From the Sea
                  </p>

                  <p className="mt-6 text-lg leading-8 text-white/70 font-light">
                    A celebration of Portugal&apos;s rich maritime heritage. The finest seafood—selected daily from local fishermen—prepared with respect for the ingredient and presented with the precision that defines our kitchen.
                  </p>

                  <p className="mt-4 text-white/60 text-sm">
                    Wild Seafood · Seasonal Stock · Aromatic Vegetables · Finishing Oil
                  </p>
                </div>
              </div>

              {/* Bacalhau */}
              <div className="grid gap-8 sm:gap-10 lg:gap-12 lg:grid-cols-2 items-center">
              <div className="relative h-[24rem] sm:h-[30rem] md:h-72 lg:h-80 xl:h-96 rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src="/assets/feitoria-v1/featured-bacalhau.jpeg"
                    alt="Bacalhau à Brás"
                    className="w-full h-full object-cover object-top md:object-center"
                  />
                </div>

                <div>
                  <h3 className="text-4xl md:text-5xl font-light">Bacalhau à Brás</h3>

                  <p
                    className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]"
                    style={{ color: accentColor }}
                  >
                    Portuguese Legacy
                  </p>

                  <p className="mt-6 text-lg leading-8 text-white/70 font-light">
                    A reinterpretation of a beloved classic. Carefully sourced bacalhau prepared with artisanal technique, combined with golden potato strands and the comfort of Portuguese tradition, elevated to fine dining excellence.
                  </p>

                  <p className="mt-4 text-white/60 text-sm">
                    Dry Cod · Potato · Olive Oil · Traditional Portuguese Method
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Dishes Section from Database */}
      {!isFeitoria && featuredDishes.length > 0 && (
        <section className="px-6 py-20 md:px-12 lg:px-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
              Signature Moments
            </p>

            <h2 className="mt-6 text-4xl md:text-5xl font-light">
              Featured Dishes
            </h2>

            <div className="mt-16 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
              {featuredDishes.map((dish) => (
                <div key={dish.id} className="group">
                  {dish.image_url && (
                    <div className="relative h-64 mb-6 rounded-xl overflow-hidden">
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    </div>
                  )}

                  <h3 className="text-2xl font-light">{dish.name}</h3>

                  {dish.description && (
                    <p className="mt-4 text-white/70 text-sm leading-6">
                      {dish.description}
                    </p>
                  )}

                  {dish.pairing_note && (
                    <p
                      className="mt-4 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{ color: accentColor }}
                    >
                      {dish.pairing_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Wine Pairing Section */}
      <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-12 md:mb-16">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
              Wine Experience
            </p>

            <h2 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-light leading-tight">
              A Journey Through Portuguese Wine
            </h2>
          </div>

          <div className="grid gap-8 sm:gap-10 lg:gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className="text-lg leading-8 text-white/70 font-light mb-8">
                Our wine program is curated to pair with each course, whether you choose the tasting menu or à la carte experience. From crisp Portuguese whites to elegant reds from the Douro Valley, each selection is chosen to enhance and celebrate the precision of our kitchen.
              </p>

              <p className="text-lg leading-8 text-white/70 font-light">
                Our sommelier is available to guide you through our collection, sharing the stories of each region and vineyard. Every pairing is an invitation to experience Portuguese viticulture at its finest.
              </p>
            </div>

            <div className="relative h-[24rem] sm:h-[30rem] md:h-96 lg:h-[28rem] rounded-2xl overflow-hidden border border-white/10">
              <img
                src="/assets/feitoria-v1/featured-wine-service.jpeg"
                alt="Wine Service"
                className="w-full h-full object-cover object-top md:object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Experience Video Section */}
      <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold mb-6">
            Visual Storytelling
          </p>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-light leading-tight mb-10 sm:mb-12 md:mb-16">
            Experience in Motion
          </h2>

          <div className="flex justify-center">
            <div className="relative w-full max-w-[400px] rounded-3xl overflow-hidden border border-white/10 bg-black">
              <video
                className="w-full object-contain"
                src="/assets/feitoria-v1/experience-video-cozido-do-mar.mp4"
                muted
                autoPlay
                loop
                playsInline
                controls={false}
              />
            </div>
          </div>

          <p className="mt-10 text-lg text-white/70 font-light">
            Watch as Chef André Cruz prepares one of our signature dishes. This intimate look at our kitchen reveals the precision, passion, and artistry that define the Feitoria experience.
          </p>
        </div>
      </section>

      {/* Team Section */}
      <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
            Our People
          </p>

          <h2 className="mt-6 text-4xl md:text-5xl font-light mb-10 sm:mb-12 md:mb-16">
            Meet the Team
          </h2>

          {teamImage && (
            <div className="relative h-64 sm:h-80 md:h-96 lg:h-[28rem] rounded-2xl overflow-hidden mb-8 sm:mb-10 md:mb-12 border border-white/10">
              <img
                src={teamImage}
                alt="Team"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="grid gap-12 lg:grid-cols-2 items-start">
            <div>
              <p className="text-lg leading-8 text-white/70 font-light">
                Every plate that leaves our kitchen, every moment of service in our dining room—these are the result of a multidisciplinary team united by a single vision: to create an unforgettable experience.
              </p>

              <p className="mt-6 text-lg leading-8 text-white/70 font-light">
                From the precision of our kitchen brigade to the grace of our service team, we believe that excellence is not an individual pursuit but a collective commitment. Each member brings their craft, their passion, and their dedication to every detail.
              </p>
            </div>

            <div className="space-y-6">
              <div className="border-l-2" style={{ borderColor: accentColor }}>
                <p className="pl-6 text-white/60 font-light leading-7">
                  &quot;Cooking is about passion, so it needs to be about technique. The importance of technique for me is by way of the fact that I was brought up in the [tradition].&quot;
                </p>
                <p
                  className="mt-4 pl-6 text-sm font-semibold uppercase tracking-[0.15em]"
                  style={{ color: accentColor }}
                >
                  — The Kitchen
                </p>
              </div>

              <div className="border-l-2" style={{ borderColor: accentColor }}>
                <p className="pl-6 text-white/60 font-light leading-7">
                  The dining experience is not merely about food—it is about connection, atmosphere, and the human touch that transforms a meal into a memory.
                </p>
                <p
                  className="mt-4 pl-6 text-sm font-semibold uppercase tracking-[0.15em]"
                  style={{ color: accentColor }}
                >
                  — The Dining Room
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Behind The Scenes Section */}
      {kitchenImage && (
        <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold">
              Behind The Scenes
            </p>

            <h2 className="mt-6 text-4xl md:text-5xl font-light mb-16">
              Inside the Kitchen
            </h2>

            <div className="relative h-64 sm:h-80 md:h-[32rem] rounded-2xl overflow-hidden border border-white/10">
              <img
                src={kitchenImage}
                alt="Kitchen Behind the Scenes"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="mt-12 text-lg leading-8 text-white/70 font-light max-w-3xl">
              Precision, passion, and purpose define every moment in our kitchen. Where technique meets creativity, and tradition honors innovation.
            </p>
          </div>
        </section>
      )}

      {/* Final CTA Section */}
      <section className="px-6 py-12 sm:py-16 md:py-20 md:px-12 lg:py-28 lg:px-20 border-t border-white/10">
            <h2 className="mt-6 text-4xl md:text-5xl font-light leading-tight">
              A table at Feitoria, thoughtfully prepared.
            </h2>

            <p className="mt-8 text-lg text-white/70 font-light leading-8">
              Share your preferences, dietary needs and wine interests before arrival, allowing the team to prepare a more personalised experience.
            </p>

            {reservationHref ? (
              <Link
                href={reservationHref}
                className="mt-10 inline-flex rounded-full px-10 py-4 text-sm font-semibold uppercase tracking-[0.1em] transition hover:opacity-85"
                style={{ backgroundColor: accentColor, color: primaryColor }}
              >
                Reserve Experience
              </Link>
            ) : (
              <span className="mt-10 inline-flex cursor-not-allowed rounded-full border border-white/20 px-10 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-white/40">
                Reserve Experience
              </span>
            )}
            <p className="mt-3 text-xs text-white/55">
              Reservation requests are reviewed by the restaurant.
            </p>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-[90rem] flex-col justify-between gap-5 text-[0.68rem] text-white/40 sm:flex-row">
          <Link
            href={`/${locale}`}
            className="font-semibold uppercase tracking-[0.28em] text-white"
          >
            Find Dining
          </Link>
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
