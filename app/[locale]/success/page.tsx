"use client";

import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-lg">
        <div className="mb-4 text-4xl">🎉</div>

        <h1 className="mb-2 text-2xl font-semibold">
          Pagamento confirmado
        </h1>

        <p className="mb-6 text-zinc-400">
          Se o webhook já tiver processado, a tua subscrição estará ativa e o
          dashboard vai abrir normalmente.
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.push("/pt/dashboard")}
            className="rounded-lg bg-white px-6 py-2 font-medium text-black transition hover:bg-zinc-200"
          >
            Entrar na app
          </button>

          <button
            onClick={() => router.push("/pt/pricing")}
            className="rounded-lg border border-zinc-700 px-6 py-2 font-medium text-white transition hover:bg-zinc-800"
          >
            Voltar ao pricing
          </button>
        </div>
      </div>
    </div>
  );
}