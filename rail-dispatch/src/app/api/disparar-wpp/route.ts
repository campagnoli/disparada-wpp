import { NextResponse } from 'next/server';
import { obterConfiguracaoWhatsAppAtiva } from '@/lib/whatsapp-config';
import { finalizarMensagemComAssinaturaSCO } from '@/lib/mensagens';

const aguardar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tempoAleatorio = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(req: Request) {
  try {
    const { mensagens, grupos } = await req.json();

    // 1. Carrega as configurações ativas (Web/Supabase com fallback para .env.local)
    const { config } = await obterConfiguracaoWhatsAppAtiva();

    const apiUrl = config.apiUrl;
    const apiKey = config.apiKey;
    const instance = config.instanceName;

    const filaDisparo = [
      { id: 'comunicacao', nome: 'Comunicação', jid: config.grupos.comunicacao, texto: mensagens?.comunicacao },
      { id: 'operacao', nome: 'Operação CCO / Executivo', jid: config.grupos.operacao, texto: mensagens?.operacao },
      { id: 'gerencia', nome: 'Gerência / Órgão Regulador', jid: config.grupos.gerencia, texto: mensagens?.gerencia },
    ];

    const resultados = [];

    for (const item of filaDisparo) {
      if (Array.isArray(grupos) && !grupos.includes(item.id)) continue;
      if (!item.jid || !item.texto) continue;

      // 1. Simula status "digitando..." no grupo se habilitado
      if (config.antiBloqueio.simularDigitacao) {
        await fetch(`${apiUrl}/chat/sendPresence/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey || '',
          },
          body: JSON.stringify({
            number: item.jid,
            presence: 'composing',
            delay: 1000,
          }),
        }).catch(() => null);

        // 2. Tempo de espera proporcional ao tamanho do texto (definido na web / fallback 2.5s a 4.5s)
        const tempoDigitacao = tempoAleatorio(
          config.antiBloqueio.tempoDigitacaoMin,
          config.antiBloqueio.tempoDigitacaoMax
        );
        await aguardar(tempoDigitacao);
      }

      // 3. Envio efetivo da mensagem de texto
      const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey || '',
        },
        body: JSON.stringify({
          number: item.jid,
          text: finalizarMensagemComAssinaturaSCO(item.texto),
          linkPreview: false, // Evita disparar pré-visualizações pesadas de URL
        }),
      });

      const data = await res.json().catch(() => null);
      resultados.push({ grupo: item.nome, status: res.ok ? 'sucesso' : 'erro', detalhe: data });

      // 4. Pausa de respiro antes de passar para o próximo grupo (definido na web / fallback 3s a 6s)
      const pausaEntreGrupos = tempoAleatorio(
        config.antiBloqueio.pausaEntreGruposMin,
        config.antiBloqueio.pausaEntreGruposMax
      );
      await aguardar(pausaEntreGrupos);
    }

    return NextResponse.json({ sucesso: true, resultados });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha inesperada ao disparar mensagens.' },
      { status: 500 }
    );
  }
}
