"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

export default function NewRestaurantPage() {
  const router = useRouter();
  const params = useParams();
  const locale = String(params.locale || "en");

  const supabase = createClient();

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

    const { error } = await supabase.from("restaurants").insert({
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

    router.push(`/${locale}/restaurants/${slug}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Create Restaurant Experience
        </p>

        <h1 className="mt-3 text-3xl font-semibold">
          Design Your Restaurant Experience
        </h1>

        <p className="mt-3 text-white/60">
          Show guests the experience before they arrive.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Restaurant Profile</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Restaurant Name
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
                  Michelin Status
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={michelinStatus}
                  onChange={(event) => setMichelinStatus(event.target.value)}
                  placeholder="1 Michelin Star"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Brand Experience</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Hero Image
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="The image that best represents your restaurant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Restaurant Logo
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="Official restaurant logo"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-white/70">
                    Primary Brand Color
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
                    Accent Brand Color
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

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Restaurant Story</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Restaurant Philosophy
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Describe the atmosphere, philosophy and experience guests should expect."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Chef Name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={chefName}
                  onChange={(event) => setChefName(event.target.value)}
                  placeholder="André Cruz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70">
                  Chef Philosophy
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-3 text-white outline-none"
                  value={chefStory}
                  onChange={(event) => setChefStory(event.target.value)}
                  rows={5}
                  placeholder="Tell guests about the vision, inspiration and values behind the cuisine."
                />
              </div>
            </div>
          </section>

          {errorMessage && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            style={{ backgroundColor: brandAccentColor }}
          >
            {isSaving ? "Saving..." : "Create Experience"}
          </button>
        </form>
      </div>
    </main>
  );
}