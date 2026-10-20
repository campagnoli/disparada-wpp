export type ModalidadePaese = 'SPTrans' | 'ARTESP' | 'Trilhos';

export interface OcorrenciaHistorico {
  id: string;
  codigo_evento: string | null;
  created_at: string | null;
  linha: string;
  via: string;
  localidade: string;
  id_trem: string | null;
  prefixo_viagem: string | null;
  classificacoes: string[];
  tipo_in: string | null;
  paese_acionado: boolean;
  paese_modalidades: ModalidadePaese[];
  paese_trecho: string;
  tem_impacto_outra_linha: boolean;
  linhas_impactadas_secundarias: string[];
  descricao_impacto_secundario: string | null;
  falha: string;
  hora_inicio: string;
  hora_fim: string | null;
  status: string;
  entregue_com_restricao: boolean;
  descricao_restricao: string | null;
  relatar_atuacao: boolean;
  descricao_atuacao: string | null;
}

export interface OcorrenciaDetalhe extends OcorrenciaHistorico {
  msg_comunicacao: string;
  msg_operacao: string;
  msg_gerencia: string;
}

export interface DetalhesEncerramento {
  entregueComRestricao: boolean;
  descricaoRestricao: string;
  relatarAtuacao: boolean;
  descricaoAtuacao: string;
}

export type CanalTradicional = 'comunicacao' | 'operacao' | 'gerencia';

export type MensagensTradicionais = Record<CanalTradicional, string>;

export interface GruposRedisparo {
  comunicacao: boolean;
  operacao: boolean;
  gerencia: boolean;
}

export type AbaOcorrenciaTradicional = 'textos' | 'encerramento';
