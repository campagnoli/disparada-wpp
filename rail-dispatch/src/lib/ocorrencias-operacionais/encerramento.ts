import { getText } from '@/lib/ocorrencias-operacionais/normalizar';
import { OcorrenciasOperacionaisError } from '@/lib/ocorrencias-operacionais/errors';
import {
  atualizarOcorrenciaOperacional,
  buscarOcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/repository';
import { dispararERegistrar, formatarOcorrenciaOperacional } from '@/lib/ocorrencias-operacionais/despacho';
import { obterTemplateEncerramentoOperacional } from '@/lib/ocorrencias-operacionais/templates';
import { salvarAprendizadoOcorrencia } from '@/lib/ocorrencias-operacionais/aprendizado';
import { resolverGroupIdOcorrenciasOperacionais } from '@/lib/ocorrencias-operacionais/whatsapp';
import type {
  DadosOcorrenciaOperacional,
  ResultadoAtualizacaoCronologia,
  ResultadoEnvioWhatsApp,
} from '@/lib/ocorrencias-operacionais/types';

const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

function horarioAtual(): string {
  return new Date().toTimeString().slice(0, 5);
}

export interface PayloadEncerramentoOcorrencia {
  horarioFim?: unknown;
  groupIdWhatsApp?: unknown;
  dispararWhatsApp?: unknown;
  houveEdicaoManual?: unknown;
  entregueComRestricao?: unknown;
  descricaoRestricao?: unknown;
  relatarAtuacao?: unknown;
  descricaoAtuacao?: unknown;
  mensagemFinal?: unknown;
}

/**
 * Encerra (ou atualiza o encerramento de) uma ocorrência operacional.
 *
 * A mensagem final segue o mesmo padrão das ocorrências tradicionais: apenas
 * título, horários, duração, restrição e atuação. A cronologia permanece
 * registrada no histórico, mas não é repetida na mensagem de encerramento.
 */
export async function encerrarOcorrenciaOperacional(
  id: string,
  body: PayloadEncerramentoOcorrencia
): Promise<ResultadoAtualizacaoCronologia> {
  const existente = await buscarOcorrenciaOperacional(id);
  if (!existente) {
    throw new OcorrenciasOperacionaisError('Ocorrência operacional não encontrada.', 404);
  }

  const temCampo = (campo: string) => Object.prototype.hasOwnProperty.call(body, campo);
  const horarioFim = getText(body.horarioFim) || existente.horario_fim || horarioAtual();
  if (!REGEX_HORARIO.test(horarioFim)) {
    throw new OcorrenciasOperacionaisError('Informe um horário de encerramento válido no formato HH:MM.');
  }

  const entregueComRestricao = temCampo('entregueComRestricao')
    ? body.entregueComRestricao === true
    : existente.entregue_com_restricao;
  const descricaoRestricao = temCampo('descricaoRestricao')
    ? getText(body.descricaoRestricao) || null
    : existente.descricao_restricao;
  const relatarAtuacao = temCampo('relatarAtuacao')
    ? body.relatarAtuacao === true
    : existente.relatar_atuacao;
  const descricaoAtuacao = temCampo('descricaoAtuacao')
    ? getText(body.descricaoAtuacao) || null
    : existente.descricao_atuacao;
  const mensagemFinalRecebida = temCampo('mensagemFinal') ? getText(body.mensagemFinal) : '';

  if (temCampo('mensagemFinal') && !mensagemFinalRecebida) {
    throw new OcorrenciasOperacionaisError('A mensagem final não pode ficar vazia.');
  }
  if (mensagemFinalRecebida.length > 5000) {
    throw new OcorrenciasOperacionaisError('A mensagem final deve ter até 5000 caracteres.');
  }

  if (entregueComRestricao && !descricaoRestricao) {
    throw new OcorrenciasOperacionaisError('Descreva a restrição mantida após a ocorrência.');
  }
  if (relatarAtuacao && !descricaoAtuacao) {
    throw new OcorrenciasOperacionaisError('Descreva a atuação realizada.');
  }

  const dados: DadosOcorrenciaOperacional = {
    id,
    codigoEvento: existente.codigo_evento,
    linha: existente.linha,
    tipoOcorrencia: existente.tipo_ocorrencia,
    local: existente.local,
    horario: existente.horario,
    descritivo: existente.descritivo,
    cronologia: existente.cronologia,
    aasAsl: existente.aas_asl,
    cps: existente.cps,
    status: 'encerrada',
    horarioFim,
    entregueComRestricao,
    descricaoRestricao,
    relatarAtuacao,
    descricaoAtuacao,
    groupIdWhatsApp:
      (await resolverGroupIdOcorrenciasOperacionais(getText(body.groupIdWhatsApp))) ||
      existente.group_id_whatsapp,
  };

  const templateEncerramento = await obterTemplateEncerramentoOperacional();
  const mensagemFormatada = mensagemFinalRecebida
    || formatarOcorrenciaOperacional(dados, templateEncerramento);
  const ocorrencia = await atualizarOcorrenciaOperacional(id, dados, mensagemFormatada);

  const disparar = body.dispararWhatsApp !== false;
  let whatsapp: ResultadoEnvioWhatsApp = {
    sucesso: false,
    erro: 'Disparo não solicitado.',
  };

  if (disparar) {
    whatsapp = await dispararERegistrar({
      ocorrenciaId: id,
      dados,
      mensagemFormatada,
      tipo: 'encerramento',
    });
  }

  if (body.houveEdicaoManual === true) {
    await salvarAprendizadoOcorrencia(dados, mensagemFormatada);
  }

  return { ocorrencia, mensagemFormatada, whatsapp };
}
