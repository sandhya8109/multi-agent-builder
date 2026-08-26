'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasSupabaseConfig } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const continueAsGuest = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (hasSupabaseConfig()) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          throw signInError;
        }
      }

      document.cookie = 'demo_session=true; path=/; max-age=86400; sameSite=lax';
      router.replace('/');
      router.refresh();
    } catch (err: any) {
      console.error('Guest login failed:', err);
      document.cookie = 'demo_session=true; path=/; max-age=86400; sameSite=lax';
      router.replace('/');
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-blue-950/40 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workflow Studio</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Sign in</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-300">
          Jump into the builder with a guest session so you can demo workflows, run agents, and review the canvas without manual credentials.
        </p>

        {error ? (
          <div className="mb-4 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={continueAsGuest}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isLoading ? 'Starting demo session...' : 'Guest / Demo Login'}
          {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <div className="mt-6 border-t border-slate-800 pt-5 text-center text-xs text-slate-400">
          Works with anonymous Supabase auth when configured, or falls back to a local demo session for live demos and testing.
        </div>
      </div>
    </main>
  );
}
