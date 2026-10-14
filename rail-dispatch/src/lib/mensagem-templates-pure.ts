import { incluirSCO } from '@/lib/mensagens';

export interface TemplatesMensagem {
  comunicacao: string;
  operacao: string;
  gerencia: string;
}

export const CHAVE_CONFIG_TEMPLATES = 'templates_mensagens';

export const TEMPLATES_MENSAGEM_PADRAO: TemplatesMensagem = {
  comunicacao: `{{TEXTO_COMUNICACAO}}`,
  operacao: `*Título:* {{TITULO}}
*Data:* {{DATA}}
*Horário de início:* {{HORA_INICIO}}
*Horário de fim:* {{HORA_FIM}}
*Duração:* {{DURACAO}}
*Trem que informa/Estação que informa:* {{TREM_ESTACAO_INFORMA}}
*Trecho/Estação afetados:* {{TRECHO_ESTACAO_AFETADOS}}
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
*Trem que informa/Estação que informa:* {{TREM_ESTACAO_INFORMA}}
*Trecho/Estação afetados:* {{TRECHO_ESTACAO_AFETADOS}}
*Estratégia de circulação:* {{RESUMO_LOOPS}}
*Classificação da ocorrência:* {{CLASSIFICACAO}}
*Falha:* {{FALHA}}
*Impacto:* {{IMPACTO}}
*Ações do CCO e outras áreas:* {{ACOES}}`,
};

