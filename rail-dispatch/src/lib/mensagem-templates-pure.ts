import { incluirSCO } from '@/lib/mensagens';

export interface TemplatesGrupoMensagem {
  comunicacao: string;
  operacao: string;
  gerencia: string;
}

export interface TemplatesMensagem extends TemplatesGrupoMensagem {
  encerramento: TemplatesGrupoMensagem;
}

export const CHAVE_CONFIG_TEMPLATES = 'templates_mensagens';
export const TAGS_OBRIGATORIAS_ENCERRAMENTO = [
  '{{TITULO}}',
  '{{HORA_INICIO}}',
  '{{HORA_FIM}}',
  '{{DURACAO}}',
  '{{ENTREGA_RESTRICAO}}',
] as const;

export function modeloEncerramentoValido(template: string): boolean {
  return !template.includes('{{MENSAGEM_ATUAL}}')
    && TAGS_OBRIGATORIAS_ENCERRAMENTO.every((tag) => template.includes(tag));
}

export const TEMPLATES_MENSAGEM_PADRAO: TemplatesMensagem = {
  comunicacao: `{{TEXTO_COMUNICACAO}}`,
  operacao: `*LINHA:* {{LINHA}}
*OCORRÊNCIA:* {{FALHA}}
*COPESE:* {{COPESE}}
*IN:* {{IN}}
*LOCAL:* {{LOCALIDADE}}
*DATA:* {{DATA}}
*HORÁRIO INÍCIO:* {{HORA_INICIO}}
*HORÁRIO FIM:* {{HORA_FIM}}
*DESEMBARQUE:* {{DESEMBARQUE}}

*DESCRITIVO:* {{DESCRITIVO}}

*ESTRATÉGIA DE CIRCULAÇÃO:* {{RESUMO_LOOPS}}

*IMPACTO OPERACIONAL*:
{{IMPACTO}}

*#SCO:* {{SCO}}`,
  gerencia: `*LINHA:* {{LINHA}}
*OCORRÊNCIA:* {{FALHA}}
*COPESE:* {{COPESE}}
*IN:* {{IN}}
*LOCAL:* {{LOCALIDADE}}
*DATA:* {{DATA}}
*HORÁRIO INÍCIO:* {{HORA_INICIO}}
*HORÁRIO FIM:* {{HORA_FIM}}
*DESEMBARQUE:* {{DESEMBARQUE}}

*DESCRITIVO:* {{DESCRITIVO}}

*ESTRATÉGIA DE CIRCULAÇÃO:* {{RESUMO_LOOPS}}

*IMPACTO OPERACIONAL*:
{{IMPACTO}}

*#SCO:* {{SCO}}`,
  encerramento: {
  comunicacao: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
{{ENTREGA_RESTRICAO}}`,
  operacao: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
{{ENTREGA_RESTRICAO}}`,
  gerencia: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
{{ENTREGA_RESTRICAO}}`,
  },
};

export interface DadosTemplateMensagem {
  titulo?: string;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  duracao?: string;
  isEncerramento?: boolean;
  rotuloInformante?: string;
  tremEstacaoInforma?: string;
  rotuloLocalidadeAfetada?: string;
  trechoEstacaoAfetados?: string;
  resumoLoops?: string;
  classificacao?: string;
  tipoIN?: string;
  copese?: string;
  falha?: string;
  impacto?: string;
  acoes?: string;
  descritivo?: string;
  desembarque?: string;
  textoComunicacao?: string;
  mensagemAtual?: string;
  sco?: string;
  informante?: string;
  linha?: string;
  via?: string;
  idTrem?: string;
  prefixoViagem?: string;
  localidade?: string;
  temImpactoOutraLinha?: boolean;
  linhaSecundariaAfetada?: string;
  impactoSecundario?: string;
}

/**
 * Calcula a duração entre hora_inicio e hora_fim (formato HH:MM).
 * Trata automaticamente a virada de meia-noite (ex: início 23:50 e fim 00:20 -> 30 min).
 */
export function calcularDuracao(horaInicio?: string | null, horaFim?: string | null): string {
  if (!horaInicio || !horaFim) return '';
  const regex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const hI = horaInicio.trim();
  const hF = horaFim.trim();
  if (!regex.test(hI) || !regex.test(hF)) return '';

  const [h1, m1] = hI.split(':').map(Number);
  const [h2, m2] = hF.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) {
    diff += 24 * 60; // Trata virada de meia-noite
  }

  if (diff === 0) return 'Menos de 1 min';
  const horas = Math.floor(diff / 60);
  const minutos = diff % 60;

  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h ${minutos}min`;
}

export function aplicarRotulosCondicionaisMensagem(
  mensagem: string,
  dados: Pick<
    DadosTemplateMensagem,
    'rotuloInformante' | 'tremEstacaoInforma' | 'rotuloLocalidadeAfetada' | 'trechoEstacaoAfetados'
  >
): string {
  const campos = [
    {
      rotuloTag: '{{ROTULO_INFORMANTE}}',
      valorTag: '{{TREM_ESTACAO_INFORMA}}',
      rotulo: dados.rotuloInformante,
      valor: dados.tremEstacaoInforma,
      rotuloAntigo: /\*?\s*(?:Trem que informa\s*\/\s*Estação que informa|Estação que informa\s*\/\s*Trem que informa|Trem que informa|Estação que informa)\s*:?\s*\*?/i,
    },
    {
      rotuloTag: '{{ROTULO_LOCALIDADE_AFETADA}}',
      valorTag: '{{TRECHO_ESTACAO_AFETADOS}}',
      rotulo: dados.rotuloLocalidadeAfetada,
      valor: dados.trechoEstacaoAfetados,
      rotuloAntigo: /\*?\s*(?:Trecho\s*\/\s*Estação\s+afetados|Trecho\s+afetado|Estação\s+afetada)\s*:?\s*\*?/i,
    },
  ];

  return mensagem
    .split('\n')
    .flatMap((linha) => {
      const campo = campos.find(({ rotuloTag, rotuloAntigo }) =>
        linha.includes(rotuloTag) || rotuloAntigo.test(linha)
      );
      if (!campo) return [linha];
      if (!campo.rotulo?.trim() || !campo.valor?.trim()) return [];

      return [
        linha
          .replaceAll(campo.rotuloTag, campo.rotulo.trim())
          .replaceAll(campo.valorTag, campo.valor.trim())
          .replace(campo.rotuloAntigo, `*${campo.rotulo.trim()}:*`),
      ];
    })
    .join('\n');
}

/**
 * Preenche o template com os dados da ocorrência e remove linhas condicionais vazias.
 * - HORA_FIM e DURACAO só aparecem quando informadas.
 * - Quando isEncerramento for true, adiciona *ENCERRAMENTO* em negrito acima do título.
 */
export function aplicarTemplateMensagem(template: string, dados: DadosTemplateMensagem): string {
  let texto = aplicarRotulosCondicionaisMensagem(template, dados);

  const scoValor = dados.sco ?? dados.informante ?? '';
  const duracaoValor = dados.duracao || calcularDuracao(dados.horaInicio, dados.horaFim);

  // 1. Tag de ENCERRAMENTO (só aparece após encerrada)
  if (dados.isEncerramento) {
    if (texto.includes('{{ENCERRAMENTO}}')) {
      texto = texto.replaceAll('{{ENCERRAMENTO}}', '*ENCERRAMENTO*');
    } else if (!/\*ENCERRAMENTO\*/i.test(texto)) {
      const matchTitulo = texto.match(/^(\s*\*?(?:T[íi]tulo|Ocorr[êe]ncia):?[^\r\n]*)/im);
      if (matchTitulo && matchTitulo.index !== undefined) {
        const antes = texto.slice(0, matchTitulo.index);
        const resto = texto.slice(matchTitulo.index);
        texto = `${antes}*ENCERRAMENTO*\n${resto}`;
      } else {
        texto = `*ENCERRAMENTO*\n${texto}`;
      }
    }
  } else {
    texto = texto
      .split('\n')
      .filter((l) => !l.includes('{{ENCERRAMENTO}}'))
      .join('\n');
  }

  texto = texto.replaceAll('{{TITULO}}', dados.titulo ?? '');
  texto = texto.replaceAll('{{DATA}}', dados.data ?? '');
  texto = texto.replaceAll('{{HORA_INICIO}}', dados.horaInicio ?? '');

  // 2. HORA_FIM: só deve aparecer quando informada.
  if (dados.horaFim && dados.horaFim.trim()) {
    texto = texto.replaceAll('{{HORA_FIM}}', dados.horaFim.trim());
  } else {
    texto = texto
      .split('\n')
      .filter((l) => !l.includes('{{HORA_FIM}}'))
      .join('\n');
  }

  // 3. DURACAO: só deve aparecer quando calculada / informada (após encerramento)
  if (duracaoValor && duracaoValor.trim()) {
    texto = texto.replaceAll('{{DURACAO}}', duracaoValor.trim());
  } else {
    texto = texto
      .split('\n')
      .filter((l) => !l.includes('{{DURACAO}}'))
      .join('\n');
  }

  texto = texto.replaceAll('{{ROTULO_INFORMANTE}}', dados.rotuloInformante ?? '');
  texto = texto.replaceAll('{{TREM_ESTACAO_INFORMA}}', dados.tremEstacaoInforma ?? '');
  texto = texto.replaceAll('{{ROTULO_LOCALIDADE_AFETADA}}', dados.rotuloLocalidadeAfetada ?? '');
  texto = texto.replaceAll('{{TRECHO_ESTACAO_AFETADOS}}', dados.trechoEstacaoAfetados ?? '');
  texto = texto.replaceAll('{{FALHA}}', dados.falha ?? '');
  texto = texto.replaceAll('{{IMPACTO}}', dados.impacto ?? '');
  texto = texto.replaceAll('{{ACOES}}', dados.acoes ?? '');
  texto = texto.replaceAll('{{TEXTO_COMUNICACAO}}', dados.textoComunicacao ?? '');
  texto = texto.replaceAll('{{MENSAGEM_ATUAL}}', dados.mensagemAtual ?? '');
  texto = texto.replaceAll('{{LINHA}}', dados.linha ?? '');
  texto = texto.replaceAll('{{VIA}}', dados.via ?? '');
  texto = texto.replaceAll('{{ID_TREM}}', dados.idTrem ?? '');
  texto = texto.replaceAll('{{PREFIXO_VIAGEM}}', dados.prefixoViagem ?? '');
  texto = texto.replaceAll('{{LOCALIDADE}}', dados.localidade ?? '');
  texto = texto.replaceAll('{{TEM_IMPACTO_OUTRA_LINHA}}', dados.temImpactoOutraLinha ? 'Sim' : 'Não');

  const linhaSecundariaAfetada = dados.linhaSecundariaAfetada?.trim() ?? '';
  const impactoSecundario = dados.impactoSecundario?.trim() ?? '';
  if (!linhaSecundariaAfetada || !impactoSecundario) {
    texto = texto
      .split('\n')
      .filter((linha) =>
        !(!linhaSecundariaAfetada && linha.includes('{{LINHA_SECUNDARIA_AFETADA}}'))
        && !(!impactoSecundario && linha.includes('{{IMPACTO_SECUNDARIO}}'))
      )
      .join('\n');
  }
  texto = texto
    .replaceAll('{{LINHA_SECUNDARIA_AFETADA}}', linhaSecundariaAfetada)
    .replaceAll('{{IMPACTO_SECUNDARIO}}', impactoSecundario);

  // Campos do padrão operacional de mensagens (opcionais)
  const valorTipoIN = dados.tipoIN?.trim() || 'Não';
  const valorCopese = dados.copese?.trim() || 'Não';
  const valorDesembarque = dados.desembarque?.trim() ?? '';
  const valorDescritivo = dados.descritivo?.trim() ?? '';

  if (/^sim\b/i.test(valorDesembarque)) {
    texto = texto.replaceAll('{{DESEMBARQUE}}', valorDesembarque);
  } else {
    texto = texto
      .split('\n')
      .filter((linha) => !linha.includes('{{DESEMBARQUE}}'))
      .join('\n');
  }

  if (valorDescritivo) {
    texto = texto.replaceAll('{{DESCRITIVO}}', valorDescritivo);
  } else {
    texto = texto
      .split('\n')
      .filter((linha) => !linha.includes('{{DESCRITIVO}}'))
      .join('\n');
  }

  texto = texto
    .replaceAll('{{IN}}', valorTipoIN)
    .replaceAll('{{COPESE}}', valorCopese);

  if (dados.resumoLoops) {
    texto = texto.replaceAll('{{RESUMO_LOOPS}}', dados.resumoLoops);
  } else {
    texto = texto
      .split('\n')
      .filter((l) => !l.includes('{{RESUMO_LOOPS}}'))
      .join('\n');
  }

  if (dados.classificacao) {
    texto = texto.replaceAll('{{CLASSIFICACAO}}', dados.classificacao);
  } else {
    texto = texto
      .split('\n')
      .filter((l) => !l.includes('{{CLASSIFICACAO}}'))
      .join('\n');
  }

  texto = texto.replaceAll('{{INFORMANTE}}', '');
  if (scoValor) {
    if (texto.includes('{{SCO}}')) {
      texto = texto.replaceAll('{{SCO}}', scoValor.trim());
    } else {
      texto = incluirSCO(texto, scoValor.trim());
    }
  } else {
    texto = texto
      .split('\n')
      .filter((linha) => !linha.includes('{{SCO}}'))
      .join('\n');
  }

  texto = texto.replace(/\n{3,}/g, '\n\n').trim();

  return texto;
}

/** Aplica um modelo de encerramento à mensagem em andamento e mantém a assinatura ao final. */
export function aplicarEncerramentoNaMensagem(
  mensagem: string,
  horaFim: string,
  horaInicio?: string,
  templateEncerramento?: string,
  tituloFallback?: string,
  impactoOutraLinha?: Pick<
    DadosTemplateMensagem,
    'temImpactoOutraLinha' | 'linhaSecundariaAfetada' | 'impactoSecundario'
  >
): string {
  if (!mensagem) return '';
  if (!horaFim) return mensagem;

  const linhasOriginais = mensagem.split('\n');
  const assinaturaIndex = linhasOriginais.findIndex((linha, index) => {
    if (/^[ \t]*(?:\*?#?SCO:\*?\s*.+|Responsável:\s*.+)[ \t]*$/i.test(linha)) return true;
    return /^#\s*.+$/.test(linha.trim())
      && linhasOriginais.slice(index + 1).every((linhaSeguinte) => !linhaSeguinte.trim());
  });
  const titulo = linhasOriginais
    .map((linha) => linha.match(/^\s*\*?T[íi]tulo:?\*?\s*(.+?)\s*$/i)?.[1]?.trim())
    .find(Boolean)
    || tituloFallback
    || '';
  const inicio = horaInicio
    || linhasOriginais
      .map((linha) => linha.match(/^\s*\*?Hor[áa]rio (?:de )?in[íi]cio:?\*?\s*([0-2]?\d:[0-5]\d)/i)?.[1])
      .find(Boolean)
    || linhasOriginais
      .map((linha) => linha.match(/^\s*Hora Inicio:?\s*([0-2]?\d:[0-5]\d)/i)?.[1])
      .find(Boolean)
    || '';
  const assinatura = assinaturaIndex >= 0
    ? linhasOriginais[assinaturaIndex].trim()
    .replace(/^\*?#?SCO:\*?\s*/i, '')
    .replace(/^Responsável:\s*/i, '')
    .replace(/^#\s*/, '')
    : '';
  const template = templateEncerramento || `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
{{ENTREGA_RESTRICAO}}`;

  return aplicarTemplateMensagem(template, {
    titulo,
    horaInicio: inicio,
    horaFim,
    duracao: calcularDuracao(inicio, horaFim),
    sco: assinatura,
    ...impactoOutraLinha,
  });
}

export interface DetalhesEncerramento {
  entregueComRestricao: boolean;
  descricaoRestricao: string;
  relatarAtuacao: boolean;
  descricaoAtuacao: string;
}

export function incluirDetalhesEncerramento(
  mensagem: string,
  detalhes: DetalhesEncerramento,
): string {
  const informacoes = [
    detalhes.entregueComRestricao
      ? `*Entregue com restrição:* ${detalhes.descricaoRestricao.trim()}`
      : '*Entrega:* Entregue sem restrição',
    detalhes.relatarAtuacao && detalhes.descricaoAtuacao.trim()
      ? `*Atuação:* ${detalhes.descricaoAtuacao.trim()}`
      : '',
  ].filter(Boolean);
  const statusEntrega = informacoes[0];
  const temTagEntrega = mensagem.includes('{{ENTREGA_RESTRICAO}}');
  const mensagemComStatusEntrega = temTagEntrega
    ? mensagem.replaceAll('{{ENTREGA_RESTRICAO}}', statusEntrega)
    : mensagem.replaceAll('{{ENTREGA_RESTRICAO}}', '');
  const informacoesAdicionais = informacoes.slice(temTagEntrega ? 1 : 0);
  if (!informacoesAdicionais.length && temTagEntrega) return mensagemComStatusEntrega.replace(/\n{3,}/g, '\n\n').trim();
  if (!informacoesAdicionais.length && !temTagEntrega) return mensagem;

  const linhas = mensagemComStatusEntrega.split('\n');
  const assinaturaIndex = linhas.findIndex((linha, index) => {
    if (/^[ \t]*(?:\*?#?SCO:\*?\s*.+|Responsável:\s*.+)[ \t]*$/i.test(linha)) return true;
    return /^#\s*.+$/.test(linha.trim())
      && linhas.slice(index + 1).every((linhaSeguinte) => !linhaSeguinte.trim());
  });
  const indiceInsercao = assinaturaIndex >= 0 ? assinaturaIndex : linhas.length;
  const corpo = linhas.slice(0, indiceInsercao).join('\n').trimEnd();
  const assinatura = linhas.slice(indiceInsercao).join('\n').trimStart();

  return [corpo, ...(!temTagEntrega ? [statusEntrega] : []), ...informacoesAdicionais, assinatura]
    .filter(Boolean)
    .join('\n');
}
