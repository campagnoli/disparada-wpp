import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  TEMPLATES_MENSAGEM_PADRAO,
  CHAVE_CONFIG_TEMPLATES,
  TemplatesGrupoMensagem,
  TemplatesMensagem,
  modeloEncerramentoValido,
} from './mensagem-templates-pure';

export * from './mensagem-templates-pure';

const LOCAL_CONFIG_DIR = path.join(process.cwd(), 'src', 'config');
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'templates-mensagem.json');

function normalizarTemplatesMensagem(valor: unknown): TemplatesMensagem | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const dados = valor as Record<string, unknown>;
  const normal = typeof dados.normal === 'object' && dados.normal !== null
    ? dados.normal as Record<string, unknown>
    : dados;
  const encerramento = typeof dados.encerramento === 'object' && dados.encerramento !== null
    ? dados.encerramento as Record<string, unknown>
    : {};
  const hasTemplates = ['comunicacao', 'operacao', 'gerencia'].some(
    (key) => typeof normal[key] === 'string' && (normal[key] as string).trim(),
  );
  if (!hasTemplates) return null;
  const normalizados = (grupo: Record<string, unknown>, padrao: TemplatesGrupoMensagem): TemplatesGrupoMensagem => ({
    comunicacao: typeof grupo.comunicacao === 'string' && grupo.comunicacao.trim()
      ? grupo.comunicacao
      : padrao.comunicacao,
    operacao: typeof grupo.operacao === 'string' && grupo.operacao.trim()
      ? grupo.operacao
      : padrao.operacao,
    gerencia: typeof grupo.gerencia === 'string' && grupo.gerencia.trim()
      ? grupo.gerencia
      : padrao.gerencia,
  });
  const modelosNormais = normalizados(normal, TEMPLATES_MENSAGEM_PADRAO);
  const modelosEncerramento = normalizados(encerramento, TEMPLATES_MENSAGEM_PADRAO.encerramento);
  for (const grupo of ['comunicacao', 'operacao', 'gerencia'] as const) {
    if (!modeloEncerramentoValido(modelosEncerramento[grupo])) {
      modelosEncerramento[grupo] = TEMPLATES_MENSAGEM_PADRAO.encerramento[grupo];
    }
  }

  return { ...modelosNormais, encerramento: modelosEncerramento };
}

function lerConfigLocal(): {
  templates?: unknown;
  updated_at?: string;
} | null {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const conteudo = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf8');
      const json = JSON.parse(conteudo) as {
        templates?: unknown;
        updated_at?: string;
      };
      if (normalizarTemplatesMensagem(json.templates)) {
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
        const parsed: unknown = JSON.parse(data.valor);
        const templates = normalizarTemplatesMensagem(parsed);
        if (templates) {
          return {
            templates,
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
    const templates = normalizarTemplatesMensagem(local.templates);
    if (!templates) {
      throw new Error('Os modelos de mensagem locais estão inválidos.');
    }
    return {
      templates,
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
  if (Object.values(novosTemplates.encerramento).some((template) => !modeloEncerramentoValido(template))) {
    throw new Error('Cada modelo de encerramento deve conter as variáveis {{TITULO}}, {{HORA_INICIO}}, {{HORA_FIM}} e {{DURACAO}}.');
  }
  const templatesNormalizados: TemplatesMensagem = {
    comunicacao: novosTemplates.comunicacao.trim() || TEMPLATES_MENSAGEM_PADRAO.comunicacao,
    operacao: novosTemplates.operacao.trim() || TEMPLATES_MENSAGEM_PADRAO.operacao,
    gerencia: novosTemplates.gerencia.trim() || TEMPLATES_MENSAGEM_PADRAO.gerencia,
    encerramento: {
      comunicacao: novosTemplates.encerramento.comunicacao.trim() || TEMPLATES_MENSAGEM_PADRAO.encerramento.comunicacao,
      operacao: novosTemplates.encerramento.operacao.trim() || TEMPLATES_MENSAGEM_PADRAO.encerramento.operacao,
      gerencia: novosTemplates.encerramento.gerencia.trim() || TEMPLATES_MENSAGEM_PADRAO.encerramento.gerencia,
    },
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
