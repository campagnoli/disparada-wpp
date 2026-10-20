import {
  getText,
  isRecord,
  normalizarCronologia,
  normalizarDadosOcorrencia,
  validarDadosObrigatorios,
} from '@/lib/ocorrencias-operacionais/normalizar';
import {
  atualizarOcorrenciaOperacional,
  buscarOcorrenciaOperacional,
  inserirOcorrenciaOperacional,
  listarMensagensEnviadas,
} from '@/lib/ocorrencias-operacionais/repository';
import { resolverGroupIdOcorrenciasOperacionais } from '@/lib/ocorrencias-operacionais/whatsapp';
import { dispararERegistrar, formatarOcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/despacho';
import { obterTemplateEncerramentoOperacional } from '@/lib/ocorrencias-operacionais/templates';
import { salvarAprendizadoOcorrencia } from '@/lib/ocorrencias-operacionais/aprendizado';
import { OcorrenciasOperacionaisError } from '@/lib/ocorrencias-operacionais/errors';
import type {
  DadosOcorrenciaOperacional,
  MensagemOcorrenciaOperacional,
  OcorrenciaOperacional,
  ResultadoEnvioWhatsApp,
  ResultadoSalvamentoOcorrenciaOperacional,
  ResultadoAtualizacaoCronologia,
} from '@/lib/ocorrencias-operacionais/types';

export { OcorrenciasOperacionaisError } from '@/lib/ocorrencias-operacionais/errors';

export async function salvarOcorrenciaOperacional(
  body: Record<string, unknown>,
  opcoes: { dispararWhatsApp: boolean; houveEdicaoManual: boolean }
): Promise<ResultadoSalvamentoOcorrenciaOperacional> {
  let dados = normalizarDadosOcorrencia(body);
  dados.groupIdWhatsApp = await resolverGroupIdOcorrenciasOperacionais(dados.groupIdWhatsApp);
  const temCampo = (campo: string) => Object.prototype.hasOwnProperty.call(body, campo);

  // Em atualizações, preserva os campos que não foram enviados pelo cliente.
  // Ocorrências encerradas só podem ser alteradas pela ação de encerramento.
  if (dados.id) {
    const existente = await buscarOcorrenciaOperacional(dados.id);
    if (!existente) {
      throw new OcorrenciasOperacionaisError('Ocorrência operacional não encontrada.', 404);
    }
    if (existente.status === 'encerrada') {
      throw new OcorrenciasOperacionaisError(
        'A ocorrência já está encerrada. Atualize o encerramento pela ação específica.',
        409
      );
    }
    dados = {
      ...dados,
      codigoEvento: temCampo('codigoEvento') ? dados.codigoEvento : existente.codigo_evento,
      linha: dados.linha || existente.linha,
      tipoOcorrencia: dados.tipoOcorrencia || existente.tipo_ocorrencia,
      local: dados.local || existente.local,
      horario: dados.horario || existente.horario,
      descritivo: dados.descritivo || existente.descritivo,
      cronologia: dados.cronologia.length > 0 ? dados.cronologia : existente.cronologia,
      aasAsl: temCampo('aasAsl') ? dados.aasAsl : existente.aas_asl,
      cps: temCampo('cps') ? dados.cps : existente.cps,
      status: getText(body.status) ? dados.status : existente.status,
      horarioFim: temCampo('horarioFim') ? dados.horarioFim : existente.horario_fim,
      entregueComRestricao: temCampo('entregueComRestricao')
        ? dados.entregueComRestricao
        : existente.entregue_com_restricao,
      descricaoRestricao: temCampo('descricaoRestricao')
        ? dados.descricaoRestricao
        : existente.descricao_restricao,
      relatarAtuacao: temCampo('relatarAtuacao') ? dados.relatarAtuacao : existente.relatar_atuacao,
      descricaoAtuacao: temCampo('descricaoAtuacao')
        ? dados.descricaoAtuacao
        : existente.descricao_atuacao,
      groupIdWhatsApp: dados.groupIdWhatsApp || existente.group_id_whatsapp,
    };
  }

  if (dados.status === 'encerrada' && !dados.horarioFim) {
    dados.horarioFim = new Date().toTimeString().slice(0, 5);
  }

  const erroValidacao = validarDadosObrigatorios(dados, { exigirCamposCompletos: false });
  if (erroValidacao) throw new OcorrenciasOperacionaisError(erroValidacao);

  const templateEncerramento =
    dados.status === 'encerrada' ? await obterTemplateEncerramentoOperacional() : undefined;
  const mensagemFormatada = formatarOcorrenciaOperacional(dados, templateEncerramento);

  const ocorrencia = dados.id
    ? await atualizarOcorrenciaOperacional(dados.id, dados, mensagemFormatada)
    : await inserirOcorrenciaOperacional(dados, mensagemFormatada);

  let whatsapp: ResultadoEnvioWhatsApp = { sucesso: false, erro: 'Disparo não solicitado.' };
  if (opcoes.dispararWhatsApp) {
    whatsapp = await dispararERegistrar({
      ocorrenciaId: ocorrencia.id,
      dados,
      mensagemFormatada,
      tipo: dados.id
        ? dados.status === 'encerrada'
          ? 'encerramento'
          : 'atualizacao_cronologia'
        : 'criacao',
    });
  }

  if (opcoes.houveEdicaoManual) {
    await salvarAprendizadoOcorrencia(dados, mensagemFormatada);
  }

  return { id: ocorrencia.id, mensagemFormatada, whatsapp };
}

export async function atualizarCronologiaEEnviar(
  id: string,
  body: Record<string, unknown>
): Promise<ResultadoAtualizacaoCronologia> {
  const existente = await buscarOcorrenciaOperacional(id);
  if (!existente) {
    throw new OcorrenciasOperacionaisError('Ocorrência operacional não encontrada.', 404);
  }
  if (existente.status === 'encerrada') {
    throw new OcorrenciasOperacionaisError(
      'A ocorrência já está encerrada. Atualize o encerramento pela ação específica.',
      409
    );
  }
  if (getText(body.status) === 'encerrada') {
    throw new OcorrenciasOperacionaisError(
      'Use a ação de encerramento para encerrar a ocorrência.',
      400
    );
  }

  const cronologiaRecebida = normalizarCronologia(body.cronologia);
  const cronologia = cronologiaRecebida.length > 0 ? cronologiaRecebida : existente.cronologia;
  const temCampo = (campo: string) => Object.prototype.hasOwnProperty.call(body, campo);

  const dados: DadosOcorrenciaOperacional = {
    id,
    codigoEvento: existente.codigo_evento,
    linha: getText(body.linha) || existente.linha,
    tipoOcorrencia: getText(body.tipoOcorrencia) || existente.tipo_ocorrencia,
    local: getText(body.local) || existente.local,
    horario: getText(body.horario) || existente.horario,
    descritivo: getText(body.descritivo) || existente.descritivo,
    cronologia,
    aasAsl: temCampo('aasAsl') ? getText(body.aasAsl) || null : existente.aas_asl,
    cps: temCampo('cps') ? getText(body.cps) || null : existente.cps,
    status: existente.status,
    horarioFim: existente.horario_fim,
    entregueComRestricao: existente.entregue_com_restricao,
    descricaoRestricao: existente.descricao_restricao,
    relatarAtuacao: existente.relatar_atuacao,
    descricaoAtuacao: existente.descricao_atuacao,
    groupIdWhatsApp:
      (await resolverGroupIdOcorrenciasOperacionais(getText(body.groupIdWhatsApp))) ||
      existente.group_id_whatsapp,
  };

  const mensagemFormatada = formatarOcorrenciaOperacional(dados);
  const ocorrencia = await atualizarOcorrenciaOperacional(id, dados, mensagemFormatada);

  const disparar = body.dispararWhatsApp !== false;
  let whatsapp: ResultadoEnvioWhatsApp = { sucesso: false, erro: 'Disparo não solicitado.' };
  if (disparar) {
    whatsapp = await dispararERegistrar({
      ocorrenciaId: id,
      dados,
      mensagemFormatada,
      tipo: 'atualizacao_cronologia',
    });
  }

  if (body.houveEdicaoManual === true) {
    await salvarAprendizadoOcorrencia(dados, mensagemFormatada);
  }

  return { ocorrencia, mensagemFormatada, whatsapp };
}

export async function obterDetalheOcorrenciaOperacional(id: string): Promise<{
  ocorrencia: OcorrenciaOperacional;
  mensagens: MensagemOcorrenciaOperacional[];
}> {
  const ocorrencia = await buscarOcorrenciaOperacional(id);
  if (!ocorrencia) {
    throw new OcorrenciasOperacionaisError('Ocorrência operacional não encontrada.', 404);
  }

  const mensagens = await listarMensagensEnviadas(id);

  // Compatibilidade com ocorrências criadas antes do histórico dedicado:
  // exibe a última mensagem persistida na própria ocorrência.
  if (mensagens.length === 0 && ocorrencia.mensagem_formatada) {
    mensagens.push({
      id: `legado-${ocorrencia.id}`,
      ocorrencia_id: ocorrencia.id,
      tipo: 'criacao',
      mensagem: ocorrencia.mensagem_formatada,
      cronologia: ocorrencia.cronologia,
      whatsapp_message_id: ocorrencia.whatsapp_message_id,
      whatsapp_remote_jid: ocorrencia.whatsapp_remote_jid,
      sucesso: ocorrencia.disparado_whatsapp,
      erro: null,
      criado_em: ocorrencia.atualizado_em || ocorrencia.criado_em,
    });
  }

  return { ocorrencia, mensagens };
}

/**
 * Converte o erro do serviço em uma resposta JSON padronizada.
 */
export function respostaErroOcorrencia(error: unknown) {
  if (error instanceof OcorrenciasOperacionaisError) {
    return { error: error.message, status: error.status };
  }

  if (error instanceof Error && error.message.startsWith('Estrutura do banco desatualizada')) {
    return { error: error.message, status: 503 };
  }

  console.error('Erro inesperado em ocorrências operacionais:', error);
  return { error: 'Falha inesperada ao processar a ocorrência operacional.', status: 500 };
}

export function lerCorpo(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new OcorrenciasOperacionaisError('Dados inválidos.', 400);
  }
  return body;
}
