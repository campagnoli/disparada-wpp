'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { ItemCronologia } from '@/lib/formatadores/ocorrenciaOperacional';
import { TEMPLATES_MENSAGEM_PADRAO } from '@/lib/mensagem-templates-pure';
import type {
  MensagemOcorrenciaOperacional,
  OcorrenciaOperacional,
} from '@/lib/ocorrencias-operacionais/types';
import ModalDetalheOcorrencia from '@/components/ocorrencias-operacionais/modal-detalhe-ocorrencia';
import ModalCronologia from '@/components/ocorrencias-operacionais/modal-cronologia';
import ModalEncerramento from '@/components/ocorrencias-operacionais/modal-encerramento';
import {
  encerrarOcorrencia,
  listarOcorrenciasOperacionais,
  obterDetalheOcorrenciaOperacional,
  salvarCronologiaOcorrencia,
  type FiltroStatusOcorrencias,
  type PayloadEncerramento,
} from '@/components/ocorrencias-operacionais/cliente';
import {
  classeBadgeStatus,
  formatarDataHora,
  formatarHorario,
  rotuloStatus,
} from '@/components/ocorrencias-operacionais/utils';

const FILTROS: Array<{ valor: FiltroStatusOcorrencias; rotulo: string }> = [
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'encerrada', rotulo: 'Encerradas' },
  { valor: 'todas', rotulo: 'Todas' },
];

interface PainelHistoricoOcorrenciasOperacionaisProps {
  templateEncerramento?: string;
  atualizacao?: number;
}

