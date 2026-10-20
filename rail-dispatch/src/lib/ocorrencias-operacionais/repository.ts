import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizarCronologia } from '@/lib/ocorrencias-operacionais/normalizar';
import type {
  DadosOcorrenciaOperacional,
  MensagemOcorrenciaOperacional,
  OcorrenciaOperacional,
  ResultadoEnvioWhatsApp,
  StatusOcorrenciaOperacional,
  TipoMensagemOcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/types';

const TABELA_OCORRENCIAS = 'ocorrencias_operacionais';
const TABELA_MENSAGENS = 'ocorrencias_operacionais_mensagens';

function erroColunaCodigoEvento(error: { message?: string; code?: string }): boolean {
  if (error.code === '42703') return true;
  const mensagem = error.message ?? '';
  return error.code === 'PGRST204' && /codigo_evento/i.test(mensagem);
}

function mensagemErroBanco(error: { message?: string; code?: string }): string {
  const mensagem = error.message || 'Falha ao acessar o banco de dados.';

  if (
    error.code === 'PGRST204' ||
    /could not find the .* column/i.test(mensagem) ||
    /column .* does not exist/i.test(mensagem)
  ) {
    return 'Estrutura do banco desatualizada para Ocorrências Operacionais. Aplique as migrations 202610170001, 202610170002, 202610200001, 202610200002, 202610200003 e 202610200005 no Supabase.';
  }

  return mensagem;
}

function mapearOcorrencia(row: Record<string, unknown>): OcorrenciaOperacional {
  return {
    id: String(row.id ?? ''),
    codigo_evento: (row.codigo_evento as string | null) ?? null,
    linha: String(row.linha ?? ''),
    tipo_ocorrencia: String(row.tipo_ocorrencia ?? ''),
    local: String(row.local ?? ''),
    horario: String(row.horario ?? ''),
    descritivo: String(row.descritivo ?? ''),
    cronologia: normalizarCronologia(row.cronologia),
    aas_asl: (row.aas_asl as string | null) ?? null,
    cps: (row.cps as string | null) ?? null,
    status: row.status === 'encerrada' ? 'encerrada' : 'em_andamento',
    horario_fim: (row.horario_fim as string | null) ?? null,
    entregue_com_restricao: Boolean(row.entregue_com_restricao),
    descricao_restricao: (row.descricao_restricao as string | null) ?? null,
    relatar_atuacao: Boolean(row.relatar_atuacao),
    descricao_atuacao: (row.descricao_atuacao as string | null) ?? null,
    group_id_whatsapp: String(row.group_id_whatsapp ?? ''),
    mensagem_formatada: (row.mensagem_formatada as string | null) ?? null,
    whatsapp_message_id: (row.whatsapp_message_id as string | null) ?? null,
    whatsapp_remote_jid: (row.whatsapp_remote_jid as string | null) ?? null,
    disparado_whatsapp: Boolean(row.disparado_whatsapp),
    criado_em: String(row.criado_em ?? ''),
    atualizado_em: String(row.atualizado_em ?? ''),
  };
}

function mapearMensagem(row: Record<string, unknown>): MensagemOcorrenciaOperacional {
  return {
    id: String(row.id ?? ''),
    ocorrencia_id: String(row.ocorrencia_id ?? ''),
    tipo: (row.tipo as TipoMensagemOcorrenciaOperacional) ?? 'atualizacao_cronologia',
    mensagem: String(row.mensagem ?? ''),
    cronologia: normalizarCronologia(row.cronologia),
    whatsapp_message_id: (row.whatsapp_message_id as string | null) ?? null,
    whatsapp_remote_jid: (row.whatsapp_remote_jid as string | null) ?? null,
    sucesso: Boolean(row.sucesso),
    erro: (row.erro as string | null) ?? null,
    criado_em: String(row.criado_em ?? ''),
  };
}

export async function listarOcorrenciasOperacionais(opcoes: {
  page: number;
  pageSize: number;
  status: StatusOcorrenciaOperacional | 'todas';
}): Promise<{ ocorrencias: OcorrenciaOperacional[]; total: number }> {
  const adminClient = createSupabaseAdminClient();
  const from = (opcoes.page - 1) * opcoes.pageSize;

  let query = adminClient
    .from(TABELA_OCORRENCIAS)
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, from + opcoes.pageSize - 1);

  if (opcoes.status !== 'todas') {
    query = query.eq('status', opcoes.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(mensagemErroBanco(error));

  return {
    ocorrencias: (data ?? []).map((row) => mapearOcorrencia(row as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function buscarOcorrenciaOperacional(
  id: string
): Promise<OcorrenciaOperacional | null> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from(TABELA_OCORRENCIAS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(mensagemErroBanco(error));
  return data ? mapearOcorrencia(data as Record<string, unknown>) : null;
}

export async function inserirOcorrenciaOperacional(
  dados: DadosOcorrenciaOperacional,
  mensagemFormatada: string
): Promise<OcorrenciaOperacional> {
  const adminClient = createSupabaseAdminClient();
  const agora = new Date().toISOString();

  const payload: Record<string, unknown> = {
    codigo_evento: dados.codigoEvento,
    linha: dados.linha,
    tipo_ocorrencia: dados.tipoOcorrencia,
    local: dados.local,
    horario: dados.horario,
    descritivo: dados.descritivo,
    cronologia: dados.cronologia,
    aas_asl: dados.aasAsl,
    cps: dados.cps,
    status: dados.status,
    horario_fim: dados.horarioFim,
    entregue_com_restricao: dados.entregueComRestricao,
    descricao_restricao: dados.descricaoRestricao,
    relatar_atuacao: dados.relatarAtuacao,
    descricao_atuacao: dados.descricaoAtuacao,
    group_id_whatsapp: dados.groupIdWhatsApp,
    mensagem_formatada: mensagemFormatada,
    disparado_whatsapp: false,
    criado_em: agora,
    atualizado_em: agora,
  };

  let { data, error } = await adminClient
    .from(TABELA_OCORRENCIAS)
    .insert(payload)
    .select('*')
    .single();

  if (error && erroColunaCodigoEvento(error)) {
    // Compatibilidade com ambientes que ainda não aplicaram a migration 005.
    delete payload.codigo_evento;
    ({ data, error } = await adminClient
      .from(TABELA_OCORRENCIAS)
      .insert(payload)
      .select('*')
      .single());
  }

  if (error) throw new Error(mensagemErroBanco(error));
  return mapearOcorrencia(data as Record<string, unknown>);
}

export async function atualizarOcorrenciaOperacional(
  id: string,
  dados: DadosOcorrenciaOperacional,
  mensagemFormatada: string
): Promise<OcorrenciaOperacional> {
  const adminClient = createSupabaseAdminClient();

  const payload: Record<string, unknown> = {
    codigo_evento: dados.codigoEvento,
    linha: dados.linha,
    tipo_ocorrencia: dados.tipoOcorrencia,
    local: dados.local,
    horario: dados.horario,
    descritivo: dados.descritivo,
    cronologia: dados.cronologia,
    aas_asl: dados.aasAsl,
    cps: dados.cps,
    status: dados.status,
    horario_fim: dados.horarioFim,
    entregue_com_restricao: dados.entregueComRestricao,
    descricao_restricao: dados.descricaoRestricao,
    relatar_atuacao: dados.relatarAtuacao,
    descricao_atuacao: dados.descricaoAtuacao,
    group_id_whatsapp: dados.groupIdWhatsApp,
    mensagem_formatada: mensagemFormatada,
    atualizado_em: new Date().toISOString(),
  };

  let { data, error } = await adminClient
    .from(TABELA_OCORRENCIAS)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error && erroColunaCodigoEvento(error)) {
    // Compatibilidade com ambientes que ainda não aplicaram a migration 005.
    delete payload.codigo_evento;
    ({ data, error } = await adminClient
      .from(TABELA_OCORRENCIAS)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single());
  }

  if (error) throw new Error(mensagemErroBanco(error));
  return mapearOcorrencia(data as Record<string, unknown>);
}

export async function persistirResultadoWhatsApp(
  id: string,
  resultado: ResultadoEnvioWhatsApp
): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from(TABELA_OCORRENCIAS)
    .update({
      disparado_whatsapp: resultado.sucesso,
      whatsapp_message_id: resultado.messageId ?? null,
      whatsapp_remote_jid: resultado.remoteJid ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(mensagemErroBanco(error));
}

export async function registrarMensagemEnviada(params: {
  ocorrenciaId: string;
  tipo: TipoMensagemOcorrenciaOperacional;
  mensagem: string;
  cronologia: DadosOcorrenciaOperacional['cronologia'];
  resultado: ResultadoEnvioWhatsApp;
}): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.from(TABELA_MENSAGENS).insert({
    ocorrencia_id: params.ocorrenciaId,
    tipo: params.tipo,
    mensagem: params.mensagem,
    cronologia: params.cronologia,
    whatsapp_message_id: params.resultado.messageId ?? null,
    whatsapp_remote_jid: params.resultado.remoteJid ?? null,
    sucesso: params.resultado.sucesso,
    erro: params.resultado.erro ?? null,
  });

  if (error) throw new Error(mensagemErroBanco(error));
}

export async function listarMensagensEnviadas(
  ocorrenciaId: string
): Promise<MensagemOcorrenciaOperacional[]> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from(TABELA_MENSAGENS)
    .select('*')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('criado_em', { ascending: false });

  if (error) throw new Error(mensagemErroBanco(error));
  return (data ?? []).map((row) => mapearMensagem(row as Record<string, unknown>));
}
