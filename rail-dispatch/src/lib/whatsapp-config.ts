import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface ConfiguracaoWhatsApp {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  grupos: {
    comunicacao: string;
    operacao: string;
    gerencia: string;
  };
  antiBloqueio: {
    simularDigitacao: boolean;
    tempoDigitacaoMin: number; // ms
    tempoDigitacaoMax: number; // ms
    pausaEntreGruposMin: number; // ms
    pausaEntreGruposMax: number; // ms
  };
}

export const CHAVE_CONFIG_WHATSAPP = 'configuracao_whatsapp';

const LOCAL_CONFIG_DIR = path.join(process.cwd(), 'src', 'config');
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'whatsapp-config.json');

/**
 * Obtém os valores padrão a partir das variáveis de ambiente (.env.local)
 */
export function obterConfiguracaoWhatsAppPadrao(): ConfiguracaoWhatsApp {
  return {
    apiUrl: (process.env.EVOLUTION_API_URL || 'http://3.129.22.114:8080').trim().replace(/\/+$/, ''),
    apiKey: (process.env.EVOLUTION_API_KEY || '').trim(),
    instanceName: (process.env.EVOLUTION_INSTANCE_NAME || 'cco_despacho').trim(),
    grupos: {
      comunicacao: (process.env.GROUP_ID_COMUNICACAO || '120363384961563518@g.us').trim(),
      operacao: (process.env.GROUP_ID_OPERACAO || '120363420044955952@g.us').trim(),
      gerencia: (process.env.GROUP_ID_GERENCIA || '120363305531028865@g.us').trim(),
    },
    antiBloqueio: {
      simularDigitacao: true,
      tempoDigitacaoMin: 2500,
      tempoDigitacaoMax: 4500,
      pausaEntreGruposMin: 3000,
      pausaEntreGruposMax: 6000,
    },
  };
}

function lerConfigLocal(): {
  config?: Partial<ConfiguracaoWhatsApp>;
  updated_at?: string;
} | null {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const conteudo = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf8');
      const json = JSON.parse(conteudo) as {
        config?: Partial<ConfiguracaoWhatsApp>;
        updated_at?: string;
      };
      if (json.config && typeof json.config === 'object') {
        return json;
      }
    }
  } catch {
    // Ignora erro de leitura local
  }
  return null;
}

