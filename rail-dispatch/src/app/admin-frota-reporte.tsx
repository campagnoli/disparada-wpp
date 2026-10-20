'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  Save,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import {
  FROTA_PADRAO,
  comporStatusFrota,
  criarEstadosFrota,
  normalizarConfiguracaoFrota,
} from '@/lib/reporte-turno/frota-pure';
import {
  TAGS_TEMPLATE_REPORTE,
  TEMPLATE_REPORTE_PADRAO,
  aplicarTemplateReporte,
  templateReporteValido,
} from '@/lib/reporte-turno/template-pure';
import type {
  ConfiguracaoFrotaLinha,
  NumeroLinha,
  ResumosReporte,
} from '@/lib/reporte-turno/tipos';
import WhatsAppPreview from '@/components/whatsapp-preview';

interface AdminFrotaReporteProps {
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

interface RespostaConfiguracao {
  frota: ConfiguracaoFrotaLinha[];
  template: string;
  templatePadrao: string;
  isCustom: boolean;
  updatedAt: string | null;
  aviso?: string;
  error?: string;
}

const RESUMOS_EXEMPLO: ResumosReporte = {
  11: {
    ocorrencias: 'Falha de via entre Guaianases e José Bonifácio, com circulação em via única e intervalos maiores.',
    impacto: 'Operação normalizada às 08h40, sem restrições remanescentes.',
    totalEventos: 1,
  },
  12: {
    ocorrencias: 'Sem ocorrências operacionais relevantes no período',
    impacto: 'Operação dentro dos padrões normais',
    totalEventos: 0,
  },
  13: {
    ocorrencias: 'Sem ocorrências operacionais relevantes no período',
    impacto: 'Operação dentro dos padrões normais',
    totalEventos: 0,
  },
};

export default function AdminFrotaReporte({
  onNotificarErro,
  onNotificarSucesso,
}: AdminFrotaReporteProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [frota, setFrota] = useState<ConfiguracaoFrotaLinha[]>(FROTA_PADRAO);
  const [template, setTemplate] = useState(TEMPLATE_REPORTE_PADRAO);
  const [templateOriginal, setTemplateOriginal] = useState(TEMPLATE_REPORTE_PADRAO);
  const [templateCustomizado, setTemplateCustomizado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      setCarregando(true);
      setErro('');

      try {
        const resposta = await fetch('/api/admin/reporte', { cache: 'no-store' });
        const dados = (await resposta.json().catch(() => null)) as RespostaConfiguracao | null;

        if (!resposta.ok) {
          throw new Error(dados?.error || 'Falha ao carregar a configuração do reporte.');
        }

        if (!ativo || !dados) return;

        setFrota(normalizarConfiguracaoFrota(dados.frota));
        setTemplate(dados.template || dados.templatePadrao || TEMPLATE_REPORTE_PADRAO);
        setTemplateOriginal(dados.template || dados.templatePadrao || TEMPLATE_REPORTE_PADRAO);
        setTemplateCustomizado(Boolean(dados.isCustom));
        setAviso(dados.aviso || '');
      } catch (error: unknown) {
        if (!ativo) return;
        const mensagem = error instanceof Error
          ? error.message
          : 'Falha ao carregar a configuração do reporte.';
        setErro(mensagem);
        onNotificarErro?.(error, 'Configuração do Reporte');
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, [onNotificarErro]);

  const templateInvalido = !templateReporteValido(template);
  const statusPreview = Object.fromEntries(
    criarEstadosFrota(frota).map((linha) => [
      linha.numeroLinha,
      comporStatusFrota(linha),
    ]),
  ) as Record<NumeroLinha, string>;
  const preview = aplicarTemplateReporte(template, {
    data: '20/10/2026',
    turnoHorario: '09h',
    statusFrota: statusPreview,
    resumos: RESUMOS_EXEMPLO,
    sco: 'João Silva',
  });

  const atualizarLinha = (
    numero: number,
    campo: 'trens_operacionais' | 'trens_reserva',
    valor: number,
  ) => {
    setFrota((anterior) => anterior.map((linha) => (
      linha.numero_linha === numero
        ? { ...linha, [campo]: valor }
        : linha
    )));
  };

  const salvar = async () => {
    if (templateInvalido) {
      setErro('O modelo do reporte não contém todas as tags obrigatórias.');
      return;
    }

    setSalvando(true);
    setErro('');
    setAviso('');

    const payload: { frota: ConfiguracaoFrotaLinha[]; template?: string } = { frota };
    if (templateCustomizado || template !== templateOriginal) payload.template = template;

    try {
      const resposta = await fetch('/api/admin/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const dados = (await resposta.json().catch(() => null)) as RespostaConfiguracao | null;

      if (!resposta.ok) {
        throw new Error(dados?.error || 'Falha ao salvar a configuração do reporte.');
      }

      if (dados) {
        setFrota(normalizarConfiguracaoFrota(dados.frota));
        setTemplate(dados.template);
        setTemplateOriginal(dados.template);
        setTemplateCustomizado(Boolean(dados.isCustom));
        setAviso(dados.aviso || 'Configuração do reporte salva.');
      }

      onNotificarSucesso?.(
        'Reporte configurado',
        'A frota nominal e o modelo da mensagem do Reporte de Turno foram atualizados.',
      );
    } catch (error: unknown) {
      const mensagem = error instanceof Error
        ? error.message
        : 'Falha ao salvar a configuração do reporte.';
      setErro(mensagem);
      onNotificarErro?.(error, 'Salvar Configuração do Reporte');
    } finally {
      setSalvando(false);
    }
  };

  const restaurar = async () => {
    if (!window.confirm('Restaurar o modelo padrão do Reporte de Turno? As alterações do texto serão perdidas.')) {
      return;
    }

    setRestaurando(true);
    setErro('');
    setAviso('');

    try {
      const resposta = await fetch('/api/admin/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurarTemplate: true }),
      });
      const dados = (await resposta.json().catch(() => null)) as RespostaConfiguracao | null;

      if (!resposta.ok) {
        throw new Error(dados?.error || 'Falha ao restaurar o modelo padrão.');
      }

      if (dados) {
        setTemplate(dados.template);
        setTemplateOriginal(dados.template);
        setTemplateCustomizado(false);
        setAviso('Modelo padrão restaurado.');
      }

      onNotificarSucesso?.(
        'Modelo restaurado',
        'O Reporte de Turno voltou a usar o modelo padrão de mensagem.',
      );
    } catch (error: unknown) {
      const mensagem = error instanceof Error
        ? error.message
        : 'Falha ao restaurar o modelo padrão.';
      setErro(mensagem);
      onNotificarErro?.(error, 'Restaurar Modelo do Reporte');
    } finally {
      setRestaurando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Carregando configuração do Reporte de Turno...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600">
          Ajustes aplicados à frota nominal e ao modelo da mensagem dos reportes das
          09h e 21h. Os grupos de envio continuam sendo configurados em
          &quot;Conexão WhatsApp e Grupos&quot;.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void restaurar()}
            disabled={restaurando || salvando}
            className="btn btn-secondary btn-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${restaurando ? 'animate-spin' : ''}`} />
            Restaurar modelo
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || restaurando || templateInvalido}
            className="btn btn-safira btn-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>

      {erro && <p className="text-sm text-rose-700" role="alert">{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700" role="status">{aviso}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <TrainFront className="h-4 w-4 text-coral" />
          <h3 className="text-sm font-semibold text-slate-800">Frota nominal por linha</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          A composição nominal é usada no texto padrão: operacionais + reserva.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Linha</th>
                <th className="pb-2 pr-3 font-semibold">Trens operacionais</th>
                <th className="pb-2 pr-3 font-semibold">Reserva</th>
                <th className="pb-2 pr-3 font-semibold">Composição</th>
              </tr>
            </thead>
            <tbody>
              {frota.map((linha) => (
                <tr key={linha.numero_linha} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          linha.numero_linha === 11
                            ? 'bg-coral'
                            : linha.numero_linha === 12
                              ? 'bg-safira'
                              : 'bg-jade'
                        }`}
                      />
                      {linha.nome_linha}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={linha.trens_operacionais}
                      onChange={(event) => atualizarLinha(
                        linha.numero_linha,
                        'trens_operacionais',
                        Math.max(0, Math.min(999, Math.trunc(Number(event.target.value) || 0))),
                      )}
                      className="form-control w-28"
                      aria-label={`Trens operacionais da ${linha.nome_linha}`}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={linha.trens_reserva}
                      onChange={(event) => atualizarLinha(
                        linha.numero_linha,
                        'trens_reserva',
                        Math.max(0, Math.min(999, Math.trunc(Number(event.target.value) || 0))),
                      )}
                      className="form-control w-24"
                      aria-label={`Trens reserva da ${linha.nome_linha}`}
                    />
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-600">
                    ({linha.trens_operacionais}+{linha.trens_reserva})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-800">Modelo da mensagem</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Use as tags abaixo. O texto final continua editável na aba Reporte antes do envio.
          </p>

          <textarea
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            rows={18}
            spellCheck={false}
            className="form-control mt-3 w-full font-mono text-xs leading-5"
            aria-label="Modelo da mensagem do Reporte de Turno"
          />

          {templateInvalido && (
            <p className="mt-2 flex items-start gap-2 text-xs text-rose-700" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O modelo precisa conter todas as tags obrigatórias listadas ao lado.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {TAGS_TEMPLATE_REPORTE.map((item) => (
              <span
                key={item.tag}
                title={item.descricao}
                className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600"
              >
                {item.tag}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Prévia no WhatsApp</h3>
          </div>
          <WhatsAppPreview
            titulo="Reporte de Turno"
            subtitulo="Prévia do modelo configurado"
            mensagem={preview}
            hora="09:00"
            remetente="CCO"
            className="mx-auto max-w-md"
          />
          <p className="text-xs text-slate-500">
            Situação do modelo:{' '}
            <span className="font-mono">
              {templateCustomizado ? 'personalizado' : 'padrão'}
              {templateOriginal === template ? ' • sem alterações' : ' • alterações não salvas'}
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
