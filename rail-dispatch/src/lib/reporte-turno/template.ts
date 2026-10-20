import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  CHAVE_CONFIG_TEMPLATE_REPORTE,
  TEMPLATE_REPORTE_PADRAO,
  templateReporteValido,
} from '@/lib/reporte-turno/template-pure';

const TABELA_CONFIG = 'configuracoes_sistema';

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function extrairTemplate(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor;
  if (isRecord(valor) && typeof valor.template === 'string' && valor.template.trim()) {
    return valor.template;
  }
  return null;
}

export interface TemplateReporteAtivo {
  template: string;
  isCustom: boolean;
  updatedAt: string | null;
  aviso?: string;
}

export async function obterTemplateReporteAtivo(): Promise<TemplateReporteAtivo> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from(TABELA_CONFIG)
      .select('valor, updated_at')
      .eq('chave', CHAVE_CONFIG_TEMPLATE_REPORTE)
      .maybeSingle();

    if (error) {
      return {
        template: TEMPLATE_REPORTE_PADRAO,
        isCustom: false,
        updatedAt: null,
        aviso: 'Não foi possível carregar o modelo personalizado do reporte. Usando o modelo padrão.',
      };
    }

    const template = extrairTemplate(data?.valor);
    if (template && templateReporteValido(template)) {
      return {
        template,
        isCustom: true,
        updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
      };
    }

    return {
      template: TEMPLATE_REPORTE_PADRAO,
      isCustom: false,
      updatedAt: null,
    };
  } catch {
    return {
      template: TEMPLATE_REPORTE_PADRAO,
      isCustom: false,
      updatedAt: null,
      aviso: 'Não foi possível carregar o modelo personalizado do reporte. Usando o modelo padrão.',
    };
  }
}

export async function salvarTemplateReporte(template: string): Promise<TemplateReporteAtivo> {
  const texto = template.trim();

  if (!texto) {
    throw new Error('O modelo do reporte não pode ficar vazio.');
  }

  if (!templateReporteValido(texto)) {
    throw new Error('O modelo do reporte não contém todas as tags obrigatórias.');
  }

  const admin = createSupabaseAdminClient();
  const atualizadoEm = new Date().toISOString();
  const { error } = await admin
    .from(TABELA_CONFIG)
    .upsert(
      {
        chave: CHAVE_CONFIG_TEMPLATE_REPORTE,
        valor: { template: texto },
        descricao: 'Modelo da mensagem do Reporte Operacional Periódico.',
        updated_at: atualizadoEm,
      },
      { onConflict: 'chave' },
    );

  if (error) {
    throw new Error(error.message || 'Falha ao salvar o modelo do reporte.');
  }

  return {
    template: texto,
    isCustom: true,
    updatedAt: atualizadoEm,
  };
}

export async function restaurarTemplateReporte(): Promise<TemplateReporteAtivo> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from(TABELA_CONFIG)
    .delete()
    .eq('chave', CHAVE_CONFIG_TEMPLATE_REPORTE);

  if (error) {
    throw new Error(error.message || 'Falha ao restaurar o modelo padrão do reporte.');
  }

  return {
    template: TEMPLATE_REPORTE_PADRAO,
    isCustom: false,
    updatedAt: null,
  };
}
