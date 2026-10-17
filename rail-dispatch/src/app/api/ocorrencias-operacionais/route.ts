import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';
import { formatarMensagemOcorrencia, type PayloadOcorrenciaOperacional } from '@/lib/formatadores/ocorrenciaOperacional';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/* ------------------------------------------------------------------ */
/* GET  – Listar ocorrências (ativas/recentes)                        */
/* ------------------------------------------------------------------ */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const apenasAndamento = url.searchParams.get('status') === 'em_andamento';
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20'), 1), 100);
  const from = (page - 1) * pageSize;

  try {
    const adminClient = createSupabaseAdminClient();

    let query = adminClient
      .from('ocorrencias_operacionais')
      .select(
        'id, linha, tipo_ocorrencia, local, horario, descritivo, cronologia, aas_asl, cps, status, group_id_whatsapp, mensagem_formatada, whatsapp_message_id, whatsapp_remote_jid, disparado_whatsapp, criado_em, atualizado_em',
        { count: 'exact' }
      )
      .order('criado_em', { ascending: false })
      .range(from, from + pageSize - 1);

    if (apenasAndamento) {
      query = query.eq('status', 'em_andamento');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Falha ao listar ocorrências operacionais:', error.message);
      return NextResponse.json({ error: 'Não foi possível listar as ocorrências.' }, { status: 500 });
    }

    return NextResponse.json({
      ocorrencias: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error: unknown) {
    console.error('Erro inesperado ao listar ocorrências operacionais:', error);
    return NextResponse.json(
      { error: 'Falha inesperada ao listar ocorrências.' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/* POST – Criar / Atualizar e (opcional) disparar WhatsApp            */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const id = getText(body.id);
  const linha = getText(body.linha);
  const tipoOcorrencia = getText(body.tipoOcorrencia);
  const local = getText(body.local);
  const horario = getText(body.horario);
  const descritivo = getText(body.descritivo);
  const aasAsl = getText(body.aasAsl) || null;
  const cps = getText(body.cps) || null;
  const status = getText(body.status) || 'em_andamento';
  const groupIdWhatsApp = getText(body.groupIdWhatsApp);
  const dispararWhatsApp = body.dispararWhatsApp === true;
  const houveEdicaoManual = body.houveEdicaoManual === true;

  const cronologiaRecebida = Array.isArray(body.cronologia) ? body.cronologia : [];

  // --- Validações de campos obrigatórios ---
  if (!linha) {
    return NextResponse.json({ error: 'Informe a linha.' }, { status: 400 });
  }
  if (!tipoOcorrencia) {
    return NextResponse.json({ error: 'Informe o tipo de ocorrência.' }, { status: 400 });
  }
  if (!local) {
    return NextResponse.json({ error: 'Informe o local (estação/trecho/plataforma).' }, { status: 400 });
  }
  if (!horario) {
    return NextResponse.json({ error: 'Informe o horário.' }, { status: 400 });
  }
  if (!descritivo) {
    return NextResponse.json({ error: 'Informe o descritivo.' }, { status: 400 });
  }
  if (!groupIdWhatsApp) {
    return NextResponse.json({ error: 'Informe o ID do grupo do WhatsApp.' }, { status: 400 });
  }
  if (!['em_andamento', 'encerrada'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido. Use "em_andamento" ou "encerrada".' }, { status: 400 });
  }

  // --- Valida e normaliza cronologia (ordena crescente por horário) ---
  const cronologiaValidada = cronologiaRecebida
    .filter((item: unknown) => isRecord(item))
    .map((item: Record<string, unknown>) => ({
      id: getText(item.id) || undefined,
      horario: getText(item.horario),
      texto: getText(item.texto),
    }))
    .filter((item) => Boolean(item.horario && item.texto))
    .sort((a, b) => a.horario.localeCompare(b.horario));

  // --- Formata a mensagem para WhatsApp (template obrigatório) ---
  const mensagemFormatada = formatarMensagemOcorrencia({
    linha,
    tipoOcorrencia,
    local,
    horario,
    descritivo,
    cronologia: cronologiaValidada,
    aasAsl: aasAsl || undefined,
    cps: cps || undefined,
  });

  const adminClient = createSupabaseAdminClient();
  let ocorrenciaSalva: Record<string, unknown> | null = null;

  try {
    const agora = new Date().toISOString();

    if (id) {
      // --- Atualização de ocorrência existente ---
      const updatePayload: Record<string, unknown> = {
        linha,
        tipo_ocorrencia: tipoOcorrencia,
        local,
        horario,
        descritivo,
        cronologia: cronologiaValidada,
        aas_asl: aasAsl,
        cps,
        status,
        group_id_whatsapp: groupIdWhatsApp,
        mensagem_formatada: mensagemFormatada,
        houve_edicao_manual: houveEdicaoManual,
        atualizado_em: agora,
      };

      const { data, error } = await adminClient
        .from('ocorrencias_operacionais')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Falha ao atualizar ocorrência operacional:', error.message);
        return NextResponse.json({ error: 'Não foi possível atualizar a ocorrência.' }, { status: 500 });
      }

      ocorrenciaSalva = data;
    } else {
      // --- Criação de nova ocorrência ---
      const { data, error } = await adminClient
        .from('ocorrencias_operacionais')
        .insert({
          linha,
          tipo_ocorrencia: tipoOcorrencia,
          local,
          horario,
          descritivo,
          cronologia: cronologiaValidada,
          aas_asl: aasAsl,
          cps,
          status,
          group_id_whatsapp: groupIdWhatsApp,
          mensagem_formatada: mensagemFormatada,
          disparado_whatsapp: false,
          houve_edicao_manual: houveEdicaoManual,
          criado_em: agora,
          atualizado_em: agora,
        })
        .select()
        .single();

      if (error) {
        console.error('Falha ao criar ocorrência operacional:', error.message);
        return NextResponse.json({ error: 'Não foi possível criar a ocorrência.' }, { status: 500 });
      }

      ocorrenciaSalva = data;
    }
  } catch (error: unknown) {
    console.error('Erro inesperado ao salvar ocorrência operacional:', error);
    return NextResponse.json(
      { error: 'Falha inesperada ao salvar a ocorrência.' },
      { status: 500 }
    );
  }

  const ocorrenciaId = ocorrenciaSalva?.id as string | undefined;

  // --- Disparo via WhatsApp (Evolution API) ---
  let whatsappResultado: { sucesso: boolean; messageId?: string; remoteJid?: string; erro?: string } = {
    sucesso: false,
  };

  if (dispararWhatsApp && ocorrenciaId) {
    try {
      const { config } = await obterConfiguracaoWhatsAppAtiva();
      const apiUrl = config.apiUrl;
      const apiKey = config.apiKey;
      const instance = config.instanceName;

      const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey || '',
        },
        body: JSON.stringify({
          number: groupIdWhatsApp,
          text: mensagemFormatada,
          linkPreview: false,
        }),
      });

      const respostaJson = (await res.json().catch(() => null)) as
        | { key?: { id?: string; remoteJid?: string }; [key: string]: unknown }
        | null;

      const messageId = respostaJson?.key?.id;
      const remoteJid = respostaJson?.key?.remoteJid;

      whatsappResultado = {
        sucesso: res.ok,
        messageId,
        remoteJid,
        erro: res.ok ? undefined : `HTTP ${res.status}`,
      };

      // Persiste os IDs da mensagem WhatsApp para futuras exclusões/atualizações
      await adminClient
        .from('ocorrencias_operacionais')
        .update({
          disparado_whatsapp: whatsappResultado.sucesso,
          whatsapp_message_id: messageId ?? null,
          whatsapp_remote_jid: remoteJid ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', ocorrenciaId);
    } catch (err: unknown) {
      console.error('Erro ao disparar WhatsApp:', err);
      whatsappResultado = {
        sucesso: false,
        erro: err instanceof Error ? err.message : 'Falha ao disparar mensagem no WhatsApp.',
      };
    }
  }

  // --- Integração com aprendizado do Gemini (edições manuais) ---
  if (houveEdicaoManual && ocorrenciaId) {
    try {
      await adminClient.from('aprendizado_despachos').insert({
        linha,
        tipo_evento: tipoOcorrencia,
        dados_ocorrencia: {
          linha,
          tipo_ocorrencia: tipoOcorrencia,
          local,
          horario,
          descritivo,
          cronologia: cronologiaValidada,
          aas_asl: aasAsl,
          cps,
          status,
          group_id_whatsapp: groupIdWhatsApp,
        },
        mensagem_ia: mensagemFormatada,
        mensagem_final_sco: mensagemFormatada,
        tipo_grupo: 'operacao',
        houve_edicao: true,
      });
    } catch (err: unknown) {
      // Não falha a requisição principal se o aprendizado não puder ser salvo
      console.error('Falha ao salvar exemplo de aprendizado:', err);
    }
  }

  return NextResponse.json(
    {
      success: true,
      id: ocorrenciaId,
      mensagemFormatada,
    },
    { status: 201 }
  );
}

/* ------------------------------------------------------------------ */
/* PATCH – Atualizar cronologia de ocorrência operacional existente   */
/* ------------------------------------------------------------------ */
export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const id = getText(body.id);
  const cronologiaRecebida = Array.isArray(body.cronologia) ? body.cronologia : [];
  const status = getText(body.status);
  const aasAsl = getText(body.aasAsl) || null;
  const cps = getText(body.cps) || null;
  const descritivo = getText(body.descritivo);
  const horario = getText(body.horario);
  const local = getText(body.local);
  const linha = getText(body.linha);
  const tipoOcorrencia = getText(body.tipoOcorrencia);

  if (!id) {
    return NextResponse.json({ error: 'ID da ocorrência é obrigatório.' }, { status: 400 });
  }

  // Valida e normaliza cronologia
  const cronologiaValidada = cronologiaRecebida
    .filter((item: unknown) => isRecord(item))
    .map((item: Record<string, unknown>) => ({
      id: getText(item.id) || undefined,
      horario: getText(item.horario),
      texto: getText(item.texto),
    }))
    .filter((item) => Boolean(item.horario && item.texto))
    .sort((a, b) => a.horario.localeCompare(b.horario));

  if (cronologiaValidada.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um item de cronologia válido.' }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();

  // Busca a ocorrência existente para manter os dados não alterados
  const { data: existente, error: erroBusca } = await adminClient
    .from('ocorrencias_operacionais')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !existente) {
    return NextResponse.json({ error: 'Ocorrência operacional não encontrada.' }, { status: 404 });
  }

  // Monta os dados para formatação da mensagem
  const dadosParaFormatar: PayloadOcorrenciaOperacional = {
    linha: linha || (existente.linha as string),
    tipoOcorrencia: tipoOcorrencia || (existente.tipo_ocorrencia as string),
    local: local || (existente.local as string),
    horario: horario || (existente.horario as string),
    descritivo: descritivo || (existente.descritivo as string),
    cronologia: cronologiaValidada,
    aasAsl: aasAsl ?? (existente.aas_asl as string | null) ?? undefined,
    cps: cps ?? (existente.cps as string | null) ?? undefined,
  };

  const mensagemFormatada = formatarMensagemOcorrencia(dadosParaFormatar);

  const updatePayload: Record<string, unknown> = {
    cronologia: cronologiaValidada,
    mensagem_formatada: mensagemFormatada,
    atualizado_em: new Date().toISOString(),
  };

  if (status) updatePayload.status = status;
  if (aasAsl !== null) updatePayload.aas_asl = aasAsl;
  if (cps !== null) updatePayload.cps = cps;
  if (descritivo) updatePayload.descritivo = descritivo;
  if (horario) updatePayload.horario = horario;
  if (local) updatePayload.local = local;
  if (linha) updatePayload.linha = linha;
  if (tipoOcorrencia) updatePayload.tipo_ocorrencia = tipoOcorrencia;

  const { data, error } = await adminClient
    .from('ocorrencias_operacionais')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Falha ao atualizar cronologia da ocorrência operacional:', error.message);
    return NextResponse.json({ error: 'Não foi possível atualizar a ocorrência.' }, { status: 500 });
  }

  // Salva no aprendizado se houver edição manual
  if (body.houveEdicaoManual === true) {
    try {
      await adminClient.from('aprendizado_despachos').insert({
        linha: dadosParaFormatar.linha,
        tipo_evento: dadosParaFormatar.tipoOcorrencia,
        dados_ocorrencia: dadosParaFormatar,
        mensagem_ia: mensagemFormatada,
        mensagem_final_sco: mensagemFormatada,
        tipo_grupo: 'operacao',
        houve_edicao: true,
      });
    } catch (err: unknown) {
      console.error('Falha ao salvar exemplo de aprendizado:', err);
    }
  }

  return NextResponse.json({
    success: true,
    id,
    mensagemFormatada,
    cronologia: cronologiaValidada,
  });
}
