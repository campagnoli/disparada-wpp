import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { incluirInformante, normalizarInformante } from '@/lib/mensagens';
import { isModeloGemini } from '@/lib/gemini-models';
import { obterPromptSistemaAtivo, montarSystemInstruction } from '@/lib/gemini-prompt';
import { obterTemplatesMensagemAtivos, aplicarTemplateMensagem } from '@/lib/mensagem-templates';
import {
  formatarClassificacoes,
  isClassificacaoOcorrencia,
  isTipoIN,
} from '@/lib/classificacao-ocorrencia';
import { buscarViasEstacao, buscarViasTrecho } from '@/lib/vias';

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extrairDadosSecao(valor: unknown): { titulo: string; falha: string; impacto: string; acoes: string } | null {
  if (typeof valor === 'object' && valor !== null) {
    const v = valor as Record<string, unknown>;
    if (
      typeof v.titulo === 'string'
      || typeof v.falha === 'string'
      || typeof v.impacto === 'string'
      || typeof v.acoes === 'string'
    ) {
      return {
        titulo: typeof v.titulo === 'string' ? v.titulo.trim() : '',
        falha: typeof v.falha === 'string' ? v.falha.trim() : '',
        impacto: typeof v.impacto === 'string' ? v.impacto.trim() : '',
        acoes: typeof v.acoes === 'string' ? v.acoes.trim() : '',
      };
    }
  }
  return null;
}


