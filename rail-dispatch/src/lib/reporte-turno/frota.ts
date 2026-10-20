import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  FROTA_PADRAO,
  normalizarConfiguracaoFrota,
} from '@/lib/reporte-turno/frota-pure';
import type { ConfiguracaoFrotaLinha } from '@/lib/reporte-turno/tipos';

const TABELA_FROTA = 'configuracao_frota_linhas';
const MIGRATION_REPORTE = '202610200004_reporte_turno.sql';

export function erroEstruturaReporte(error: { message?: string; code?: string }): boolean {
  const mensagem = error.message ?? '';
  return error.code === 'PGRST205'
    || error.code === 'PGRST204'
    || error.code === '42P01'
    || error.code === '42703'
    || /could not find the table/i.test(mensagem)
    || /could not find the .* column/i.test(mensagem)
    || /column .* does not exist/i.test(mensagem);
}

export function mensagemErroEstruturaReporte(): string {
  return `Estrutura do banco desatualizada para o Reporte de Turno. Aplique a migration ${MIGRATION_REPORTE} no Supabase.`;
}

export async function obterFrotaLinhas(): Promise<{
  linhas: ConfiguracaoFrotaLinha[];
  aviso?: string;
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(TABELA_FROTA)
    .select('*')
    .order('numero_linha', { ascending: true });

  if (error) {
    if (erroEstruturaReporte(error)) {
      return {
        linhas: normalizarConfiguracaoFrota(FROTA_PADRAO),
        aviso: mensagemErroEstruturaReporte(),
      };
    }
    throw new Error(error.message || 'Falha ao carregar a configuração de frota.');
  }

  return {
    linhas: normalizarConfiguracaoFrota(data ?? []),
  };
}

export async function salvarFrotaLinhas(
  linhas: ConfiguracaoFrotaLinha[],
): Promise<ConfiguracaoFrotaLinha[]> {
  const normalizadas = normalizarConfiguracaoFrota(linhas);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from(TABELA_FROTA)
    .upsert(
      normalizadas.map((linha) => ({
        numero_linha: linha.numero_linha,
        nome_linha: linha.nome_linha,
        trens_operacionais: linha.trens_operacionais,
        trens_reserva: linha.trens_reserva,
        ativo: linha.ativo,
        atualizado_em: new Date().toISOString(),
      })),
      { onConflict: 'numero_linha' },
    )
    .select('*')
    .order('numero_linha', { ascending: true });

  if (error) {
    throw new Error(
      erroEstruturaReporte(error)
        ? mensagemErroEstruturaReporte()
        : error.message || 'Falha ao salvar a configuração de frota.',
    );
  }

  return normalizarConfiguracaoFrota(data ?? normalizadas);
}
