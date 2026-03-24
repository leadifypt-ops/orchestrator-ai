'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SidebarProps = {
  email: string;
};

export default function Sidebar({ email }: SidebarProps) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/en/login');
  }

  return (
    <aside className="flex h-screen w-72 flex-col justify-between border-r border-white/10 bg-[#0a0a0a] p-6 text-white">
      
      <div>
        <div className="mb-10">
          <h1 className="text-2xl font-bold">Orchestra AI</h1>
          <p className="mt-2 text-sm text-gray-400">
            AI automation platform
          </p>
        </div>

        <nav className="space-y-2">

          <Link
            href="/en/dashboard"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Dashboard
          </Link>

          <Link
            href="/en/projects"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Projects
          </Link>

          <Link
            href="/en/agents"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Agents
          </Link>

          <Link
            href="/en/automations"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Automations
          </Link>

          <Link
            href="/en/billing"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Billing
          </Link>

          <Link
            href="/en/settings"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Settings
          </Link>

        </nav>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-400">Logged in as</p>
          <p className="mt-1 break-all text-sm text-white">{email}</p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:opacity-90"
        >
          Logout
        </button>
      </div>

    </aside>
  );
}