function salvarConfigLocal(config: ConfiguracaoWhatsApp): void {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_DIR)) {
      fs.mkdirSync(LOCAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(
      LOCAL_CONFIG_FILE,
      JSON.stringify({ config, updated_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {
    // Ignora erro de escrita local
  }
}

function removerConfigLocal(): void {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      fs.unlinkSync(LOCAL_CONFIG_FILE);
    }
  } catch {
    // Ignora erro
  }
}

/**
 * Mescla configurações parciais com o padrão
 */
function mesclarConfig(parcial: Partial<ConfiguracaoWhatsApp>): ConfiguracaoWhatsApp {
  const padrao = obterConfiguracaoWhatsAppPadrao();
  return {
    apiUrl: parcial.apiUrl ? parcial.apiUrl.trim().replace(/\/+$/, '') : padrao.apiUrl,
    apiKey: parcial.apiKey !== undefined ? parcial.apiKey.trim() : padrao.apiKey,
    instanceName: parcial.instanceName ? parcial.instanceName.trim() : padrao.instanceName,
    grupos: {
      comunicacao: parcial.grupos?.comunicacao?.trim() || padrao.grupos.comunicacao,
      operacao: parcial.grupos?.operacao?.trim() || padrao.grupos.operacao,
      gerencia: parcial.grupos?.gerencia?.trim() || padrao.grupos.gerencia,
    },
    antiBloqueio: {
      simularDigitacao: parcial.antiBloqueio?.simularDigitacao ?? padrao.antiBloqueio.simularDigitacao,
      tempoDigitacaoMin: Number(parcial.antiBloqueio?.tempoDigitacaoMin) || padrao.antiBloqueio.tempoDigitacaoMin,
      tempoDigitacaoMax: Number(parcial.antiBloqueio?.tempoDigitacaoMax) || padrao.antiBloqueio.tempoDigitacaoMax,
      pausaEntreGruposMin: Number(parcial.antiBloqueio?.pausaEntreGruposMin) || padrao.antiBloqueio.pausaEntreGruposMin,
      pausaEntreGruposMax: Number(parcial.antiBloqueio?.pausaEntreGruposMax) || padrao.antiBloqueio.pausaEntreGruposMax,
    },
  };
}

/**
 * Obtém a configuração ativa de WhatsApp/Evolution API.
 * Prioridade: 1) Banco de dados Supabase, 2) Arquivo local, 3) Padrão (.env.local)
 */
export async function obterConfiguracaoWhatsAppAtiva(): Promise<{
  config: ConfiguracaoWhatsApp;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
}> {
  // 1. Tentar ler do Supabase
  try {
    const { data, error } = await supabase
      .from('configuracoes_sistema')
      .select('valor, updated_at')
      .eq('chave', CHAVE_CONFIG_WHATSAPP)
      .maybeSingle();

    if (!error && data && typeof data.valor === 'string') {
      try {
        const parsed = JSON.parse(data.valor) as Partial<ConfiguracaoWhatsApp>;
        if (parsed.apiUrl || parsed.instanceName || parsed.grupos) {
          return {
            config: mesclarConfig(parsed),
            isCustom: true,
            updatedAt: data.updated_at || null,
            origem: 'supabase',
          };
        }
      } catch {
        // Formato corrompido, segue para fallback
      }
    }
  } catch {
    // Tabela indisponível, segue para fallback
  }

  // 2. Tentar ler de arquivo local
  const local = lerConfigLocal();
  if (local && local.config) {
    return {
      config: mesclarConfig(local.config),
      isCustom: true,
      updatedAt: local.updated_at || null,
      origem: 'local',
    };
  }

  // 3. Padrão de fábrica (.env.local)
  return {
    config: obterConfiguracaoWhatsAppPadrao(),
    isCustom: false,
    updatedAt: null,
    origem: 'padrao',
  };
}

/**
 * Salva a configuração de WhatsApp no Supabase e localmente.
 */
export async function salvarConfiguracaoWhatsApp(novaConfig: ConfiguracaoWhatsApp): Promise<{
  sucesso: boolean;
  salvoNoBanco: boolean;
  salvoLocalmente: boolean;
  erro?: string;
}> {
  const configCompleta = mesclarConfig(novaConfig);
  const jsonString = JSON.stringify(configCompleta, null, 2);
  let salvoNoBanco = false;
  let erroBanco: string | undefined;

  // 1. Salvar no Supabase
  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from('configuracoes_sistema').upsert(
      {
        chave: CHAVE_CONFIG_WHATSAPP,
        valor: jsonString,
        descricao: 'Configurações de conexão da Evolution API v2, IDs de grupos do CCO e parâmetros anti-bloqueio',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    );

    if (error) {
      erroBanco = error.message;
    } else {
      salvoNoBanco = true;
    }
  } catch (err: unknown) {
    erroBanco = err instanceof Error ? err.message : 'Falha ao conectar no Supabase';
  }

  // 2. Salvar cópia local
  salvarConfigLocal(configCompleta);

  return {
    sucesso: true,
    salvoNoBanco,
    salvoLocalmente: true,
    erro: erroBanco,
  };
}

/**
 * Restaura as configurações para os padrões de fábrica (.env.local)
 */
export async function restaurarConfiguracaoWhatsAppPadrao(): Promise<{ sucesso: boolean }> {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from('configuracoes_sistema').delete().eq('chave', CHAVE_CONFIG_WHATSAPP);
  } catch {
    // Ignora erro
  }

  removerConfigLocal();
  return { sucesso: true };
}

/**
 * Testa o estado de conexão da instância na Evolution API
 */
export async function testarConexaoEvolution(config: ConfiguracaoWhatsApp): Promise<{
  ok: boolean;
  status: string;
  detalhe?: unknown;
  erro?: string;
}> {
  try {
    const url = `${config.apiUrl}/instance/connectionState/${encodeURIComponent(config.instanceName)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      const state = (data as { instance?: { state?: string } })?.instance?.state || (data as { state?: string })?.state || 'open';
      return {
        ok: true,
        status: state,
        detalhe: data,
      };
    }

    return {
      ok: false,
      status: `HTTP ${res.status}`,
      erro: (data as { message?: string })?.message || `Falha HTTP ${res.status} retornada pela Evolution API.`,
      detalhe: data,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 'erro_conexao',
      erro: err instanceof Error ? err.message : 'Não foi possível conectar com o servidor da Evolution API.',
    };
  }
}
