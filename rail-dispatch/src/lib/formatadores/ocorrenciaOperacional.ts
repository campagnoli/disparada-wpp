export interface ItemCronologia {
  id?: string;
  horario: string; // Ex: "10:05" ou "10h05"
  texto: string;
}

export interface PayloadOcorrenciaOperacional {
  linha: string;
  tipoOcorrencia: string;
  local: string;
  horario: string;
  descritivo: string;
  cronologia: ItemCronologia[];
  aasAsl?: string;
  cps?: string;
}

export function formatarMensagemOcorrencia(dados: PayloadOcorrenciaOperacional): string {
  // Ordena cronologicamente por horário
  const cronologiaOrdenada = [...dados.cronologia].sort((a, b) =>
    a.horario.localeCompare(b.horario)
  );

  const textoCronologia = cronologiaOrdenada.length > 0
    ? cronologiaOrdenada
        .map(item => `• ${item.horario.replace(':', 'h')} - ${item.texto.trim()}`)
        .join('\n')
    : '• Em apuração inicial.';

  const aasAslLinha = dados.aasAsl?.trim() ? `#AAS/ASL: ${dados.aasAsl.trim()}` : '#AAS/ASL: Não informado';
  const cpsLinha = dados.cps?.trim() ? `#CPS: ${dados.cps.trim()}` : '#CPS: Não informado';

  return `*LINHA:* ${dados.linha}
*OCORRÊNCIA:* ${dados.tipoOcorrencia}
*LOCAL:* ${dados.local}
*HORÁRIO:* ${dados.horario.replace(':', 'h')}
*DESCRITIVO:* ${dados.descritivo || 'Sem descritivo preliminar.'}

*CRONOLOGIA:*
${textoCronologia}

${aasAslLinha}
${cpsLinha}`.trim();
}