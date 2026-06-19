"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-client";

type SidebarProps = {
  email: string;
};

export default function Sidebar({ email }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "pt";

  const navigation = [
    { label: "Dashboard", href: `/${locale}/business/dashboard` },
    { label: "Restaurants", href: `/${locale}/business/restaurants` },
    { label: "Reservations", href: `/${locale}/business/reservations` },
    { label: "Guests", href: `/${locale}/business/guests` },
    { label: "Experiences", href: `/${locale}/business/experiences` },
    { label: "Channels", href: `/${locale}/business/channels` },
    { label: "Plan", href: `/${locale}/billing` },
    { label: "Settings", href: `/${locale}/business/settings` },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  }

  return (
    <aside className="min-h-screen w-64 border-r border-zinc-800 bg-black p-4 text-white">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Find Dining</h1>
        <p className="text-sm text-zinc-500">Restaurant platform</p>

        <a href={`mailto:${email}`} className="mt-1 block text-xs text-zinc-600">
          {email}
        </a>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className="px-3 pt-6 text-red-500 cursor-pointer"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}
