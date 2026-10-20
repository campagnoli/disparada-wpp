import type { NumeroLinha, ResumosReporte } from '@/lib/reporte-turno/tipos';

export const CHAVE_CONFIG_TEMPLATE_REPORTE = 'template_reporte_operacional';

export const TAGS_TEMPLATE_REPORTE = [
  { tag: '{{DATA}}', descricao: 'Data do reporte no formato DD/MM/AAAA.' },
  { tag: '{{TURNO_HORARIO}}', descricao: 'Horário do turno: 09h ou 21h.' },
  { tag: '{{STATUS_FROTA_L11}}', descricao: 'Status da frota da Linha 11-Coral.' },
  { tag: '{{STATUS_FROTA_L12}}', descricao: 'Status da frota da Linha 12-Safira.' },
  { tag: '{{STATUS_FROTA_L13}}', descricao: 'Status da frota da Linha 13-Jade.' },
  { tag: '{{RESUMO_OCORRENCIAS_L11}}', descricao: 'Resumo das ocorrências da Linha 11-Coral.' },
  { tag: '{{RESUMO_OCORRENCIAS_L12}}', descricao: 'Resumo das ocorrências da Linha 12-Safira.' },
  { tag: '{{RESUMO_OCORRENCIAS_L13}}', descricao: 'Resumo das ocorrências da Linha 13-Jade.' },
  { tag: '{{IMPACTO_L11}}', descricao: 'Impacto operacional da Linha 11-Coral.' },
  { tag: '{{IMPACTO_L12}}', descricao: 'Impacto operacional da Linha 12-Safira.' },
  { tag: '{{IMPACTO_L13}}', descricao: 'Impacto operacional da Linha 13-Jade.' },
  { tag: '{{NOME_SCO}}', descricao: 'Nome do SCO responsável pela emissão.' },
] as const;

export const TAGS_OBRIGATORIAS_TEMPLATE_REPORTE = TAGS_TEMPLATE_REPORTE.map(
  (item) => item.tag,
);

export const TEMPLATE_REPORTE_PADRAO = `*REPORTE OPERACIONAL - {{DATA}} - {{TURNO_HORARIO}}*

*Linha 11-Coral:* {{STATUS_FROTA_L11}}
*Linha 12-Safira:* {{STATUS_FROTA_L12}}
*Linha 13-Jade:* {{STATUS_FROTA_L13}}

*Ocorrências Linha 11:* {{RESUMO_OCORRENCIAS_L11}}
*Ocorrências Linha 12:* {{RESUMO_OCORRENCIAS_L12}}
*Ocorrências Linha 13:* {{RESUMO_OCORRENCIAS_L13}}

*Impacto Linha 11:* {{IMPACTO_L11}}
*Impacto Linha 12:* {{IMPACTO_L12}}
*Impacto Linha 13:* {{IMPACTO_L13}}

SCO: {{NOME_SCO}}`;

export const RESUMO_SEM_OCORRENCIAS = 'Sem ocorrências operacionais relevantes no período';
export const IMPACTO_OPERACAO_NORMAL = 'Operação dentro dos padrões normais';

export function templateReporteValido(template: string): boolean {
  return TAGS_OBRIGATORIAS_TEMPLATE_REPORTE.every((tag) => template.includes(tag));
}

export interface DadosTemplateReporte {
  data: string;
  turnoHorario: string;
  statusFrota: Record<NumeroLinha, string>;
  resumos: ResumosReporte;
  sco: string;
}

function textoEmLinhaUnica(valor: string): string {
  return valor.trim().replace(/\s*\r?\n\s*/g, ' ').replace(/\s{2,}/g, ' ');
}

export function aplicarTemplateReporte(
  template: string,
  dados: DadosTemplateReporte,
): string {
  const substituicoes: Record<string, string> = {
    '{{DATA}}': textoEmLinhaUnica(dados.data),
    '{{TURNO_HORARIO}}': textoEmLinhaUnica(dados.turnoHorario),
    '{{STATUS_FROTA_L11}}': textoEmLinhaUnica(dados.statusFrota[11]),
    '{{STATUS_FROTA_L12}}': textoEmLinhaUnica(dados.statusFrota[12]),
    '{{STATUS_FROTA_L13}}': textoEmLinhaUnica(dados.statusFrota[13]),
    '{{RESUMO_OCORRENCIAS_L11}}': textoEmLinhaUnica(dados.resumos[11].ocorrencias),
    '{{RESUMO_OCORRENCIAS_L12}}': textoEmLinhaUnica(dados.resumos[12].ocorrencias),
    '{{RESUMO_OCORRENCIAS_L13}}': textoEmLinhaUnica(dados.resumos[13].ocorrencias),
    '{{IMPACTO_L11}}': textoEmLinhaUnica(dados.resumos[11].impacto),
    '{{IMPACTO_L12}}': textoEmLinhaUnica(dados.resumos[12].impacto),
    '{{IMPACTO_L13}}': textoEmLinhaUnica(dados.resumos[13].impacto),
    '{{NOME_SCO}}': textoEmLinhaUnica(dados.sco),
  };

  let mensagem = template;
  for (const [tag, valor] of Object.entries(substituicoes)) {
    mensagem = mensagem.replaceAll(tag, valor);
  }

  return mensagem.trim();
}
