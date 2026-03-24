'use client';

import {useState} from 'react';
import {supabase} from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    const {error} = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Conta criada com sucesso. Verifica o teu email.');
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 p-8">
        <h1 className="text-3xl font-bold mb-6">Create account</h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black"
          >
            Create account
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-gray-300">{message}</p>
        )}
      </div>
    </main>
  );
}