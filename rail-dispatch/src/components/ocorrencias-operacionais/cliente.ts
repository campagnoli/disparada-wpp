import type { ItemCronologia } from '@/lib/formatadores/ocorrenciaOperacional';
import type {
  MensagemOcorrenciaOperacional,
  OcorrenciaOperacional,
  ResultadoEnvioWhatsApp,
} from '@/lib/ocorrencias-operacionais/types';

export type FiltroStatusOcorrencias = 'em_andamento' | 'encerrada' | 'todas';

export interface RespostaListaOcorrencias {
  ocorrencias?: OcorrenciaOperacional[];
  total?: number;
  error?: string;
}

export interface RespostaDetalheOcorrencia {
  ocorrencia?: OcorrenciaOperacional;
  mensagens?: MensagemOcorrenciaOperacional[];
  error?: string;
}

export interface RespostaAtualizacaoOcorrencia {
  sucesso?: boolean;
  ocorrencia?: OcorrenciaOperacional;
  mensagemFormatada?: string;
  whatsapp?: ResultadoEnvioWhatsApp;
  error?: string;
}

export interface PayloadEncerramento {
  horarioFim: string;
  entregueComRestricao: boolean;
  descricaoRestricao: string;
  relatarAtuacao: boolean;
  descricaoAtuacao: string;
  mensagemFinal?: string;
  dispararWhatsApp: boolean;
}

async function lerResposta<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

export async function listarOcorrenciasOperacionais(
  status: FiltroStatusOcorrencias,
  page = 1,
  pageSize = 50
): Promise<RespostaListaOcorrencias> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
  });

  const response = await fetch(`/api/ocorrencias-operacionais?${params.toString()}`, {
    cache: 'no-store',
  });
  const data = await lerResposta<RespostaListaOcorrencias>(response);

  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao carregar as ocorrências operacionais.');
  }

  return data ?? {};
}

export async function obterDetalheOcorrenciaOperacional(
  id: string
): Promise<RespostaDetalheOcorrencia> {
  const response = await fetch(`/api/ocorrencias-operacionais/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  const data = await lerResposta<RespostaDetalheOcorrencia>(response);

  if (!response.ok || !data?.ocorrencia) {
    throw new Error(data?.error || 'Falha ao carregar o detalhe da ocorrência operacional.');
  }

  return data;
}

export async function salvarCronologiaOcorrencia(
  id: string,
  cronologia: ItemCronologia[],
  aasAsl: string,
  cps: string,
  dispararWhatsApp: boolean
): Promise<RespostaAtualizacaoOcorrencia> {
  const response = await fetch(
    `/api/ocorrencias-operacionais/${encodeURIComponent(id)}/mensagens`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cronologia,
        aasAsl,
        cps,
        dispararWhatsApp,
        houveEdicaoManual: true,
      }),
    }
  );
  const data = await lerResposta<RespostaAtualizacaoOcorrencia>(response);

  if (!response.ok || !data?.ocorrencia) {
    throw new Error(data?.error || 'Falha ao atualizar a cronologia da ocorrência.');
  }

  return data;
}

export async function encerrarOcorrencia(
  id: string,
  payload: PayloadEncerramento
): Promise<RespostaAtualizacaoOcorrencia> {
  const response = await fetch(
    `/api/ocorrencias-operacionais/${encodeURIComponent(id)}/encerrar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        houveEdicaoManual: true,
      }),
    }
  );
  const data = await lerResposta<RespostaAtualizacaoOcorrencia>(response);

  if (!response.ok || !data?.ocorrencia) {
    throw new Error(data?.error || 'Falha ao encerrar a ocorrência operacional.');
  }

  return data;
}
