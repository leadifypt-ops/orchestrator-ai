"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export default function NewProjectPage() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState("");

  function generate() {
    const id = Math.random().toString(36).slice(2, 8);
    const locale = pathname.split("/")[1] || "en";

    localStorage.setItem("latestProjectPrompt", prompt);
    localStorage.setItem("latestProjectId", id);

    window.location.href = `/${locale}/projects/${id}`;
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Create Project</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Create automation for Instagram..."
        className="w-full h-40 bg-zinc-900 border border-white/10 rounded-lg p-4"
      />

      <button
        onClick={generate}
        className="mt-4 bg-white text-black px-6 py-3 rounded-lg"
      >
        Generate Project
      </button>
    </div>
  );
}