export interface DadosTemplateMensagem {
  titulo?: string;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  duracao?: string;
  isEncerramento?: boolean;
  tremEstacaoInforma?: string;
  trechoEstacaoAfetados?: string;
  resumoLoops?: string;
  classificacao?: string;
  falha?: string;
  impacto?: string;
  acoes?: string;
  textoComunicacao?: string;
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

/**
 * Preenche o template com os dados da ocorrência e remove linhas condicionais vazias.
 * - HORA_FIM e DURACAO só aparecem quando informadas (após encerramento).
 * - Quando isEncerramento for true, adiciona *ENCERRAMENTO* em negrito acima do título.
 */
export function aplicarTemplateMensagem(template: string, dados: DadosTemplateMensagem): string {
  let texto = template;

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

  texto = texto.replaceAll('{{TREM_ESTACAO_INFORMA}}', dados.tremEstacaoInforma ?? '');
  texto = texto.replaceAll('{{TRECHO_ESTACAO_AFETADOS}}', dados.trechoEstacaoAfetados ?? '');
  texto = texto.replaceAll('{{FALHA}}', dados.falha ?? '');
  texto = texto.replaceAll('{{IMPACTO}}', dados.impacto ?? '');
  texto = texto.replaceAll('{{ACOES}}', dados.acoes ?? '');
  texto = texto.replaceAll('{{TEXTO_COMUNICACAO}}', dados.textoComunicacao ?? '');
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

  if (texto.includes('{{SCO}}') || texto.includes('{{INFORMANTE}}')) {
    const assinatura = scoValor ? `SCO: ${scoValor.trim()}` : '';
    texto = texto
      .replaceAll('{{SCO}}', assinatura)
      .replaceAll('{{INFORMANTE}}', assinatura);
  } else if (scoValor) {
    texto = incluirSCO(texto, scoValor.trim());
  }

  texto = texto.replace(/\n{3,}/g, '\n\n').trim();

  return texto;
}

/**
 * Aplica os dados de encerramento em uma mensagem já existente:
 * 1. Insere "*ENCERRAMENTO*" em negrito acima do título (se ainda não existir).
 * 2. Atualiza ou insere o "Horário de fim: HH:MM".
 * 3. Atualiza ou insere a "Duração: Xh Ymin" calculada entre início e fim.
 */
export function aplicarEncerramentoNaMensagem(
  mensagem: string,
  horaFim: string,
  horaInicio?: string
): string {
  if (!mensagem) return '';
  if (!horaFim) return mensagem;

  let texto = mensagem;

  // 1. Inserir ou garantir *ENCERRAMENTO* em negrito acima do título
  if (!/\*ENCERRAMENTO\*/i.test(texto)) {
    const padraoTitulo = /^(\s*\*?(?:T[íi]tulo|Ocorr[êe]ncia):?[^\r\n]*)/im;
    const matchTitulo = texto.match(padraoTitulo);
    if (matchTitulo && matchTitulo.index !== undefined) {
      const antes = texto.slice(0, matchTitulo.index);
      const resto = texto.slice(matchTitulo.index);
      texto = `${antes}*ENCERRAMENTO*\n${resto}`;
    } else {
      texto = `*ENCERRAMENTO*\n${texto}`;
    }
  }

  // 2. Extrair hora de início caso não tenha sido informada
  let hInicio = horaInicio;
  if (!hInicio) {
    const matchInicio = texto.match(/\*?Hor[áa]rio (?:de )?in[íi]cio:?\*?\s*([0-2]?\d:[0-5]\d)/i)
      || texto.match(/Hora Inicio:?\s*([0-2]?\d:[0-5]\d)/i);
    if (matchInicio) {
      hInicio = matchInicio[1];
    }
  }

  // 3. Calcular duração
  const duracao = calcularDuracao(hInicio, horaFim);

  // 4. Inserir ou atualizar Horário de Fim e Duração
  const usaAsterisco = /\*Hor[áa]rio (?:de )?in[íi]cio:\*/i.test(texto) || /\*T[íi]tulo:\*/i.test(texto);
  const padraoHoraFim = /\*?Hor[áa]rio (?:de )?(?:fim|encerramento):?\*?[^\r\n]*/i;
  const padraoHoraFimSimples = /Hora Fim:?[^\r\n]*/i;
  const padraoDuracao = /\*?Dura[çc][ãa]o:?\*?[^\r\n]*/i;

  const linhaHoraFim = usaAsterisco ? `*Horário de fim:* ${horaFim}` : `Hora Fim: ${horaFim}`;
  const linhaDuracao = duracao ? (usaAsterisco ? `*Duração:* ${duracao}` : `Duração: ${duracao}`) : '';

  const jaTemHoraFim = padraoHoraFim.test(texto) || padraoHoraFimSimples.test(texto);
  const jaTemDuracao = padraoDuracao.test(texto);

  // Se já tem Hora Fim na mensagem, atualiza-a
  if (padraoHoraFim.test(texto)) {
    texto = texto.replace(padraoHoraFim, linhaHoraFim);
  } else if (padraoHoraFimSimples.test(texto)) {
    texto = texto.replace(padraoHoraFimSimples, linhaHoraFim);
  }

  // Se já tem Duração na mensagem, atualiza-a
  if (jaTemDuracao) {
    if (linhaDuracao) {
      texto = texto.replace(padraoDuracao, linhaDuracao);
    } else {
      texto = texto.split('\n').filter((l) => !padraoDuracao.test(l)).join('\n');
    }
  }

  // Se NÃO tinha Hora Fim, insere no local correto
  if (!jaTemHoraFim) {
    const blocoFimEDuracao = linhaDuracao ? `${linhaHoraFim}\n${linhaDuracao}` : linhaHoraFim;

    // Tenta inserir logo após Horário de Início
    const padraoInicioLinha = /(\*?Hor[áa]rio (?:de )?in[íi]cio:?\*?[^\r\n]*|Hora Inicio:?[^\r\n]*)/i;
    const matchInicioLinha = texto.match(padraoInicioLinha);
    if (matchInicioLinha && matchInicioLinha.index !== undefined) {
      const pos = matchInicioLinha.index + matchInicioLinha[0].length;
      texto = `${texto.slice(0, pos)}\n${blocoFimEDuracao}${texto.slice(pos)}`;
    } else {
      // Se não tem início, tenta antes de Responsável:
      const matchAssinatura = texto.match(/\r?\n(Responsável:.*)$/i);
      if (matchAssinatura && matchAssinatura.index !== undefined) {
        const antes = texto.slice(0, matchAssinatura.index).trimEnd();
        const assinatura = matchAssinatura[1];
        texto = `${antes}\n${blocoFimEDuracao}\n${assinatura}`;
      } else {
        texto = `${texto.trimEnd()}\n${blocoFimEDuracao}`;
      }
    }
  } else if (!jaTemDuracao && linhaDuracao) {
    // Tinha Hora Fim mas não tinha Duração: insere Duração logo após a linha de Hora Fim
    const matchFim = texto.match(padraoHoraFim) || texto.match(padraoHoraFimSimples);
    if (matchFim && matchFim.index !== undefined) {
      const pos = matchFim.index + matchFim[0].length;
      texto = `${texto.slice(0, pos)}\n${linhaDuracao}${texto.slice(pos)}`;
    }
  }

  return texto;
}
