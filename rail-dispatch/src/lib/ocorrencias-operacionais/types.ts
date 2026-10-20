import type { ItemCronologia } from '@/lib/formatadores/ocorrenciaOperacional';

export type StatusOcorrenciaOperacional = 'em_andamento' | 'encerrada';

export type TipoMensagemOcorrenciaOperacional =
  | 'criacao'
  | 'atualizacao_cronologia'
  | 'encerramento';

export interface OcorrenciaOperacional {
  id: string;
  codigo_evento: string | null;
  linha: string;
  tipo_ocorrencia: string;
  local: string;
  horario: string;
  descritivo: string;
  cronologia: ItemCronologia[];
  aas_asl: string | null;
  cps: string | null;
  status: StatusOcorrenciaOperacional;
  horario_fim: string | null;
  entregue_com_restricao: boolean;
  descricao_restricao: string | null;
  relatar_atuacao: boolean;
  descricao_atuacao: string | null;
  group_id_whatsapp: string;
  mensagem_formatada: string | null;
  whatsapp_message_id: string | null;
  whatsapp_remote_jid: string | null;
  disparado_whatsapp: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface MensagemOcorrenciaOperacional {
  id: string;
  ocorrencia_id: string;
  tipo: TipoMensagemOcorrenciaOperacional;
  mensagem: string;
  cronologia: ItemCronologia[];
  whatsapp_message_id: string | null;
  whatsapp_remote_jid: string | null;
  sucesso: boolean;
  erro: string | null;
  criado_em: string;
}

export interface DadosOcorrenciaOperacional {
  id?: string;
  codigoEvento: string | null;
  linha: string;
  tipoOcorrencia: string;
  local: string;
  horario: string;
  descritivo: string;
  cronologia: ItemCronologia[];
  aasAsl: string | null;
  cps: string | null;
  status: StatusOcorrenciaOperacional;
  horarioFim: string | null;
  entregueComRestricao: boolean;
  descricaoRestricao: string | null;
  relatarAtuacao: boolean;
  descricaoAtuacao: string | null;
  groupIdWhatsApp: string;
}

export interface ResultadoEnvioWhatsApp {
  sucesso: boolean;
  messageId?: string;
  remoteJid?: string;
  erro?: string;
}

export interface ResultadoSalvamentoOcorrenciaOperacional {
  id: string;
  mensagemFormatada: string;
  whatsapp: ResultadoEnvioWhatsApp;
}

export interface ResultadoAtualizacaoCronologia {
  ocorrencia: OcorrenciaOperacional;
  mensagemFormatada: string;
  whatsapp: ResultadoEnvioWhatsApp;
}
