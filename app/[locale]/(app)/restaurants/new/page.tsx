"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BusinessOption = {
  id: string;
  name: string;
};

export default function NewRestaurantPage() {
  const router = useRouter();
  const params = useParams();
  const locale = String(params.locale || "pt");

  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [michelinStatus, setMichelinStatus] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [chefName, setChefName] = useState("");
  const [chefStory, setChefStory] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#0f0f0f");
  const [brandAccentColor, setBrandAccentColor] = useState("#d4af37");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadBusinesses() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isActive) {
          setErrorMessage("You must be signed in to create a restaurant.");
          setIsLoadingBusinesses(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("business_memberships")
        .select("business_id, businesses(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!isActive) return;

      if (error) {
        setErrorMessage(error.message);
        setIsLoadingBusinesses(false);
        return;
      }

      const options = (data || []).map((membership) => {
        const relatedBusiness = Array.isArray(membership.businesses)
          ? membership.businesses[0]
          : membership.businesses;

        return {
          id: membership.business_id,
          name: relatedBusiness?.name || "Unnamed business",
        };
      });

      setBusinesses(options);
      setBusinessId(options[0]?.id || "");
      setIsLoadingBusinesses(false);
    }

    void loadBusinesses();

    return () => {
      isActive = false;
    };
  }, []);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    if (!businessId) {
      setErrorMessage(
        "Your user must belong to a business before creating a restaurant."
      );
      setIsSaving(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("restaurants").insert({
      business_id: businessId,
      name,
      slug,
      location,
      michelin_status: michelinStatus,
      description,
      image_url: imageUrl,
      logo_url: logoUrl,
      chef_name: chefName,
      chef_story: chefStory,
      brand_primary_color: brandPrimaryColor,
      brand_accent_color: brandAccentColor,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.push(`/${locale}/business/restaurants`);
    router.refresh();
  }

  return (
    <div className="p-8 text-white">
      <div className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Restaurants
        </p>

        <h1 className="mt-3 text-3xl font-semibold">Create restaurant</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Build the restaurant profile Find Dining will use for public pages,
          reservation requests, guest context, and dining experience setup.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Restaurant profile</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70">
                  Business
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={businessId}
                  onChange={(event) => setBusinessId(event.target.value)}
                  disabled={isLoadingBusinesses || businesses.length === 0}
                  required
                >
                  {businesses.length === 0 ? (
                    <option value="">
                      {isLoadingBusinesses
                        ? "Loading businesses..."
                        : "No business membership available"}
                    </option>
                  ) : null}
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Restaurant name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setName(value);
                    setSlug(generateSlug(value));
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Slug
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={slug}
                  onChange={(event) => setSlug(generateSlug(event.target.value))}
                  placeholder="feitoria"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Location
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Lisbon, Portugal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Michelin status
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={michelinStatus}
                  onChange={(event) => setMichelinStatus(event.target.value)}
                  placeholder="1 Michelin star"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Visual identity</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Hero image
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="Primary image for the public restaurant page"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Logo
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="Restaurant logo URL"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-white/70">
                    Primary brand color
                  </label>
                  <input
                    type="color"
                    className="mt-1 h-12 w-full rounded-md border border-white/10 bg-black/30 p-1"
                    value={brandPrimaryColor}
                    onChange={(event) =>
                      setBrandPrimaryColor(event.target.value)
                    }
                  />
                  <p className="mt-2 text-xs text-white/40">
                    {brandPrimaryColor}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70">
                    Accent brand color
                  </label>
                  <input
                    type="color"
                    className="mt-1 h-12 w-full rounded-md border border-white/10 bg-black/30 p-1"
                    value={brandAccentColor}
                    onChange={(event) =>
                      setBrandAccentColor(event.target.value)
                    }
                  />
                  <p className="mt-2 text-xs text-white/40">
                    {brandAccentColor}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Chef and story</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Chef name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={chefName}
                  onChange={(event) => setChefName(event.target.value)}
                  placeholder="Andre Cruz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Chef story
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={chefStory}
                  onChange={(event) => setChefStory(event.target.value)}
                  rows={5}
                  placeholder="Share the chef's philosophy, point of view, and culinary identity."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Restaurant story
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Describe the atmosphere, hospitality style, and dining experience guests should expect."
                />
              </div>
            </div>
          </section>

          {errorMessage ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSaving || isLoadingBusinesses || !businessId}
            className="rounded-xl px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            style={{ backgroundColor: brandAccentColor }}
          >
            {isSaving ? "Creating restaurant..." : "Create restaurant"}
          </button>
        </form>
      </div>
    </div>
  );
}
