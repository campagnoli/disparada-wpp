'use client';

import { useEffect, useState } from 'react';
import { LogOut, Plus, Trash2 } from 'lucide-react';

export interface FalhaPredefinida {
  id: number;
  descricao: string;
  impacto: string;
  ordem: number;
}

interface AdminFalhasProps {
  falhas: FalhaPredefinida[];
  onFalhasAtualizadas: () => Promise<void>;
}

export default function AdminFalhas({ falhas, onFalhasAtualizadas }: AdminFalhasProps) {
  const [autenticado, setAutenticado] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [senha, setSenha] = useState('');
  const [novaFalha, setNovaFalha] = useState('');
  const [novoImpacto, setNovoImpacto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [edicoes, setEdicoes] = useState<Record<number, { descricao: string; impacto: string }>>({});
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const verificarSessao = async () => {
      try {
        const response = await fetch('/api/admin/session', { cache: 'no-store' });
        const data = (await response.json()) as { authenticated?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || 'Não foi possível verificar o acesso.');
        setAutenticado(data.authenticated === true);
      } catch (error: unknown) {
        setErro(error instanceof Error ? error.message : 'Não foi possível verificar o acesso.');
      } finally {
        setVerificandoSessao(false);
      }
    };

    void verificarSessao();
  }, []);

  const entrar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: senha }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
      setSenha('');
      setAutenticado(true);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setSalvando(false);
    }
  };

  const sair = async () => {
    setErro('');
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
      setAutenticado(false);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.');
    }
  };

  const adicionarFalha = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/falhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: novaFalha, impacto: novoImpacto }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível adicionar a opção.');
      setNovaFalha('');
      setNovoImpacto('');
      setAviso('Opção adicionada.');
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível adicionar a opção.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarFalha = async (falha: FalhaPredefinida) => {
    const edicao = edicoes[falha.id] ?? { descricao: falha.descricao, impacto: falha.impacto };
    setSalvandoId(falha.id);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/falhas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: falha.id, ...edicao }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a opção.');
      setEdicoes((anteriores) => {
        const proximas = { ...anteriores };
        delete proximas[falha.id];
        return proximas;
      });
      setAviso('Opção atualizada.');
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível atualizar a opção.');
    } finally {
      setSalvandoId(null);
    }
  };

  const removerFalha = async (falha: FalhaPredefinida) => {
    if (!window.confirm(`Remover a opção "${falha.descricao}"?`)) return;
    setErro('');
    setAviso('');

    try {
      const response = await fetch(`/api/admin/falhas?id=${falha.id}`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível remover a opção.');
      setAviso('Opção removida.');
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Não foi possível remover a opção.');
    }
  };

  if (verificandoSessao) {
    return <p className="card p-4 text-sm text-slate-600">Verificando acesso administrativo...</p>;
  }

  return (
    <section className="card p-4" aria-label="Administração das opções de falha">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Opções predefinidas de falha</h2>
          <p className="mt-1 text-sm text-slate-600">
            As opções cadastradas ficam disponíveis para todos os usuários.
          </p>
        </div>
        {autenticado && (
          <button type="button" onClick={() => void sair()} className="btn btn-secondary btn-sm">
            <LogOut className="h-4 w-4" />
            Sair da administração
          </button>
        )}
      </div>

      {erro && <p className="mb-4 text-sm text-rose-700" role="alert">{erro}</p>}
      {aviso && <p className="mb-4 text-sm text-emerald-700" role="status">{aviso}</p>}

      {!autenticado ? (
        <form onSubmit={entrar} className="max-w-md space-y-3">
          <div>
            <label htmlFor="senha-admin" className="form-label block">Senha de administrador</label>
            <input
              id="senha-admin"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full form-control"
            />
          </div>
          <button type="submit" disabled={salvando} className="btn btn-safira disabled:opacity-50">
            {salvando ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={adicionarFalha} className="mb-6 space-y-3">
            <div>
              <label htmlFor="nova-falha" className="form-label block">Nova opção de falha</label>
              <input
                id="nova-falha"
                required
                maxLength={120}
                value={novaFalha}
                onChange={(event) => setNovaFalha(event.target.value)}
                placeholder="Ex.: Falha de sinalização"
                className="w-full form-control"
              />
            </div>
            <div>
              <label htmlFor="novo-impacto" className="form-label block">Impacto inicial padrão</label>
              <textarea
                id="novo-impacto"
                required
                maxLength={500}
                rows={2}
                value={novoImpacto}
                onChange={(event) => setNovoImpacto(event.target.value)}
                placeholder="Ex.: Devido ao alagamento, os trens estão circulando com velocidade reduzida."
                className="w-full form-control"
              />
            </div>
            <button type="submit" disabled={salvando} className="btn btn-safira disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Adicionar falha e impacto
            </button>
          </form>

          <ul className="space-y-3">
            {falhas.map((falha) => (
              <li key={falha.id} className="rounded-md border border-slate-200 p-3">
                <div className="mb-3">
                  <label htmlFor={`falha-desc-${falha.id}`} className="form-label block">Falha</label>
                  <input
                    id={`falha-desc-${falha.id}`}
                    required
                    maxLength={120}
                    value={edicoes[falha.id]?.descricao ?? falha.descricao}
                    onChange={(event) => setEdicoes((anteriores) => ({
                      ...anteriores,
                      [falha.id]: {
                        descricao: event.target.value,
                        impacto: anteriores[falha.id]?.impacto ?? falha.impacto,
                      },
                    }))}
                    className="w-full form-control"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor={`falha-impacto-${falha.id}`} className="form-label block">Impacto inicial padrão</label>
                  <textarea
                    id={`falha-impacto-${falha.id}`}
                    required
                    maxLength={500}
                    rows={2}
                    value={edicoes[falha.id]?.impacto ?? falha.impacto}
                    onChange={(event) => setEdicoes((anteriores) => ({
                      ...anteriores,
                      [falha.id]: {
                        descricao: anteriores[falha.id]?.descricao ?? falha.descricao,
                        impacto: event.target.value,
                      },
                    }))}
                    className="w-full form-control"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={salvando || salvandoId !== null}
                    onClick={() => void salvarFalha(falha)}
                    className="btn btn-safira btn-sm disabled:opacity-50"
                  >
                    {salvandoId === falha.id ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  <button
                    type="button"
                    disabled={salvando || salvandoId !== null}
                    onClick={() => void removerFalha(falha)}
                    aria-label={`Remover ${falha.descricao}`}
                    className="btn btn-secondary btn-sm text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
