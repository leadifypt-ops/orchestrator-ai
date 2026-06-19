import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

type MarketplaceHomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const metadata: Metadata = {
  title: "Find Dining | Remarkable tables, thoughtfully chosen",
  description:
    "Discover exceptional restaurants and reserve dining experiences worth remembering.",
};

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "Explore a considered selection of restaurants, chefs, and dining experiences.",
  },
  {
    number: "02",
    title: "Choose",
    description:
      "Find the table that fits the moment, from a quiet dinner to a destination tasting menu.",
  },
  {
    number: "03",
    title: "Experience",
    description:
      "Share what matters before you arrive and let the restaurant prepare for every detail.",
  },
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

export default async function MarketplaceHome({
  params,
}: MarketplaceHomeProps) {
  const { locale } = await params;

  return (
    <main className="min-h-screen overflow-hidden bg-[#080806] text-[#f4f0e7]">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link
            href={`/${locale}`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-white"
          >
            Find Dining
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-8 text-xs text-white/70 md:flex"
          >
            <Link
              className="transition hover:text-white"
              href={`/${locale}/restaurants`}
            >
              Restaurants
            </Link>
            <a className="transition hover:text-white" href="#how-it-works">
              How it works
            </a>
            <Link
              className="transition hover:text-white"
              href={`/${locale}/business/dashboard`}
            >
              For restaurants
            </Link>
          </nav>

          <Link
            href={`/${locale}/login`}
            className="rounded-full border border-white/25 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-white hover:bg-white hover:text-black sm:px-5"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative flex min-h-[94svh] items-end">
        <Image
          src="/assets/feitoria-v1/featured-wine-service.jpeg"
          alt="An intimate fine dining table prepared for service"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,4,0.88)_0%,rgba(5,5,4,0.55)_48%,rgba(5,5,4,0.15)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,8,6,1)_0%,rgba(8,8,6,0.15)_48%,rgba(8,8,6,0.55)_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-[90rem] px-5 pb-16 pt-36 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
          <p className="mb-7 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#d8c28f]">
            Exceptional dining, personally discovered
          </p>
          <h1 className="max-w-4xl text-5xl font-light leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[6.7rem]">
            Find a table worth remembering.
          </h1>
          <p className="mt-7 max-w-xl text-base font-light leading-7 text-white/66 sm:text-lg sm:leading-8">
            A curated guide to remarkable restaurants, distinctive chefs, and
            the experiences that stay with you long after the final course.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/restaurants`}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[#e5d09d] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#11100d] transition hover:bg-white"
            >
              Explore restaurants
              <ArrowIcon />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:border-white hover:bg-white/10"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      <section
        id="restaurants"
        className="border-t border-white/10 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto max-w-[90rem]">
          <div className="mb-12 flex flex-col justify-between gap-6 md:mb-16 md:flex-row md:items-end">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#cdb984]">
                Featured restaurants
              </p>
              <h2 className="mt-5 max-w-2xl text-4xl font-light tracking-[-0.035em] sm:text-6xl">
                Places with a point of view.
              </h2>
            </div>
            <p className="max-w-md text-sm font-light leading-7 text-white/52">
              We look beyond the reservation book to find restaurants where
              cuisine, place, and hospitality form one singular experience.
            </p>
          </div>

          <Link
            href={`/${locale}/restaurants/feitoria`}
            className="group grid overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11110e] lg:grid-cols-[1.45fr_0.75fr]"
          >
            <div className="relative min-h-[28rem] overflow-hidden sm:min-h-[38rem]">
              <Image
                src="/assets/feitoria-v1/hero-sala-1.jpeg"
                alt="The dining room at Feitoria in Lisbon"
                fill
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="object-cover transition duration-700 group-hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent lg:hidden" />
              <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] backdrop-blur-md sm:left-7 sm:top-7">
                Lisbon, Portugal
              </div>
            </div>

            <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <div className="flex items-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#d8c28f]">
                  <span className="h-px w-8 bg-[#d8c28f]" />
                  Michelin starred
                </div>
                <h3 className="mt-7 text-4xl font-light tracking-[-0.03em] sm:text-5xl">
                  Feitoria
                </h3>
                <p className="mt-5 text-base font-light leading-7 text-white/58">
                  Chef Andre Cruz gives Portuguese tradition a precise,
                  contemporary voice in a tasting experience shaped by the
                  Atlantic.
                </p>
              </div>

              <div className="mt-14 flex items-center justify-between border-t border-white/10 pt-6 text-xs font-semibold uppercase tracking-[0.16em]">
                <span>View Restaurant</span>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 transition group-hover:border-[#d8c28f] group-hover:bg-[#d8c28f] group-hover:text-black">
                  <ArrowIcon />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-white/10 bg-[#0d0d0a] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#cdb984]">
                How it works
              </p>
              <h2 className="mt-5 text-4xl font-light leading-tight tracking-[-0.035em] sm:text-6xl">
                Less searching.
                <br />
                Better dining.
              </h2>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="grid gap-3 py-8 sm:grid-cols-[5rem_10rem_1fr] sm:items-start sm:gap-6 sm:py-10"
                >
                  <span className="text-xs text-[#cdb984]">{step.number}</span>
                  <h3 className="text-xl font-light">{step.title}</h3>
                  <p className="max-w-lg text-sm font-light leading-7 text-white/52">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="for-restaurants"
        className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#15140f] px-6 py-16 sm:px-12 sm:py-20 lg:px-20 lg:py-24">
          <div className="absolute -right-24 -top-44 h-96 w-96 rounded-full bg-[#a78945]/15 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#cdb984]">
                For restaurants
              </p>
              <h2 className="mt-5 max-w-3xl text-4xl font-light leading-[1.08] tracking-[-0.04em] sm:text-6xl">
                Turn every reservation into a more personal welcome.
              </h2>
            </div>
            <div>
              <p className="text-base font-light leading-8 text-white/56">
                Find Dining helps exceptional restaurants understand their
                guests, shape memorable experiences, and build relationships
                that continue beyond the table.
              </p>
              <Link
                href={`/${locale}/business/dashboard`}
                className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/25 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-[#d8c28f] hover:bg-[#d8c28f] hover:text-black"
              >
                For Restaurants
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 pb-8 pt-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <div className="flex flex-col justify-between gap-10 pb-14 md:flex-row md:items-start">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em]">
                Find Dining
              </p>
              <p className="mt-4 max-w-xs text-sm font-light leading-6 text-white/42">
                Remarkable tables, thoughtfully chosen.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-xs text-white/55">
              <Link
                className="transition hover:text-white"
                href={`/${locale}/restaurants`}
              >
                Restaurants
              </Link>
              <a className="transition hover:text-white" href="#how-it-works">
                How it works
              </a>
              <Link
                className="transition hover:text-white"
                href={`/${locale}/business/dashboard`}
              >
                For restaurants
              </Link>
              <Link className="transition hover:text-white" href={`/${locale}/login`}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-[0.68rem] text-white/32 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Find Dining</p>
            <p>Made for memorable hospitality.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
