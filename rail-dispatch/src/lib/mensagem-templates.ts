import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  TEMPLATES_MENSAGEM_PADRAO,
  CHAVE_CONFIG_TEMPLATES,
  TemplatesMensagem,
} from './mensagem-templates-pure';

export * from './mensagem-templates-pure';

const LOCAL_CONFIG_DIR = path.join(process.cwd(), 'src', 'config');
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'templates-mensagem.json');

function lerConfigLocal(): {
  templates?: Partial<TemplatesMensagem>;
  updated_at?: string;
} | null {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const conteudo = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf8');
      const json = JSON.parse(conteudo) as {
        templates?: Partial<TemplatesMensagem>;
        updated_at?: string;
      };
      if (json.templates && typeof json.templates === 'object') {
        return json;
      }
    }
  } catch {
    // Ignora erro de leitura local
  }
  return null;
}

function salvarConfigLocal(templates: TemplatesMensagem): void {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_DIR)) {
      fs.mkdirSync(LOCAL_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(
      LOCAL_CONFIG_FILE,
      JSON.stringify({ templates, updated_at: new Date().toISOString() }, null, 2),
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
 * Obtém os templates de mensagem ativos.
 * Prioridade: 1) Banco de dados Supabase, 2) Arquivo local, 3) Padrão de fábrica.
 */
export async function obterTemplatesMensagemAtivos(): Promise<{
  templates: TemplatesMensagem;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
}> {
  // 1. Tentar ler do Supabase
  try {
    const { data, error } = await supabase
      .from('configuracoes_sistema')
      .select('valor, updated_at')
      .eq('chave', CHAVE_CONFIG_TEMPLATES)
      .maybeSingle();

    if (!error && data && typeof data.valor === 'string') {
      try {
        const parsed = JSON.parse(data.valor) as Partial<TemplatesMensagem>;
        if (parsed.comunicacao || parsed.operacao || parsed.gerencia) {
          return {
            templates: {
              comunicacao: parsed.comunicacao ?? TEMPLATES_MENSAGEM_PADRAO.comunicacao,
              operacao: parsed.operacao ?? TEMPLATES_MENSAGEM_PADRAO.operacao,
              gerencia: parsed.gerencia ?? TEMPLATES_MENSAGEM_PADRAO.gerencia,
            },
            isCustom: true,
            updatedAt: data.updated_at || null,
            origem: 'supabase',
          };
        }
      } catch {
        // Se json corrompido, segue para fallback
      }
    }
  } catch {
    // Se a tabela não existir, segue para fallback
  }

  // 2. Tentar ler do arquivo local
  const local = lerConfigLocal();
  if (local && local.templates) {
    return {
      templates: {
        comunicacao: local.templates.comunicacao ?? TEMPLATES_MENSAGEM_PADRAO.comunicacao,
        operacao: local.templates.operacao ?? TEMPLATES_MENSAGEM_PADRAO.operacao,
        gerencia: local.templates.gerencia ?? TEMPLATES_MENSAGEM_PADRAO.gerencia,
      },
      isCustom: true,
      updatedAt: local.updated_at || null,
      origem: 'local',
    };
  }

  // 3. Padrão de fábrica
  return {
    templates: { ...TEMPLATES_MENSAGEM_PADRAO },
    isCustom: false,
    updatedAt: null,
    origem: 'padrao',
  };
}

/**
 * Salva templates customizados no Supabase (com fallback local).
 */
export async function salvarTemplatesMensagem(novosTemplates: TemplatesMensagem): Promise<{
  sucesso: boolean;
  salvoNoBanco: boolean;
  salvoLocalmente: boolean;
  erro?: string;
}> {
  const templatesNormalizados: TemplatesMensagem = {
    comunicacao: novosTemplates.comunicacao.trim() || TEMPLATES_MENSAGEM_PADRAO.comunicacao,
    operacao: novosTemplates.operacao.trim() || TEMPLATES_MENSAGEM_PADRAO.operacao,
    gerencia: novosTemplates.gerencia.trim() || TEMPLATES_MENSAGEM_PADRAO.gerencia,
  };

  const jsonString = JSON.stringify(templatesNormalizados);
  let salvoNoBanco = false;
  let erroBanco: string | undefined;

  // 1. Salvar no Supabase via Admin Client
  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from('configuracoes_sistema').upsert(
      {
        chave: CHAVE_CONFIG_TEMPLATES,
        valor: jsonString,
        descricao: 'Modelos/Templates de mensagens formatadas para cada grupo de WhatsApp (Comunicação, Operação, Gerência)',
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

  // 2. Salvar cópia local como garantia
  salvarConfigLocal(templatesNormalizados);

  return {
    sucesso: true,
    salvoNoBanco,
    salvoLocalmente: true,
    erro: erroBanco,
  };
}

/**
 * Restaura os templates de mensagem para o padrão de fábrica.
 */
export async function restaurarTemplatesPadrao(): Promise<{ sucesso: boolean }> {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from('configuracoes_sistema').delete().eq('chave', CHAVE_CONFIG_TEMPLATES);
  } catch {
    // Ignora erro se tabela não existir
  }

  removerConfigLocal();
  return { sucesso: true };
}
