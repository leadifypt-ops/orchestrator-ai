"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function NewProjectPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;

  async function generate() {
    if (!prompt.trim()) return;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Utilizador não autenticado");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/generate-automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!data?.automation) {
        alert("Erro ao gerar automação");
        setLoading(false);
        return;
      }

      const automation = data.automation;

      const { data: created, error } = await supabase
        .from("automations")
        .insert({
          user_id: user.id,
          name: automation.projectName || "Sem nome",
          project_name: automation.projectName || "Sem nome",
          prompt: prompt,
          business_type: automation.businessType || null,
          goal: automation.goal || null,
          status: "active",
          webhook_url: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || null,
          config: automation || {},
        })
        .select()
        .single();

      if (error || !created) {
        console.error(error);
        alert("Erro ao guardar automação");
        setLoading(false);
        return;
      }

      router.push(`/${locale}/automations/${created.id}`);
    } catch (err) {
      console.error(err);
      alert("Erro inesperado");
    }

    setLoading(false);
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-bold mb-4">Create Project</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Create automation for Instagram..."
        className="w-full h-40 bg-zinc-900 border border-white/10 rounded-lg p-4"
      />

      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 bg-white text-black px-6 py-3 rounded-lg disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Project"}
      </button>
    </div>
  );
}