export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não foi encontrada nas variáveis de ambiente.');
    return NextResponse.json(
      { error: 'Chave GEMINI_API_KEY não configurada no servidor.' },
      { status: 500 }
    );
  }

  try {
    const body: unknown = await req.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Dados da ocorrência inválidos.' }, { status: 400 });
    }

    const dados = body;
    const informante = normalizarInformante(dados.informante);
    const linha = typeof dados.linha === 'string' ? dados.linha : '';
    const via = typeof dados.via === 'string' ? dados.via : '';
    const elementoAfetado = typeof dados.elementoAfetado === 'string' ? dados.elementoAfetado.trim() : '';
    const plataformasAfetadas = Array.isArray(dados.plataformasAfetadas)
      ? dados.plataformasAfetadas.map((p) => String(p).trim()).filter(Boolean)
      : [];
    const detalheLocalizacao = typeof dados.detalheLocalizacao === 'string' ? dados.detalheLocalizacao.trim() : '';
    const horaInicio = typeof dados.horaInicio === 'string' ? dados.horaInicio.trim() : '';
    const idTrem = typeof dados.idTrem === 'string' ? dados.idTrem.trim() : '';
    const prefixoViagem = typeof dados.prefixoViagem === 'string' ? dados.prefixoViagem.trim() : '';
    const classificacoesRecebidas = Array.isArray(dados.classificacoes) ? dados.classificacoes : [];
    const classificacoes = classificacoesRecebidas.filter(isClassificacaoOcorrencia);
    const classificacoesValidas = classificacoes.length === classificacoesRecebidas.length
      && new Set(classificacoes).size === classificacoes.length;
    const tipoIN = typeof dados.tipoIN === 'string' ? dados.tipoIN.trim() : '';
    const inSelecionada = classificacoes.includes('IN');
    const modelo = isModeloGemini(dados.modelo) ? dados.modelo : 'gemini-3.1-flash-lite';
    const tipoLocalidade = dados.tipoLocalidade;
    const localidadeInicio = typeof dados.localidadeInicio === 'string' ? dados.localidadeInicio.trim() : '';
    const localidadeFim = typeof dados.localidadeFim === 'string' ? dados.localidadeFim.trim() : '';
    const estrategiaLoop = dados.estrategiaLoop === true;
    const loopsRecebidos = Array.isArray(dados.loops) ? dados.loops : [];
    const loopsValidos = estrategiaLoop
      ? loopsRecebidos.flatMap((item) => {
        if (!isRecord(item)) return [];
        const estInicio = typeof item.estacaoInicio === 'string' ? item.estacaoInicio.trim() : '';
        const estFim = typeof item.estacaoFim === 'string' ? item.estacaoFim.trim() : '';
        const intervalo = typeof item.intervaloTeorico === 'string' ? item.intervaloTeorico.trim() : '';
        return estInicio && estFim ? [{ estacaoInicio: estInicio, estacaoFim: estFim, intervaloTeorico: intervalo }] : [];
      })
      : [];
    const resumoLoops = typeof dados.resumoLoops === 'string' && dados.resumoLoops.trim()
      ? dados.resumoLoops.trim()
      : loopsValidos.length === 1
        ? `Loop entre ${loopsValidos[0].estacaoInicio} ⇄ ${loopsValidos[0].estacaoFim}${loopsValidos[0].intervaloTeorico ? ` (Intervalo teórico: ${loopsValidos[0].intervaloTeorico})` : ''}`
        : loopsValidos
          .map((l, idx) => `Loop ${idx + 1}: ${l.estacaoInicio} ⇄ ${l.estacaoFim}${l.intervaloTeorico ? ` (Intervalo teórico: ${l.intervaloTeorico})` : ''}`)
          .join('; ');

    const falhas = Array.isArray(dados.falhas)
      ? dados.falhas.flatMap((item) => {
        if (!isRecord(item) || typeof item.descricao !== 'string' || typeof item.impacto !== 'string') return [];
        const descricao = item.descricao.trim();
        const impacto = item.impacto.trim();
        return descricao && impacto && descricao.length <= 5000 && impacto.length <= 5000
          ? [{ descricao, impacto }]
          : [];
      })
      : [];

    if (
      !informante
      || !linha
      || idTrem.length > 100
      || prefixoViagem.length > 100
      || !classificacoesValidas
      || (inSelecionada ? !isTipoIN(tipoIN) : tipoIN !== '')
      || (tipoLocalidade !== 'estacao' && tipoLocalidade !== 'trecho')
      || !localidadeInicio
      || (tipoLocalidade === 'trecho' && (!localidadeFim || localidadeInicio === localidadeFim))
      || !falhas.length
      || falhas.length !== (Array.isArray(dados.falhas) ? dados.falhas.length : 0)
    ) {
      return NextResponse.json(
        { error: 'Informe uma localidade válida, ao menos uma falha com impacto e um modelo Gemini válido. Se selecionar IN, informe o tipo de A a E.' },
        { status: 400 }
      );
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Determina identificações de reporte e quem comunicou a ocorrência
    const quemComunicou = typeof dados.quemComunicou === 'string' ? dados.quemComunicou.trim().toLowerCase() : '';
    let tremEstacaoInforma = '';

    if (typeof dados.tremEstacaoInforma === 'string' && dados.tremEstacaoInforma.trim()) {
      tremEstacaoInforma = dados.tremEstacaoInforma.trim();
    } else if (quemComunicou === 'ouvidoria') {
      tremEstacaoInforma = 'Ouvidoria';
    } else if (quemComunicou === 'estacao') {
      tremEstacaoInforma = localidadeInicio ? `Estação ${localidadeInicio}` : 'Estação';
    } else if (quemComunicou === 'trem') {
      const partesTrem: string[] = [];
      if (idTrem) partesTrem.push(`Trem ${idTrem}`);
      if (prefixoViagem) partesTrem.push(`Prefixo ${prefixoViagem}`);
      tremEstacaoInforma = partesTrem.join(' / ') || 'Trem não identificado';
    } else {
      const identificacoesInforma: string[] = [];
      if (idTrem) identificacoesInforma.push(`Trem ${idTrem}`);
      if (prefixoViagem) identificacoesInforma.push(`Prefixo ${prefixoViagem}`);
      if (identificacoesInforma.length > 0) {
        tremEstacaoInforma = identificacoesInforma.join(' / ');
      } else if (localidadeInicio) {
        tremEstacaoInforma = `Estação ${localidadeInicio}`;
      } else {
        tremEstacaoInforma = 'Não informado';
      }
    }

    // Determina trecho ou estação afetados com elemento, plataforma ou via
    let trechoEstacaoAfetados = '';
    if (tipoLocalidade === 'estacao') {
      if (elementoAfetado === 'plataforma' && plataformasAfetadas.length > 0) {
        trechoEstacaoAfetados = `${localidadeInicio} - Plataforma(s) ${plataformasAfetadas.join(', ')}`;
      } else if (elementoAfetado === 'escada_rolante' || elementoAfetado === 'elevador') {
        const nomeEq = elementoAfetado === 'escada_rolante' ? 'Escada Rolante' : 'Elevador';
        const platTxt = plataformasAfetadas.length > 0 ? ` (Acesso Plataforma ${plataformasAfetadas.join(', ')})` : '';
        const detTxt = detalheLocalizacao ? ` - ${detalheLocalizacao}` : '';
        trechoEstacaoAfetados = `${localidadeInicio} - ${nomeEq}${platTxt}${detTxt}`;
      } else if (elementoAfetado === 'linha_bloqueio' || elementoAfetado === 'acesso_estacao') {
        const nomeEq = elementoAfetado === 'linha_bloqueio' ? 'Linha de Bloqueio (Catracas)' : 'Acesso à Estação';
        const detTxt = detalheLocalizacao ? ` (${detalheLocalizacao})` : '';
        trechoEstacaoAfetados = `${localidadeInicio} - ${nomeEq}${detTxt}`;
      } else if (elementoAfetado === 'via' && via) {
        trechoEstacaoAfetados = `${localidadeInicio} (${via})`;
      } else {
        trechoEstacaoAfetados = `${localidadeInicio}${via ? ` (${via})` : ''}${detalheLocalizacao ? ` - ${detalheLocalizacao}` : ''}`;
      }
    } else {
      trechoEstacaoAfetados = `${localidadeInicio} - ${localidadeFim}${via ? ` (${via})` : ''}`;
    }

    const dadosOcorrencia: Record<string, unknown> = { ...dados };
    delete dadosOcorrencia.modelo;
    dadosOcorrencia.falhas = falhas;
    dadosOcorrencia.idTrem = idTrem;
    dadosOcorrencia.prefixoViagem = prefixoViagem;
    dadosOcorrencia.classificacoes = classificacoes;
    dadosOcorrencia.tipoIN = inSelecionada ? tipoIN : null;
    dadosOcorrencia.falha = falhas.map((item) => item.descricao).join('; ');
    dadosOcorrencia.impacto = falhas.map((item) => item.impacto).join('\n');
    dadosOcorrencia.elementoAfetado = elementoAfetado || undefined;
    dadosOcorrencia.plataformasAfetadas = plataformasAfetadas.length > 0 ? plataformasAfetadas : undefined;
    dadosOcorrencia.detalheLocalizacao = detalheLocalizacao || undefined;
    dadosOcorrencia.localidade = trechoEstacaoAfetados;
    dadosOcorrencia.dataOcorrencia = dataAtual;
    dadosOcorrencia.tremEstacaoInforma = tremEstacaoInforma;
    dadosOcorrencia.trechoEstacaoAfetados = trechoEstacaoAfetados;
    dadosOcorrencia.estrategiaLoop = estrategiaLoop;
    dadosOcorrencia.resumoLoops = resumoLoops;

    // 1. Obter dicionário de estações e siglas da linha informada
    const { data: estacoes, error: dbError } = await supabase
      .from('estacoes')
      .select('nome, sigla, linha')
      .eq('linha', linha)
      .order('ordem');

    if (dbError) {
      console.warn('Aviso: Não foi possível carregar estações do Supabase:', dbError.message);
    }

    const dicionarioEstacoes = estacoes && estacoes.length > 0
      ? estacoes.map((estacao) => `${estacao.sigla} = ${estacao.nome} (${estacao.linha})`).join(', ')
      : 'Nenhum dicionário prévio disponível.';

    const mapaNomesEstacoes = new Map<string, string>();
    if (estacoes) {
      for (const e of estacoes) {
        mapaNomesEstacoes.set(e.sigla.toUpperCase(), e.nome);
      }
    }

    const loopsComNomesCompletos = loopsValidos.map((l, idx) => {
      const nomeInicio = mapaNomesEstacoes.get(l.estacaoInicio.toUpperCase()) || l.estacaoInicio;
      const nomeFim = mapaNomesEstacoes.get(l.estacaoFim.toUpperCase()) || l.estacaoFim;
      return `Loop ${idx + 1}: entre as estações ${nomeInicio} e ${nomeFim}${l.intervaloTeorico ? ` (com intervalo previsto de ${l.intervaloTeorico})` : ''}`;
    }).join('; ');

    // 2. Procurar mensagens de referência no histórico com base nas palavras-chave da falha (Few-shot / RAG)
    let exemplosHistorico = '';
    const termoBusca = (typeof dadosOcorrencia.falha === 'string' ? dadosOcorrencia.falha : '').trim();

    try {
      let referencias: { tipo_ocorrencia: string; texto_referencia: string }[] | null = null;

      if (termoBusca) {
        const { data: historico, error: buscaError } = await supabase
          .from('historico_mensagens')
          .select('tipo_ocorrencia, texto_referencia')
          .textSearch('texto_referencia', termoBusca, { type: 'websearch', config: 'portuguese' })
          .limit(3);

        if (!buscaError && historico && historico.length > 0) {
          referencias = historico;
        }
      }

      // Caso a pesquisa textual não retorne resultados, obtém 3 exemplos genéricos como referência
      if (!referencias || referencias.length === 0) {
        const { data: padrao, error: padraoError } = await supabase
          .from('historico_mensagens')
          .select('tipo_ocorrencia, texto_referencia')
          .limit(3);

        if (!padraoError && padrao && padrao.length > 0) {
          referencias = padrao;
        }
      }

      if (referencias && referencias.length > 0) {
        exemplosHistorico = referencias
          .map((h, i) => `Exemplo ${i + 1} (${h.tipo_ocorrencia}):\n"${h.texto_referencia}"`)
          .join('\n\n');
      }
    } catch (err: unknown) {
      console.warn('Aviso: Não foi possível obter exemplos históricos do Supabase:', err);
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        retryOptions: {
          attempts: 2,
          initialDelay: 0.5,
          maxDelay: 1,
          expBase: 2,
          jitter: 0.2,
          httpStatusCodes: [503],
        },
      },
    });

    // 3. Obter prompt do sistema e modelos de mensagem (customizados ou padrão)
    const [promptAtivo, { templates: templatesAtivos }] = await Promise.all([
      obterPromptSistemaAtivo(),
      obterTemplatesMensagemAtivos(),
    ]);

    // 4. Obter vias cadastradas na malha para a localidade informada (validação dinâmica e resolução ampla de vias)
    let viasPermitidasMalha: string[] = [];
    try {
      if (tipoLocalidade === 'estacao' && localidadeInicio) {
        viasPermitidasMalha = await buscarViasEstacao(localidadeInicio);
      } else if (tipoLocalidade === 'trecho' && localidadeInicio && localidadeFim) {
        viasPermitidasMalha = await buscarViasTrecho(linha, localidadeInicio, localidadeFim);
      }
    } catch {
      // Continua com fallback das regras de malha ferroviária no system instruction
    }

    const systemInstructionFinal = montarSystemInstruction(promptAtivo.prompt, {
      linha,
      dicionarioEstacoes,
      exemplosHistorico,
      estrategiaLoop,
      resumoLoops,
      loopsComNomesCompletos,
      tipoLocalidade,
      localidadeInicio,
      localidadeFim,
      via,
      viasPermitidas: viasPermitidasMalha,
      elementoAfetado,
      plataformasAfetadas,
      detalheLocalizacao,
      quemComunicou: quemComunicou || undefined,
      tremEstacaoInforma,
    });

    const generationOptions = {
      contents: `Gere as 3 mensagens com base nestes dados da ocorrência atual:\n${JSON.stringify(dadosOcorrencia)}`,
      config: {
        systemInstruction: systemInstructionFinal,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comunicacao: {
              type: Type.STRING,
              description: 'Mensagem narrativa em linguagem acessível, clara, sem jargões desnecessários, focada no impacto ao passageiro (intervalo maior, transferência, etc.). NUNCA cite números de vias técnicas nesta mensagem, traduzindo para "maior tempo de parada", "velocidade reduzida" ou "intervalo maior entre trens".',
            },
            operacao: {
              type: Type.OBJECT,
              properties: {
                titulo: {
                  type: Type.STRING,
                  description: 'Título conciso do despacho operacional, ex: DESPACHO CCO - LINHA 11-CORAL - FALHA DE TRAÇÃO',
                },
                falha: {
                  type: Type.STRING,
                  description: 'Descrição técnica e direta da falha, utilizando terminologia ferroviária autêntica e siglas de estações.',
                },
                impacto: {
                  type: Type.STRING,
                  description: 'Impacto operacional imediato na circulação, medidas técnicas de circulação (ex: singela, desvio, velocidade restrita). Citar APENAS a via explicitamente informada ou NENHUMA se a ocorrência for em estação sem via.',
                },
                acoes: {
                  type: Type.STRING,
                  description: 'Ações imediatas adotadas pelo CCO e equipes técnicas acionadas (manutenção, via, segurança).',
                },
              },
              required: ['titulo', 'falha', 'impacto', 'acoes'],
            },
            gerencia: {
              type: Type.OBJECT,
              properties: {
                titulo: {
                  type: Type.STRING,
                  description: 'Título executivo para diretoria, ex: INFORME EXECUTIVO CCO - LINHA 11-CORAL - FALHA DE TRAÇÃO',
                },
                falha: {
                  type: Type.STRING,
                  description: 'Resumo executivo objetivo com causa raiz, contexto e motivo técnico da falha.',
                },
                impacto: {
                  type: Type.STRING,
                  description: 'Impacto executivo na operação, carrossel de trens e tempo de viagem.',
                },
                acoes: {
                  type: Type.STRING,
                  description: 'Resumo executivo com tempo estimado de normalização, providências gerenciais e ações em curso.',
                },
              },
              required: ['titulo', 'falha', 'impacto', 'acoes'],
            },
          },
          required: ['comunicacao', 'operacao', 'gerencia'],
        },
      },
    };

    const modelosTentativa: string[] = [
      modelo,
      ...(modelo !== 'gemini-3.5-flash-lite' ? ['gemini-3.5-flash-lite'] : []),
      'gemini-flash-lite-latest',
      ...(modelo !== 'gemini-3.1-flash-lite' ? ['gemini-3.1-flash-lite'] : []),
    ];

    let response;
    let ultimoErro: unknown;

    for (const m of modelosTentativa) {
      try {
        response = await ai.models.generateContent({ model: m, ...generationOptions });
        if (m !== modelo) {
          console.log(`Fallback bem-sucedido: mensagens geradas com ${m} após indisponibilidade temporária do modelo ${modelo}.`);
        }
        break;
      } catch (err: unknown) {
        ultimoErro = err;
        const errStatus = getErrorStatus(err);
        if (errStatus === 503 || errStatus === 429) {
          console.warn(`Aviso: Modelo ${m} temporariamente com alta demanda no Google (${errStatus}). Tentando contingência...`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw ultimoErro;
    }

    const texto = response.text || '{}';
    let payload: unknown;
    try {
      payload = JSON.parse(texto);
    } catch {
      throw new Error('O Gemini retornou mensagens em formato que não pôde ser interpretado como JSON.');
    }

    if (!isRecord(payload)) {
      throw new Error('O Gemini retornou mensagens em formato inválido.');
    }

    const classificacaoFormatada = formatarClassificacoes(
      classificacoes,
      inSelecionada && isTipoIN(tipoIN) ? tipoIN : null,
    );
    const localidade = String(dadosOcorrencia.localidade ?? '');

    // 4. Formatação estruturada das mensagens usando os modelos (templates) configurados
    let msgOperacao: string;
    const operacaoData = extrairDadosSecao(payload.operacao);
    if (operacaoData) {
      msgOperacao = aplicarTemplateMensagem(templatesAtivos.operacao, {
        titulo: operacaoData.titulo || `DESPACHO CCO - ${linha.toUpperCase()}`,
        data: dataAtual,
        horaInicio: horaInicio || 'Não informada',
        tremEstacaoInforma,
        trechoEstacaoAfetados,
        resumoLoops: estrategiaLoop && resumoLoops ? resumoLoops : undefined,
        classificacao: classificacaoFormatada || undefined,
        falha: operacaoData.falha || (typeof dadosOcorrencia.falha === 'string' ? dadosOcorrencia.falha : ''),
        impacto: operacaoData.impacto || (typeof dadosOcorrencia.impacto === 'string' ? dadosOcorrencia.impacto : ''),
        acoes: operacaoData.acoes,
        informante,
        linha,
        via,
        idTrem,
        prefixoViagem,
        localidade,
      });
    } else if (typeof payload.operacao === 'string') {
      msgOperacao = incluirInformante(payload.operacao, informante);
    } else {
      throw new Error('O Gemini retornou formato inválido para a mensagem de operação.');
    }

    let msgGerencia: string;
    const gerenciaData = extrairDadosSecao(payload.gerencia);
    if (gerenciaData) {
      msgGerencia = aplicarTemplateMensagem(templatesAtivos.gerencia, {
        titulo: gerenciaData.titulo || `INFORME EXECUTIVO CCO - ${linha.toUpperCase()}`,
        data: dataAtual,
        horaInicio: horaInicio || 'Não informada',
        tremEstacaoInforma,
        trechoEstacaoAfetados,
        resumoLoops: estrategiaLoop && resumoLoops ? resumoLoops : undefined,
        classificacao: classificacaoFormatada || undefined,
        falha: gerenciaData.falha || (typeof dadosOcorrencia.falha === 'string' ? dadosOcorrencia.falha : ''),
        impacto: gerenciaData.impacto || (typeof dadosOcorrencia.impacto === 'string' ? dadosOcorrencia.impacto : ''),
        acoes: gerenciaData.acoes,
        informante,
        linha,
        via,
        idTrem,
        prefixoViagem,
        localidade,
      });
    } else if (typeof payload.gerencia === 'string') {
      msgGerencia = incluirInformante(payload.gerencia, informante);
    } else {
      throw new Error('O Gemini retornou formato inválido para a mensagem de gerência.');
    }

    const textoComunicacaoBruto = typeof payload.comunicacao === 'string' ? payload.comunicacao : '';
    const msgComunicacao = aplicarTemplateMensagem(templatesAtivos.comunicacao, {
      titulo: `INFORME CCO - ${linha.toUpperCase()}`,
      data: dataAtual,
      horaInicio: horaInicio || 'Não informada',
      tremEstacaoInforma,
      trechoEstacaoAfetados,
      resumoLoops: estrategiaLoop && resumoLoops ? resumoLoops : undefined,
      classificacao: classificacaoFormatada || undefined,
      falha: typeof dadosOcorrencia.falha === 'string' ? dadosOcorrencia.falha : '',
      impacto: typeof dadosOcorrencia.impacto === 'string' ? dadosOcorrencia.impacto : '',
      acoes: '',
      textoComunicacao: textoComunicacaoBruto,
      informante,
      linha,
      via,
      idTrem,
      prefixoViagem,
      localidade,
    });

    return NextResponse.json({
      comunicacao: msgComunicacao,
      operacao: msgOperacao,
      gerencia: msgGerencia,
    });
  } catch (error: unknown) {
    console.error('--- ERRO DETALHADO DO GEMINI ---');
    console.error(error);
    const status = getErrorStatus(error);
    let mensagemErro = 'Falha ao processar ocorrência com IA.';
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.message) {
          mensagemErro = parsed.error.message;
        } else {
          mensagemErro = error.message;
        }
      } catch {
        mensagemErro = error.message;
      }
    }
    if (status === 503) {
      mensagemErro = 'Os servidores do Gemini estão com alta demanda temporária (503). O sistema tentou o fallback. Por favor, tente novamente em instantes.';
    }
    return NextResponse.json(
      { error: mensagemErro },
      { status: status === 429 || status === 503 ? status : 500 }
    );
  }
}