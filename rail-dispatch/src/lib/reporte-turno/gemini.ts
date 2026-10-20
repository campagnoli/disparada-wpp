import { GoogleGenAI, Type } from '@google/genai';
import { isModeloGemini, modelosGemini } from '@/lib/gemini-models';
import {
  IMPACTO_OPERACAO_NORMAL,
  RESUMO_SEM_OCORRENCIAS,
} from '@/lib/reporte-turno/template-pure';
import {
  LINHAS_REPORTE,
  type EventosPorLinha,
  type NumeroLinha,
  type PeriodoReporte,
  type ResumosReporte,
} from '@/lib/reporte-turno/tipos';

interface ResumoGemini {
  ocorrencias?: unknown;
  impacto?: unknown;
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function normalizarTexto(valor: unknown, fallback: string): string {
  if (typeof valor !== 'string') return fallback;
  const texto = valor.trim().replace(/\s+/g, ' ').slice(0, 600);
  return texto || fallback;
}

export function criarResumosPadrao(eventos: EventosPorLinha): ResumosReporte {
  const resumos = {} as ResumosReporte;

  for (const linha of LINHAS_REPORTE) {
    const total = eventos[linha.numero].length;
    resumos[linha.numero] = {
      ocorrencias: total > 0
        ? 'Ocorrências registradas no período sem detalhamento adicional.'
        : RESUMO_SEM_OCORRENCIAS,
      impacto: total > 0
        ? 'Impacto operacional em avaliação.'
        : IMPACTO_OPERACAO_NORMAL,
      totalEventos: total,
    };
  }

  return resumos;
}

function normalizarResposta(
  valor: unknown,
  eventos: EventosPorLinha,
): ResumosReporte {
  const resumos = criarResumosPadrao(eventos);
  if (!isRecord(valor)) return resumos;

  for (const linha of LINHAS_REPORTE) {
    if (eventos[linha.numero].length === 0) continue;

    const chave = `l${linha.numero}`;
    const item = valor[chave];
    if (!isRecord(item)) continue;

    const resumo = item as ResumoGemini;
    resumos[linha.numero] = {
      ocorrencias: normalizarTexto(
        resumo.ocorrencias,
        resumos[linha.numero].ocorrencias,
      ),
      impacto: normalizarTexto(
        resumo.impacto,
        resumos[linha.numero].impacto,
      ),
      totalEventos: eventos[linha.numero].length,
    };
  }

  return resumos;
}

function montarDadosParaIA(periodo: PeriodoReporte, eventos: EventosPorLinha) {
  return {
    periodo: periodo.periodoLabel,
    turno: periodo.turnoLabel,
    linhas: LINHAS_REPORTE.map((linha) => ({
      linha: linha.nome,
      total_eventos: eventos[linha.numero].length,
      eventos: eventos[linha.numero].map((evento) => ({
        origem: evento.origem,
        registro: evento.registro,
        local: evento.local,
        falha: evento.falha,
        inicio: evento.inicio,
        fim: evento.fim,
        status: evento.status,
        cronologia: evento.cronologia,
        impacto_registrado: evento.impactoRegistrado,
      })),
    })),
  };
}

export async function compilarResumosComGemini(
  periodo: PeriodoReporte,
  eventos: EventosPorLinha,
): Promise<ResumosReporte> {
  const totalEventos = LINHAS_REPORTE.reduce(
    (total, linha) => total + eventos[linha.numero].length,
    0,
  );

  if (totalEventos === 0) {
    return criarResumosPadrao(eventos);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chave do Google Gemini não configurada.');
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

  const systemInstruction = [
    'Você é um assistente técnico do CCO ferroviário da ViaMobilidade.',
    'Compile as ocorrências do período por linha de forma extremamente concisa, técnica e objetiva.',
    'Para cada linha, produza no máximo duas frases curtas: o que aconteceu, o efeito na circulação e a resolução ou situação atual.',
    'Não invente fatos, horários, causas ou ações que não estejam nos dados.',
    'Não use saudações, introduções, conclusões, listas ou markdown.',
    `Se uma linha não tiver eventos, use exatamente "${RESUMO_SEM_OCORRENCIAS}" em ocorrências e "${IMPACTO_OPERACAO_NORMAL}" em impacto.`,
    'Se houver evento sem impacto relevante na circulação, use exatamente "Sem impacto operacional relevante".',
  ].join(' ');

  const generationOptions = {
    contents: `Compile o reporte deste período:\n${JSON.stringify(montarDadosParaIA(periodo, eventos))}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          l11: {
            type: Type.OBJECT,
            properties: {
              ocorrencias: { type: Type.STRING },
              impacto: { type: Type.STRING },
            },
            required: ['ocorrencias', 'impacto'],
          },
          l12: {
            type: Type.OBJECT,
            properties: {
              ocorrencias: { type: Type.STRING },
              impacto: { type: Type.STRING },
            },
            required: ['ocorrencias', 'impacto'],
          },
          l13: {
            type: Type.OBJECT,
            properties: {
              ocorrencias: { type: Type.STRING },
              impacto: { type: Type.STRING },
            },
            required: ['ocorrencias', 'impacto'],
          },
        },
        required: ['l11', 'l12', 'l13'],
      },
    },
  };

  const modeloConfigurado = process.env.GEMINI_REPORTE_MODEL;
  const modelo = isModeloGemini(modeloConfigurado)
    ? modeloConfigurado
    : 'gemini-3.1-flash-lite';
  const modelosTentativa: string[] = [
    modelo,
    ...modelosGemini
      .map((item) => item.id)
      .filter((id) => id !== modelo),
    'gemini-flash-lite-latest',
  ];

  let response: { text?: string } | undefined;
  let ultimoErro: unknown;

  for (const modeloAtual of modelosTentativa) {
    try {
      response = await ai.models.generateContent({
        model: modeloAtual,
        ...generationOptions,
      });
      break;
    } catch (error: unknown) {
      ultimoErro = error;
      const status = getErrorStatus(error);
      if (status === 503 || status === 429) {
        console.warn(
          `Reporte: modelo ${modeloAtual} indisponível (${status}). Tentando contingência.`,
        );
        continue;
      }
      throw error;
    }
  }

  if (!response) {
    throw ultimoErro instanceof Error
      ? ultimoErro
      : new Error('Não foi possível compilar o reporte com o Google Gemini.');
  }

  const texto = response.text?.trim();
  if (!texto) {
    throw new Error('O Google Gemini retornou uma resposta vazia para o reporte.');
  }

  const textoJson = texto
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let respostaJson: unknown;
  try {
    respostaJson = JSON.parse(textoJson) as unknown;
  } catch {
    throw new Error('O Google Gemini retornou um formato inválido para o reporte.');
  }

  return normalizarResposta(respostaJson, eventos);
}

export function contarEventos(eventos: EventosPorLinha): Record<NumeroLinha, number> {
  return {
    11: eventos[11].length,
    12: eventos[12].length,
    13: eventos[13].length,
  };
}
