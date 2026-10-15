import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const TIPOS_GRUPO = ['comunicacao', 'operacao', 'gerencia'] as const;

type TipoGrupo = (typeof TIPOS_GRUPO)[number];

interface ExemploFeedback {
  tipo_grupo: TipoGrupo;
  mensagem_ia: string;
  mensagem_final_sco: string;
  houve_edicao: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExemploFeedback(value: unknown): value is ExemploFeedback {
  if (!isRecord(value)) return false;

  return TIPOS_GRUPO.some((tipo) => tipo === value.tipo_grupo)
    && typeof value.mensagem_ia === 'string'
    && value.mensagem_ia.length <= 12_000
    && typeof value.mensagem_final_sco === 'string'
    && value.mensagem_final_sco.trim().length > 0
    && value.mensagem_final_sco.length <= 12_000
    && typeof value.houve_edicao === 'boolean';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 50_000) {
      return NextResponse.json({ error: 'O feedback excede o tamanho permitido.' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (
    !isRecord(body)
    || !isRecord(body.dadosOcorrencia)
    || !Array.isArray(body.exemplos)
    || body.exemplos.length === 0
    || body.exemplos.length > TIPOS_GRUPO.length
  ) {
    return NextResponse.json({ error: 'Dados de feedback inválidos.' }, { status: 400 });
  }

  const dadosOcorrencia = body.dadosOcorrencia;
  const linha = typeof dadosOcorrencia.linha === 'string' ? dadosOcorrencia.linha.trim() : '';
  const falha = typeof dadosOcorrencia.falha === 'string' ? dadosOcorrencia.falha.trim() : '';
  const classificacoes = Array.isArray(dadosOcorrencia.classificacoes)
    ? dadosOcorrencia.classificacoes.filter((value): value is string => typeof value === 'string')
    : [];
  const tipoEvento = falha || classificacoes.join(', ');

  if (!linha || linha.length > 100 || !tipoEvento || tipoEvento.length > 2_000) {
    return NextResponse.json({ error: 'Linha ou tipo do evento inválido.' }, { status: 400 });
  }

  if (!body.exemplos.every(isExemploFeedback)) {
    return NextResponse.json({ error: 'Um ou mais exemplos de feedback são inválidos.' }, { status: 400 });
  }

  const dadosJson = JSON.stringify(dadosOcorrencia);
  if (dadosJson.length > 30_000) {
    return NextResponse.json({ error: 'Os dados da ocorrência excedem o tamanho permitido.' }, { status: 413 });
  }

  const linhas = (body.exemplos as ExemploFeedback[]).map((exemplo) => ({
    linha,
    tipo_evento: tipoEvento,
    dados_ocorrencia: dadosOcorrencia,
    mensagem_ia: exemplo.mensagem_ia,
    mensagem_final_sco: exemplo.mensagem_final_sco,
    tipo_grupo: exemplo.tipo_grupo,
    houve_edicao: exemplo.houve_edicao,
  }));

  try {
    const { error } = await createSupabaseAdminClient()
      .from('aprendizado_despachos')
      .insert(linhas);

    if (error) {
      console.error('Falha ao persistir feedback dos despachos:', error.message);
      return NextResponse.json({ error: 'Não foi possível salvar o feedback dos despachos.' }, { status: 500 });
    }

    return NextResponse.json({ sucesso: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('Falha ao persistir feedback dos despachos:', error);
    return NextResponse.json({ error: 'Não foi possível salvar o feedback dos despachos.' }, { status: 500 });
  }
}
