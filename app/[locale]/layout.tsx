'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function LocaleLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/en/login');
        return;
      }

      setEmail(session.user.email || '');
      setLoading(false);
    }

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        A carregar...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar email={email} />
      <section className="flex-1 p-10">
        {children}
      </section>
    </main>
  );
}