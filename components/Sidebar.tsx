"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase-client";

type SidebarProps = {
  email: string;
};

export default function Sidebar({ email }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "pt";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  }

  return (
    <aside className="w-64 min-h-screen bg-black text-white p-4 border-r border-zinc-800">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Find Dining</h1>
        <p className="text-zinc-500 text-sm">Backoffice restaurante</p>

        <a href={`mailto:${email}`} className="block text-zinc-600 text-xs mt-1">
          {email}
        </a>
      </div>

      <nav className="space-y-3">
        <Link href={`/${locale}/dashboard`} className="block hover:text-white text-zinc-400">
          Dashboard
        </Link>

        <Link href={`/${locale}/projects`} className="block hover:text-white text-zinc-400">
          Restaurantes
        </Link>

        <Link href={`/${locale}/automations`} className="block hover:text-white text-zinc-400">
          Reservas
        </Link>

        <Link href={`/${locale}/leads`} className="block hover:text-white text-zinc-400">
          Clientes
        </Link>

        <Link href={`/${locale}/billing`} className="block hover:text-white text-zinc-400">
          Plano
        </Link>

        <Link href={`/${locale}/settings`} className="block hover:text-white text-zinc-400">
          Definições
        </Link>

        <button
          onClick={handleLogout}
          className="pt-6 text-red-500 cursor-pointer"
        >
          Sair
        </button>
      </nav>
    </aside>
  );
}