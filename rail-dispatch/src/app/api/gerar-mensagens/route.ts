import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { incluirInformante, normalizarInformante } from '@/lib/mensagens';
import { isModeloGemini } from '@/lib/gemini-models';
import {
  formatarClassificacoes,
  isClassificacaoOcorrencia,
  isTipoIN,
} from '@/lib/classificacao-ocorrencia';

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não foi encontrada nas variáveis de ambiente.');
    return NextResponse.json(
      { error: 'Chave GEMINI_API_KEY não configurada no ficheiro .env.local.' },
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
    const idTrem = typeof dados.idTrem === 'string' ? dados.idTrem.trim() : '';
    const prefixoViagem = typeof dados.prefixoViagem === 'string' ? dados.prefixoViagem.trim() : '';
    const classificacoesRecebidas = Array.isArray(dados.classificacoes) ? dados.classificacoes : [];
    const classificacoes = classificacoesRecebidas.filter(isClassificacaoOcorrencia);
    const classificacoesValidas = classificacoes.length === classificacoesRecebidas.length
      && new Set(classificacoes).size === classificacoes.length;
    const tipoIN = typeof dados.tipoIN === 'string' ? dados.tipoIN.trim() : '';
    const inSelecionada = classificacoes.includes('IN');
    const modelo = dados.modelo;
    const tipoLocalidade = dados.tipoLocalidade;
    const localidadeInicio = typeof dados.localidadeInicio === 'string' ? dados.localidadeInicio.trim() : '';
    const localidadeFim = typeof dados.localidadeFim === 'string' ? dados.localidadeFim.trim() : '';
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
      || !isModeloGemini(modelo)
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
    const dadosOcorrencia = { ...dados };
    delete dadosOcorrencia.modelo;
    dadosOcorrencia.falhas = falhas;
    dadosOcorrencia.idTrem = idTrem;
    dadosOcorrencia.prefixoViagem = prefixoViagem;
    dadosOcorrencia.classificacoes = classificacoes;
    dadosOcorrencia.tipoIN = inSelecionada ? tipoIN : null;
    dadosOcorrencia.falha = falhas.map((item) => item.descricao).join('; ');
    dadosOcorrencia.impacto = falhas.map((item) => item.impacto).join('\n');
    dadosOcorrencia.localidade = tipoLocalidade === 'estacao'
      ? localidadeInicio
      : `${localidadeInicio} - ${localidadeFim}`;

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

    const generationOptions = {
      contents: `Gere as 3 mensagens com base nestes dados da ocorrência: ${JSON.stringify(dadosOcorrencia)}`,
      config: {
        systemInstruction: `
          Você é um despachador especialista em CCO ferroviário metropolitano de passageiros.
          Sua missão é converter dados brutos de ocorrências em 3 mensagens padronizadas prontas para WhatsApp.

          DICIONÁRIO DE ESTAÇÕES E SIGLAS OFICIAIS:
          ${dicionarioEstacoes}

          REGRAS DE INTERPRETAÇÃO DE LOCALIDADE:
          - Sempre que o operador utilizar siglas, identifique a estação correspondente pelo dicionário acima.
          - Na mensagem de COMUNICAÇÃO, nunca use siglas operacionais. Converta-as para o nome por extenso da estação.
          - Na mensagem de OPERAÇÃO, pode manter a sigla operacional tradicional do CCO ou informar sigla e nome completo.
          - Na mensagem de GERÊNCIA, use o nome completo por extenso junto à sigla.

          PADRÃO DAS 3 MENSAGENS:
          1. COMUNICAÇÃO: Mensagem para a equipe de comunicação e jornalistas. Use linguagem clara para quem conhece o básico de ferrovia, explique termos operacionais necessários e contextualize o impacto ao passageiro. Não presuma que o texto será enviado diretamente ao passageiro.
          2. OPERAÇÃO: Padrão CCO/Tráfego (Linha, Via, Trem, Estação/Trecho, falha específica e procedimentos imediatos).
          3. GERÊNCIA: Resumo executivo com causa reportada, impacto na circulação e equipes acionadas.

          A classificação e a identificação do trem e do prefixo serão acrescentadas ao final das mensagens de OPERAÇÃO e GERÊNCIA. Não repita esses campos no texto gerado.
          Use formatação nativa do WhatsApp (*negrito* e quebras de linha limpas).
          Descreva a localidade de acordo com o tipo informado: uma única estação afetada ou um trecho entre as estações A e B.
          Não inclua a assinatura do responsável nas mensagens; ela será adicionada ao final de cada mensagem.
        `,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comunicacao: {
              type: Type.STRING,
              description: 'Mensagem para a equipe de comunicação e jornalistas, acessível a quem conhece o básico de ferrovia e não necessariamente dirigida diretamente ao passageiro.',
            },
            operacao: {
              type: Type.STRING,
              description: 'Mensagem técnica e direta para CCO, estações e manutenção.',
            },
            gerencia: {
              type: Type.STRING,
              description: 'Informe executivo com causa reportada, nomes completos e ações em curso.',
            },
          },
          required: ['comunicacao', 'operacao', 'gerencia'],
        },
      },
    };

    const response = await ai.models.generateContent({ model: modelo, ...generationOptions });

    const texto = response.text || '{}';
    const payload: unknown = JSON.parse(texto);

    if (
      !isRecord(payload)
      || typeof payload.comunicacao !== 'string'
      || typeof payload.operacao !== 'string'
      || typeof payload.gerencia !== 'string'
    ) {
      throw new Error('O Gemini retornou mensagens em formato inválido.');
    }

    const classificacaoFormatada = formatarClassificacoes(
      classificacoes,
      inSelecionada && isTipoIN(tipoIN) ? tipoIN : null,
    );
    const acrescimosOperacionais = [
      ...(classificacaoFormatada ? [`*Classificação da ocorrência:* ${classificacaoFormatada}`] : []),
      `*ID do trem:* ${idTrem || 'Não informado'}`,
      `*Prefixo da viagem:* ${prefixoViagem || 'Não informado'}`,
    ].join('\n');
    const acrescentarInformacoesOperacionais = (mensagem: string) =>
      `${mensagem.trimEnd()}\n${acrescimosOperacionais}`;

    return NextResponse.json({
      comunicacao: incluirInformante(payload.comunicacao, informante),
      operacao: incluirInformante(acrescentarInformacoesOperacionais(payload.operacao), informante),
      gerencia: incluirInformante(acrescentarInformacoesOperacionais(payload.gerencia), informante),
    });
  } catch (error: unknown) {
    console.error('--- ERRO DETALHADO DO GEMINI ---');
    console.error(error);
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao processar ocorrência com IA.' },
      { status: status === 429 || status === 503 ? status : 500 }
    );
  }
}