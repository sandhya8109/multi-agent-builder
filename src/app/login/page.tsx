'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Listen for authentication state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/');
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl text-white">
        <h1 className="mb-6 text-center text-2xl font-bold">Multi-Agent Builder</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={['google']}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
        />
      </div>
    </div>
  );
}