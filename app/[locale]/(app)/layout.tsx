import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Sidebar from "../../../components/Sidebar";
import AutoDispatch from "@/components/AutoDispatch";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pt/login");
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <AutoDispatch />

      <Sidebar email={user.email || ""} />

      <main className="flex-1">{children}</main>
    </div>
  );
}