export default function PainelHistoricoOcorrenciasOperacionais({
  templateEncerramento = TEMPLATES_MENSAGEM_PADRAO.encerramento.ocorrencias_operacionais,
  atualizacao = 0,
}: PainelHistoricoOcorrenciasOperacionaisProps) {
  const [expandido, setExpandido] = useState(false);
  const [filtro, setFiltro] = useState<FiltroStatusOcorrencias>('todas');
  const [lista, setLista] = useState<OcorrenciaOperacional[]>([]);
  const [total, setTotal] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState('');

  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<OcorrenciaOperacional | null>(null);
  const [mensagens, setMensagens] = useState<MensagemOcorrenciaOperacional[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState('');

  const [aviso, setAviso] = useState('');
  const [erroAcao, setErroAcao] = useState('');

  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [modalCronologia, setModalCronologia] = useState(false);
  const [modalEncerramento, setModalEncerramento] = useState(false);
  const [salvandoCronologia, setSalvandoCronologia] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const carregarLista = useCallback(async (status: FiltroStatusOcorrencias) => {
    setCarregandoLista(true);
    setErroLista('');
    try {
      const data = await listarOcorrenciasOperacionais(status);
      setLista(data.ocorrencias ?? []);
      setTotal(data.total ?? 0);
    } catch (error: unknown) {
      setErroLista(
        error instanceof Error ? error.message : 'Falha ao carregar as ocorrências operacionais.'
      );
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarLista(filtro), 0);
    return () => window.clearTimeout(timer);
  }, [atualizacao, carregarLista, filtro]);

  const carregarDetalhe = useCallback(async (id: string) => {
    setCarregandoDetalhe(true);
    setErroDetalhe('');
    try {
      const data = await obterDetalheOcorrenciaOperacional(id);
      setDetalhe(data.ocorrencia ?? null);
      setMensagens(data.mensagens ?? []);
    } catch (error: unknown) {
      setErroDetalhe(
        error instanceof Error ? error.message : 'Falha ao carregar o detalhe da ocorrência.'
      );
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  const abrirDetalhe = async (id: string) => {
    setIdSelecionado(id);
    setDetalhe(null);
    setMensagens([]);
    setErroDetalhe('');
    setAviso('');
    setErroAcao('');
    setModalDetalhe(true);
    await carregarDetalhe(id);
  };

  const fecharDetalhe = () => {
    setModalDetalhe(false);
    setIdSelecionado(null);
    setDetalhe(null);
    setMensagens([]);
    setErroDetalhe('');
    setAviso('');
    setErroAcao('');
  };

  const abrirCronologia = () => {
    setErroAcao('');
    setAviso('');
    setModalDetalhe(false);
    setModalCronologia(true);
  };

  const fecharCronologia = () => {
    setModalCronologia(false);
    setModalDetalhe(true);
  };

  const abrirEncerramento = () => {
    setErroAcao('');
    setAviso('');
    setModalDetalhe(false);
    setModalEncerramento(true);
  };

  const fecharEncerramento = () => {
    setModalEncerramento(false);
    setModalDetalhe(true);
  };

  const salvarCronologia = async (
    cronologia: ItemCronologia[],
    aasAsl: string,
    cps: string,
    dispararWhatsApp: boolean
  ) => {
    if (!idSelecionado) return;

    setSalvandoCronologia(true);
    setErroAcao('');
    setAviso('');
    try {
      const data = await salvarCronologiaOcorrencia(
        idSelecionado,
        cronologia,
        aasAsl,
        cps,
        dispararWhatsApp
      );
      if (data.ocorrencia) setDetalhe(data.ocorrencia);

      setModalCronologia(false);
      setModalDetalhe(true);

      if (data.sucesso === false) {
        setErroAcao(
          data.error ||
            'A cronologia foi salva, mas a mensagem não foi enviada ao grupo Ocorrências Operacionais.'
        );
      } else {
        setAviso(
          dispararWhatsApp
            ? 'Cronologia atualizada e nova mensagem enviada ao grupo Ocorrências Operacionais.'
            : 'Cronologia atualizada sem envio de mensagem.'
        );
      }

      await Promise.all([carregarLista(filtro), carregarDetalhe(idSelecionado)]);
    } catch (error: unknown) {
      setErroAcao(
        error instanceof Error ? error.message : 'Falha ao atualizar a cronologia da ocorrência.'
      );
    } finally {
      setSalvandoCronologia(false);
    }
  };

  const confirmarEncerramento = async (payload: PayloadEncerramento) => {
    if (!idSelecionado) return;

    setEncerrando(true);
    setErroAcao('');
    setAviso('');
    try {
      const data = await encerrarOcorrencia(idSelecionado, payload);
      if (data.ocorrencia) setDetalhe(data.ocorrencia);

      setModalEncerramento(false);
      setModalDetalhe(true);
      setFiltro('todas');

      if (data.sucesso === false) {
        setErroAcao(
          data.error ||
            'O encerramento foi salvo, mas a mensagem não foi enviada ao grupo Ocorrências Operacionais.'
        );
      } else {
        setAviso(
          payload.dispararWhatsApp
            ? 'Ocorrência encerrada e nova mensagem enviada ao grupo Ocorrências Operacionais.'
            : 'Ocorrência encerrada sem envio de mensagem.'
        );
      }

      await Promise.all([carregarLista('todas'), carregarDetalhe(idSelecionado)]);
    } catch (error: unknown) {
      setErroAcao(
        error instanceof Error ? error.message : 'Falha ao encerrar a ocorrência operacional.'
      );
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpandido((atual) => !atual)}
            aria-expanded={expandido}
            aria-controls="painel-ocorrencias-operacionais-conteudo"
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                Ocorrências Operacionais
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {total}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Cronologia e histórico das mensagens enviadas ao grupo
              </p>
            </div>
            <ChevronDown
              className={`ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expandido ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {expandido && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                {FILTROS.map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    onClick={() => setFiltro(opcao.valor)}
                    aria-pressed={filtro === opcao.valor}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      filtro === opcao.valor
                        ? 'bg-amber-100 text-amber-800'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void carregarLista(filtro)}
                disabled={carregandoLista}
                className="btn btn-secondary btn-sm disabled:opacity-50"
                title="Atualizar lista"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${carregandoLista ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {expandido && (
        <div id="painel-ocorrencias-operacionais-conteudo" className="p-3">
          {erroLista && (
            <p className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erroLista}</span>
            </p>
          )}

          {carregandoLista && lista.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando ocorrências...
            </p>
          ) : lista.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-medium text-slate-600">
                Nenhuma ocorrência operacional encontrada para este filtro.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                As ocorrências aparecem aqui quando a mensagem do grupo Ocorrências Operacionais é disparada.
              </p>
            </div>
          ) : (
            <ul className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {lista.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void abrirDetalhe(item.id)}
                    className="group flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{item.linha}</span>
                        <span className={`badge ${classeBadgeStatus(item)}`}>{rotuloStatus(item)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600" title={item.descritivo}>
                        {item.tipo_ocorrencia} · {item.local}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Início {formatarHorario(item.horario)}
                        </span>
                        <span>{item.cronologia.length} ação(ões)</span>
                        <span>Atualizada {formatarDataHora(item.atualizado_em)}</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-amber-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ModalDetalheOcorrencia
        aberto={modalDetalhe}
        ocorrencia={detalhe}
        mensagens={mensagens}
        carregando={carregandoDetalhe}
        erro={erroDetalhe}
        aviso={aviso}
        erroAcao={erroAcao}
        onFechar={fecharDetalhe}
        onAtualizar={() => {
          if (idSelecionado) void carregarDetalhe(idSelecionado);
        }}
        onEditarCronologia={abrirCronologia}
        onEncerrar={abrirEncerramento}
      />

      {modalCronologia && detalhe && (
        <ModalCronologia
          aberto
          ocorrencia={detalhe}
          salvando={salvandoCronologia}
          erro={erroAcao}
          onFechar={fecharCronologia}
          onSalvar={(cronologia, aasAsl, cps, dispararWhatsApp) =>
            void salvarCronologia(cronologia, aasAsl, cps, dispararWhatsApp)
          }
        />
      )}

      {modalEncerramento && detalhe && (
        <ModalEncerramento
          aberto
          ocorrencia={detalhe}
          enviando={encerrando}
          erro={erroAcao}
          templateEncerramento={templateEncerramento}
          onFechar={fecharEncerramento}
          onConfirmar={(payload) => void confirmarEncerramento(payload)}
        />
      )}
    </section>
  );
}
