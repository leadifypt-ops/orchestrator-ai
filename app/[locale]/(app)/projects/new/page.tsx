"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

type GeneratedAutomation = {
  projectName?: string;
  businessType?: string;
  goal?: string;
  [key: string]: unknown;
};

type GenerateAutomationResponse = {
  ok?: boolean;
  automation?: GeneratedAutomation;
  error?: string;
  code?: string;
};

export default function NewProjectPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectingMessage, setRedirectingMessage] = useState("");

  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;

  async function generate() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setRedirectingMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRedirectingMessage("A redirecionar para login...");
        router.push(`/${locale}/login`);
        return;
      }

      const res = await fetch("/api/generate-automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data =
        (await res.json().catch(() => null)) as GenerateAutomationResponse | null;

      if (res.status === 401) {
        setRedirectingMessage("A redirecionar para login...");
        router.push(`/${locale}/login`);
        return;
      }

      if (res.status === 403) {
        setRedirectingMessage("A redirecionar para os planos...");
        router.push("/pricing?reason=plan-required");
        return;
      }

      if (!res.ok) {
        console.error("Erro ao gerar automação:", data?.error);
        setRedirectingMessage("");
        setLoading(false);
        return;
      }

      if (!data?.automation) {
        console.error("IA não devolveu automação");
        setRedirectingMessage("");
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
          prompt,
          business_type: automation.businessType || null,
          goal: automation.goal || null,
          status: "active",
          webhook_url: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || null,
          config: automation || {},
        })
        .select()
        .single();

      if (error || !created) {
        console.error("Erro ao guardar automação:", error);
        setRedirectingMessage("");
        setLoading(false);
        return;
      }

      setRedirectingMessage("A abrir automação...");
      router.push(`/${locale}/automations/${created.id}`);
    } catch (err) {
      console.error("Erro inesperado:", err);
      setRedirectingMessage("");
      setLoading(false);
    }
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
        {loading ? "A processar..." : "Generate Project"}
      </button>

      {redirectingMessage && (
        <p className="mt-4 text-sm text-white/55">{redirectingMessage}</p>
      )}
    </div>
  );
}