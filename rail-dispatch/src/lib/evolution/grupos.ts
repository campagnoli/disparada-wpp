import type { ConfiguracaoWhatsApp } from '@/lib/whatsapp-config';

export interface GrupoEvolution {
  id: string;
  subject: string;
  size?: number;
}

export class EvolutionTimeoutError extends Error {
  constructor(
    public readonly recurso: string,
    public readonly timeoutMs: number
  ) {
    super(`Tempo esgotado ao consultar ${recurso} na Evolution API (${Math.round(timeoutMs / 1000)}s).`);
    this.name = 'EvolutionTimeoutError';
  }
}

export class EvolutionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

function lerTimeout(nome: string, padrao: number): number {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

const TIMEOUT_ESTADO_MS = () => lerTimeout('EVOLUTION_STATE_TIMEOUT_MS', 8_000);
const TIMEOUT_GRUPOS_MS = () => lerTimeout('EVOLUTION_GROUPS_TIMEOUT_MS', 30_000);
const CACHE_MS = () => lerTimeout('EVOLUTION_GROUPS_CACHE_MS', 30_000);

interface CacheGrupos {
  grupos: GrupoEvolution[];
  expiraEm: number;
}

const cachePorInstancia = new Map<string, CacheGrupos>();

function ehTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

async function fetchComTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  recurso: string
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error: unknown) {
    if (ehTimeout(error)) throw new EvolutionTimeoutError(recurso, timeoutMs);
    throw error;
  }
}

function parseGroups(data: unknown): GrupoEvolution[] | null {
  const values =
    Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null && 'groups' in data && Array.isArray(data.groups)
        ? data.groups
        : null;

  if (!values) return null;

  return values.flatMap((value): GrupoEvolution[] => {
    if (typeof value !== 'object' || value === null) return [];
    const group = value as { id?: unknown; subject?: unknown; size?: unknown };
    if (typeof group.id !== 'string' || typeof group.subject !== 'string') return [];
    return [
      {
        id: group.id,
        subject: group.subject,
        ...(typeof group.size === 'number' ? { size: group.size } : {}),
      },
    ];
  });
}

async function consultarEstadoInstancia(
  config: ConfiguracaoWhatsApp,
  instance: string
): Promise<void> {
  const stateResponse = await fetchComTimeout(
    `${config.apiUrl}/instance/connectionState/${instance}`,
    { headers: { apikey: config.apiKey }, cache: 'no-store' },
    TIMEOUT_ESTADO_MS(),
    'o estado da instância'
  );

  if (!stateResponse.ok) {
    throw new EvolutionApiError(
      `Falha ao consultar o estado da instância (HTTP ${stateResponse.status}).`,
      502
    );
  }

  const stateData: unknown = await stateResponse.json().catch(() => null);
  const instanceState =
    typeof stateData === 'object' && stateData !== null && 'instance' in stateData
      ? (stateData.instance as { state?: unknown } | null)?.state
      : typeof stateData === 'object' && stateData !== null && 'state' in stateData
        ? stateData.state
        : undefined;

  if (instanceState !== 'open') {
    throw new EvolutionApiError('A instância do WhatsApp está desconectada.', 409);
  }
}

export async function listarGruposEvolution(
  config: ConfiguracaoWhatsApp,
  opcoes: { refresh?: boolean } = {}
): Promise<GrupoEvolution[]> {
  if (!config.apiUrl || !config.apiKey || !config.instanceName) {
    throw new EvolutionApiError(
      'Configure a URL, a chave e o nome da instância da Evolution API.',
      503
    );
  }

  const chaveCache = `${config.apiUrl}|${config.instanceName}`;
  const cache = cachePorInstancia.get(chaveCache);
  if (!opcoes.refresh && cache && cache.expiraEm > Date.now()) {
    return cache.grupos;
  }

  const instance = encodeURIComponent(config.instanceName);
  const headers = { apikey: config.apiKey };

  // Consulta o estado e a lista em paralelo: a lista é o dado principal e
  // não precisa esperar a checagem de conexão terminar.
  const [stateResult, groupsResult] = await Promise.allSettled([
    consultarEstadoInstancia(config, instance),
    fetchComTimeout(
      `${config.apiUrl}/group/fetchAllGroups/${instance}?getParticipants=false`,
      { headers, cache: 'no-store' },
      TIMEOUT_GRUPOS_MS(),
      'a lista de grupos'
    ),
  ]);

  if (groupsResult.status === 'fulfilled') {
    const groupsResponse = groupsResult.value;

    if (!groupsResponse.ok) {
      if (
        stateResult.status === 'rejected' &&
        stateResult.reason instanceof EvolutionApiError &&
        stateResult.reason.status === 409
      ) {
        throw stateResult.reason;
      }
      throw new EvolutionApiError(
        `Falha ao buscar grupos na Evolution API (HTTP ${groupsResponse.status}).`,
        502
      );
    }

    const grupos = parseGroups(await groupsResponse.json().catch(() => null));
    if (!grupos) {
      throw new EvolutionApiError(
        'A Evolution API retornou uma lista de grupos inválida.',
        502
      );
    }

    cachePorInstancia.set(chaveCache, {
      grupos,
      expiraEm: Date.now() + CACHE_MS(),
    });

    return grupos;
  }

  // A lista falhou: prioriza o diagnóstico de conexão, quando disponível.
  if (
    stateResult.status === 'rejected' &&
    stateResult.reason instanceof EvolutionApiError &&
    stateResult.reason.status === 409
  ) {
    throw stateResult.reason;
  }

  throw groupsResult.reason;
}
