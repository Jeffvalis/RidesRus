'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError, LoginBody } from '@ridesrus/core';
import { Bus } from 'lucide-react';
import { useSession } from '@/lib/session';

export default function Login() {
  const { api, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    api.get<{ demoMode: boolean }>('/config').then((c) => setDemo(c.demoMode)).catch(() => undefined);
  }, [api]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = LoginBody.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError(null);
    try {
      signIn(await api.post('/auth/admin/login', parsed.data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl border border-line bg-panel p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-yellow">
            <Bus className="size-6 text-brand-yellow-ink" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Fleet HQ</h1>
            <p className="text-sm text-ink-muted">RidesRus operations</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink outline-none focus:border-brand-yellow" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink outline-none focus:border-brand-yellow" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-brand-yellow py-3 font-extrabold text-brand-yellow-ink transition hover:brightness-95 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {demo && <p className="text-center text-xs text-ink-muted">Demo: admin@ridesrus.app / fleet-hq-demo</p>}
      </form>
    </main>
  );
}
