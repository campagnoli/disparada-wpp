'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';

const LOGIN_ERROR_MESSAGE =
  'Senha operacional incorreta. Em caso de dúvidas, consulte a supervisão do CCO.';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError(LOGIN_ERROR_MESSAGE);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError(LOGIN_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl bg-safira text-white">
          <LockKeyhole aria-hidden="true" size={22} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Acesso Operacional - CCO Despacho
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Informe a senha operacional para acessar o painel.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-200"
              htmlFor="operational-password"
            >
              Senha Operacional
            </label>
            <div className="relative">
              <input
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-3 pr-12 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-safira focus:ring-2 focus:ring-safira/40"
                id="operational-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safira"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" size={19} />
                ) : (
                  <Eye aria-hidden="true" size={19} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              aria-live="polite"
              className="rounded-lg border border-red-500/40 bg-red-950/60 px-3.5 py-3 text-sm leading-5 text-red-200"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-safira px-4 py-3 text-sm font-semibold text-white transition hover:bg-safira-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safira disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading && <Loader2 aria-hidden="true" className="animate-spin" size={17} />}
            {loading ? 'Validando acesso...' : 'Acessar painel'}
          </button>
        </form>
      </section>
    </main>
  );
}
