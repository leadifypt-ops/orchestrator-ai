"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DispatchState =
  | {
      type: "idle";
      message: string;
    }
  | {
      type: "loading";
      message: string;
    }
  | {
      type: "success";
      message: string;
    }
  | {
      type: "error";
      message: string;
    };

export default function RunDispatchButton() {
  const router = useRouter();
  const [state, setState] = useState<DispatchState>({
    type: "idle",
    message: "",
  });

  useEffect(() => {
    if (state.type === "success" || state.type === "error") {
      const timer = setTimeout(() => {
        setState({ type: "idle", message: "" });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [state]);

  async function handleDispatch() {
    try {
      setState({
        type: "loading",
        message: "A correr Execution Engine...",
      });

      const res = await fetch("/api/dispatch", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setState({
          type: "error",
          message: data?.error || "Erro ao correr dispatch.",
        });
        return;
      }

      const schedulerCreated = data?.scheduler?.created ?? 0;
      const schedulerSkipped = data?.scheduler?.skipped ?? 0;
      const runnerStatus =
        data?.runner?.status || data?.runner?.message || "ok";

      setState({
        type: "success",
        message: `Dispatch concluído · Criadas: ${schedulerCreated} · Ignoradas: ${schedulerSkipped} · Runner: ${runnerStatus}`,
      });

      router.refresh();
    } catch (error) {
      console.error(error);

      setState({
        type: "error",
        message: "Erro inesperado ao correr dispatch.",
      });
    }
  }

  const isLoading = state.type === "loading";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDispatch}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "A correr dispatch..." : "Run Auto"}
      </button>

      {state.type !== "idle" ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            state.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : state.type === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}