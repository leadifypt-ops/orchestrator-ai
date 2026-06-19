import type { Metadata } from "next";
import RestaurantDiscovery from "./restaurant-discovery";

type RestaurantDiscoveryPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const metadata: Metadata = {
  title: "Discover Restaurants | Find Dining",
  description:
    "Explore selected restaurants, signature experiences, and contextual reservations.",
};

export default async function RestaurantDiscoveryPage({
  params,
}: RestaurantDiscoveryPageProps) {
  const { locale } = await params;

  return <RestaurantDiscovery locale={locale} />;
}
