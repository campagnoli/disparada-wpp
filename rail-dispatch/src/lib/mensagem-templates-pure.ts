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
] as const;

export function modeloEncerramentoValido(template: string): boolean {
  return !template.includes('{{MENSAGEM_ATUAL}}')
    && TAGS_OBRIGATORIAS_ENCERRAMENTO.every((tag) => template.includes(tag));
}

export const TEMPLATES_MENSAGEM_PADRAO: TemplatesMensagem = {
  comunicacao: `{{TEXTO_COMUNICACAO}}`,
  operacao: `*Título:* {{TITULO}}
*Data:* {{DATA}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
*{{ROTULO_INFORMANTE}}:* {{TREM_ESTACAO_INFORMA}}
*{{ROTULO_LOCALIDADE_AFETADA}}:* {{TRECHO_ESTACAO_AFETADOS}}
*Estratégia de circulação:* {{RESUMO_LOOPS}}
*Classificação da ocorrência:* {{CLASSIFICACAO}}
*Falha:* {{FALHA}}
*Impacto:* {{IMPACTO}}
*Ações do CCO e outras áreas:* {{ACOES}}`,
  gerencia: `*Título:* {{TITULO}}
*Data:* {{DATA}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
*{{ROTULO_INFORMANTE}}:* {{TREM_ESTACAO_INFORMA}}
*{{ROTULO_LOCALIDADE_AFETADA}}:* {{TRECHO_ESTACAO_AFETADOS}}
*Estratégia de circulação:* {{RESUMO_LOOPS}}
*Classificação da ocorrência:* {{CLASSIFICACAO}}
*Falha:* {{FALHA}}
*Impacto:* {{IMPACTO}}
*Ações do CCO e outras áreas:* {{ACOES}}`,
  encerramento: {
  comunicacao: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}`,
  operacao: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}`,
  gerencia: `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}`,
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
  falha?: string;
  impacto?: string;
  acoes?: string;
  textoComunicacao?: string;
  mensagemAtual?: string;
  sco?: string;
  informante?: string;
  linha?: string;
  via?: string;
  idTrem?: string;
  prefixoViagem?: string;
  localidade?: string;
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
 * - HORA_FIM e DURACAO só aparecem quando informadas (após encerramento).
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

  // 2. HORA_FIM: só deve aparecer quando informada (após encerramento)
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

  texto = texto
    .replaceAll('{{SCO}}', '')
    .replaceAll('{{INFORMANTE}}', '');
  if (scoValor) texto = incluirSCO(texto, scoValor.trim());

  texto = texto.replace(/\n{3,}/g, '\n\n').trim();

  return texto;
}

/** Aplica um modelo de encerramento à mensagem em andamento e mantém a assinatura ao final. */
export function aplicarEncerramentoNaMensagem(
  mensagem: string,
  horaFim: string,
  horaInicio?: string,
  templateEncerramento?: string,
  tituloFallback?: string
): string {
  if (!mensagem) return '';
  if (!horaFim) return mensagem;

  const linhasOriginais = mensagem.split('\n');
  const assinaturaIndex = linhasOriginais.findIndex((linha, index) => {
    if (/^[ \t]*(?:SCO:\s*.+|Responsável:\s*.+)[ \t]*$/i.test(linha)) return true;
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
    .replace(/^(?:SCO|Responsável):\s*/i, '')
    .replace(/^#\s*/, '')
    : '';
  const template = templateEncerramento || `*Título:* {{TITULO}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}`;

  return aplicarTemplateMensagem(template, {
    titulo,
    horaInicio: inicio,
    horaFim,
    duracao: calcularDuracao(inicio, horaFim),
    sco: assinatura,
  });
}
