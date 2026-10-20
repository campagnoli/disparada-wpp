'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  LoaderCircle,
  QrCode,
  Search,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';

type ConnectionState = 'checking' | 'connecting' | 'open' | 'disconnected';

interface WhatsAppGroup {
  id: string;
  subject: string;
  size?: number;
}

interface ConnectionResponse {
  state?: 'open' | 'connecting' | 'close';
  connected?: boolean;
  qrcode?: string;
  pairingCode?: string | null;
  error?: string;
}

async function requestConnection(method: 'GET' | 'DELETE' = 'GET'): Promise<ConnectionResponse> {
  const response = await fetch('/api/whatsapp/connect', { method, cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as ConnectionResponse | null;

  if (!response.ok) {
    throw new Error(data?.error || 'Não foi possível consultar a conexão do WhatsApp.');
  }
  return data ?? {};
}

export default function WhatsAppConnectionModal() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);

  const connected = state === 'open';

  const checkConnection = useCallback(async () => {
    try {
      const data = await requestConnection();
      if (data.connected && data.state === 'open') {
        setState('open');
        setQrcode(null);
        setPairingCode(null);
        setSuccess(true);
        setModalOpen(false);
        return;
      }

      if (data.state === 'connecting' && data.qrcode) {
        setState('connecting');
        setQrcode(data.qrcode);
        setPairingCode(data.pairingCode ?? null);
      }
      setError('');
    } catch (requestError: unknown) {
      setState((current) => current === 'checking' ? 'disconnected' : current);
      setError(requestError instanceof Error ? requestError.message : 'Falha ao consultar a conexão.');
    }
  }, []);

  useEffect(() => {
    if (!connected) return;

    const controller = new AbortController();
    const loadGroups = async () => {
      setGroups([]);
      setGroupsLoading(true);
      setGroupsError('');
      setGroupSearch('');
      setCopiedGroupId(null);
      try {
        const url = groupsRefreshKey > 0 ? '/api/whatsapp/groups?refresh=1' : '/api/whatsapp/groups';
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message = response.headers.get('X-Error-Message');
          throw new Error(message || (response.status === 409
            ? 'A instância do WhatsApp está desconectada.'
            : 'Não foi possível carregar os grupos do WhatsApp.'));
        }
        if (!Array.isArray(data)) {
          throw new Error('A resposta da API de grupos está em formato inválido.');
        }

        setGroups(data.flatMap((value): WhatsAppGroup[] => {
          if (typeof value !== 'object' || value === null) return [];
          const group = value as { id?: unknown; subject?: unknown; size?: unknown };
          if (typeof group.id !== 'string' || typeof group.subject !== 'string') return [];
          return [{
            id: group.id,
            subject: group.subject,
            ...(typeof group.size === 'number' ? { size: group.size } : {}),
          }];
        }));
      } catch (requestError: unknown) {
        if (controller.signal.aborted) return;
        setGroupsError(requestError instanceof Error ? requestError.message : 'Falha ao carregar os grupos.');
      } finally {
        if (!controller.signal.aborted) setGroupsLoading(false);
      }
    };

    void loadGroups();
    return () => controller.abort();
  }, [connected, groupsRefreshKey]);

  useEffect(() => {
    if (!copiedGroupId) return;
    const timeout = window.setTimeout(() => setCopiedGroupId(null), 2_000);
    return () => window.clearTimeout(timeout);
  }, [copiedGroupId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void checkConnection(), 0);
    return () => window.clearTimeout(timeout);
  }, [checkConnection]);

  useEffect(() => {
    if (!modalOpen || state !== 'connecting') return;

    let requestInProgress = false;
    const interval = window.setInterval(async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      try {
        await checkConnection();
      } finally {
        requestInProgress = false;
      }
    }, 4_000);

    return () => window.clearInterval(interval);
  }, [checkConnection, modalOpen, state]);

  useEffect(() => {
    if (!modalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const generateQrCode = async () => {
    setError('');
    setSuccess(false);
    setLoading(true);
    setModalOpen(true);

    try {
      const data = await requestConnection();
      if (data.connected && data.state === 'open') {
        setState('open');
        setQrcode(null);
        setPairingCode(null);
        setSuccess(true);
        setModalOpen(false);
        return;
      }
      if (data.state !== 'connecting' || !data.qrcode) {
        throw new Error('A Evolution API não retornou um QR Code válido.');
      }

      setQrcode(data.qrcode);
      setPairingCode(data.pairingCode ?? null);
      setState('connecting');
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar o QR Code.');
      setState('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Deseja desconectar esta instância do WhatsApp para trocar o aparelho?')) return;

    setDisconnecting(true);
    setError('');
    setSuccess(false);
    try {
      await requestConnection('DELETE');
      setState('disconnected');
      setQrcode(null);
      setPairingCode(null);
      setGroups([]);
      setGroupSearch('');
      setCopiedGroupId(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao desconectar o WhatsApp.');
    } finally {
      setDisconnecting(false);
    }
  };

  const copyGroupId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedGroupId(id);
      setGroupsError('');
    } catch (copyError: unknown) {
      setGroupsError(copyError instanceof Error
        ? `Não foi possível copiar o ID: ${copyError.message}`
        : 'Não foi possível copiar o ID do grupo.');
    }
  };

  const canShowQr = state === 'connecting' && qrcode && !loading;
  const filteredGroups = groups.filter((group) =>
    group.subject.toLocaleLowerCase('pt-BR').includes(groupSearch.trim().toLocaleLowerCase('pt-BR'))
  );

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
              connected ? 'bg-emerald-500' : state === 'checking' ? 'animate-pulse bg-slate-400' : 'bg-amber-500'
            }`}
            aria-hidden="true"
          />
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {connected ? 'Conectado' : state === 'checking' ? 'Verificando conexão...' : 'Desconectado'}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {connected
                ? 'A instância CCO está ativa e pronta para uso.'
                : 'Conecte ou troque o aparelho vinculado à instância CCO.'}
            </p>
            {success && connected && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700" role="status">
                <CheckCircle2 className="h-4 w-4" />
                Instância CCO conectada com sucesso!
              </p>
            )}
            {error && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        </div>

        {connected ? (
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={disconnecting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disconnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            {disconnecting ? 'Desconectando...' : 'Desconectar / Trocar Aparelho'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void generateQrCode()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {loading ? 'Gerando QR Code...' : canShowQr ? 'Exibir QR Code' : 'Gerar QR Code'}
          </button>
        )}
      </section>

      {connected && (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-safira" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">Grupos participantes</h4>
                <p className="text-xs text-slate-500">
                  {groupsLoading ? 'Carregando grupos...' : `${groups.length} grupos encontrados`}
                </p>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:max-w-md">
              <label className="relative block w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder="Filtrar pelo nome do grupo"
                  aria-label="Filtrar grupos pelo nome"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-safira focus:ring-2 focus:ring-safira/15"
                />
              </label>
              <button
                type="button"
                onClick={() => setGroupsRefreshKey((prev) => prev + 1)}
                disabled={groupsLoading}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-safira hover:text-safira disabled:opacity-50"
                title="Recarregar a lista de grupos"
              >
                <LoaderCircle className={`h-3.5 w-3.5 ${groupsLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {groupsError && (
            <p className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {groupsError}
            </p>
          )}

          {groupsLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin text-safira" />
              Carregando grupos do WhatsApp...
            </div>
          ) : groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nenhum grupo disponível para esta instância.
            </p>
          ) : filteredGroups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nenhum grupo corresponde à busca.
            </p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Nome do grupo</th>
                    <th scope="col" className="px-4 py-3 font-semibold">ID do grupo (JID)</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGroups.map((group) => (
                    <tr key={group.id} className="hover:bg-slate-50">
                      <th scope="row" className="max-w-56 px-4 py-3 font-medium text-slate-800">
                        <span className="block truncate" title={group.subject}>{group.subject}</span>
                        {typeof group.size === 'number' && (
                          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                            {group.size} participantes
                          </span>
                        )}
                      </th>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        <span className="break-all">{group.id}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void copyGroupId(group.id)}
                          aria-label={`${copiedGroupId === group.id ? 'ID copiado' : 'Copiar ID do grupo'} ${group.subject}`}
                          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 transition hover:border-safira hover:text-safira"
                        >
                          {copiedGroupId === group.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                            : <Copy className="h-3.5 w-3.5" />}
                          {copiedGroupId === group.id ? 'Copiado!' : 'Copiar ID'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-qr-title"
            className="relative w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl"
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Fechar"
              className="absolute right-3 top-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            {connected ? (
              <div className="py-8">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h3 id="whatsapp-qr-title" className="mt-4 text-lg font-bold text-emerald-800">
                  Instância CCO conectada com sucesso!
                </h3>
              </div>
            ) : (
              <>
                <h3 id="whatsapp-qr-title" className="text-lg font-bold text-slate-900">
                  Conectar WhatsApp do CCO
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Abra o WhatsApp no aparelho e leia este QR Code em <strong>Aparelhos conectados</strong>.
                </p>

                {canShowQr ? (
                  <Image
                    src={qrcode}
                    alt="QR Code para conectar o WhatsApp à instância CCO"
                    width={256}
                    height={256}
                    unoptimized
                    className="mx-auto mt-5 aspect-square w-64 rounded-lg border border-slate-200 bg-white p-2"
                  />
                ) : (
                  <div className="mx-auto mt-8 flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 text-slate-600">
                    <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="text-sm">Gerando QR Code...</span>
                  </div>
                )}

                {pairingCode && (
                  <p className="mt-4 text-sm text-slate-700">
                    Código de pareamento: <strong className="font-mono">{pairingCode}</strong>
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-500">Verificando o estado da conexão a cada 4 segundos.</p>
                {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
