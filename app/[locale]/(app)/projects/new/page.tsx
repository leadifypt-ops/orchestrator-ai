"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;

  const [restaurantName, setRestaurantName] = useState("");
  const [chefName, setChefName] = useState("");
  const [city, setCity] = useState("");
  const [michelinStatus, setMichelinStatus] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function createRestaurant() {
    if (!restaurantName.trim() || loading) return;

    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/${locale}/login`);
        return;
      }

      const { data: created, error } = await supabase
        .from("automations")
        .insert({
          user_id: user.id,
          name: restaurantName,
          project_name: restaurantName,
          prompt: description || `Restaurante ${restaurantName}`,
          business_type: "restaurant",
          goal: "Gerir presença e reservas na Find Dining",
          status: "active",
          config: {
            type: "restaurant",
            restaurantName,
            chefName,
            city,
            michelinStatus,
            description,
          },
        })
        .select()
        .single();

      if (error || !created) {
        console.error("Erro ao criar restaurante:", error);
        setMessage("Erro ao criar restaurante. Vê a consola.");
        setLoading(false);
        return;
      }

      router.push(`/${locale}/projects`);
    } catch (err) {
      console.error("Erro inesperado:", err);
      setMessage("Erro inesperado ao criar restaurante.");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">
        Find Dining
      </p>

      <h1 className="text-3xl font-bold mb-2">Novo Restaurante</h1>

      <p className="text-zinc-500 mb-8">
        Cria a primeira página de restaurante para a plataforma Find Dining.
      </p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Nome do restaurante
          </label>
          <input
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Ex: Feitoria"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Nome do chef
          </label>
          <input
            value={chefName}
            onChange={(e) => setChefName(e.target.value)}
            placeholder="Ex: André Cruz"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Cidade</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: Lisboa"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Estado Michelin
          </label>
          <select
            value={michelinStatus}
            onChange={(e) => setMichelinStatus(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30"
          >
            <option value="">Selecionar</option>
            <option value="mentioned">Menção Guia Michelin</option>
            <option value="1-star">1 estrela Michelin</option>
            <option value="2-stars">2 estrelas Michelin</option>
            <option value="3-stars">3 estrelas Michelin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Descrição curta
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Experiência gastronómica contemporânea em Lisboa, com foco no produto português, vinho e serviço de excelência."
            className="w-full h-36 bg-zinc-900 border border-white/10 rounded-lg p-4 outline-none focus:border-white/30"
          />
        </div>

        <button
          onClick={createRestaurant}
          disabled={loading || !restaurantName.trim()}
          className="bg-white text-black px-6 py-3 rounded-lg disabled:opacity-50"
        >
          {loading ? "A criar restaurante..." : "Criar Restaurante"}
        </button>

        {message && <p className="text-sm text-red-400">{message}</p>}
      </div>
    </div>
  );
}