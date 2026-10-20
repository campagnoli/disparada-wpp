'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Send,
  Sparkles,
  TrainFront,
  XCircle,
} from 'lucide-react';
import {
  FROTA_PADRAO,
  comporStatusFrota,
  criarEstadosFrota,
  normalizarConfiguracaoFrota,
} from '@/lib/reporte-turno/frota-pure';
import {
  calcularPeriodoReporte,
  dataReporteValida,
  obterDataHojeSaoPaulo,
} from '@/lib/reporte-turno/periodo';
import {
  GRUPOS_REPORTE,
  LINHAS_REPORTE,
  NOMES_GRUPOS_REPORTE,
  TURNOS_REPORTE,
  type ConfiguracaoReporteAPI,
  type EstadoFrotaLinha,
  type GrupoReporte,
  type NumeroLinha,
  type PeriodoReporte,
  type RespostaCompilarReporte,
  type RespostaDispararReporte,
  type ResultadoGrupoReporte,
  type ResumosReporte,
  type TurnoReporte,
} from '@/lib/reporte-turno/tipos';
import WhatsAppPreview from '@/components/whatsapp-preview';

interface PainelReporteProps {
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

function mensagemErro(dados: unknown, fallback: string): string {
  if (typeof dados === 'object' && dados !== null && 'error' in dados) {
    const erro = (dados as { error?: unknown }).error;
    if (typeof erro === 'string' && erro.trim()) return erro;
  }
  return fallback;
}

function aplicarScoNoTexto(texto: string, sco: string): string {
  const linhas = texto.split(/\r?\n/);
  let indice = -1;

  for (let i = linhas.length - 1; i >= 0; i--) {
    if (/^\s*SCO\s*:/i.test(linhas[i])) {
      indice = i;
      break;
    }
  }

  if (indice >= 0) {
    linhas[indice] = `SCO: ${sco}`.trimEnd();
    return linhas.join('\n');
  }

  return sco.trim()
    ? `${texto.trimEnd()}\nSCO: ${sco.trim()}`
    : texto;
}

function horaAtual(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
}

export default function PainelReporte({
  onNotificarErro,
  onNotificarSucesso,
}: PainelReporteProps) {
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState('');
  const [turno, setTurno] = useState<TurnoReporte>('09h');
  const [estadosFrota, setEstadosFrota] = useState<EstadoFrotaLinha[]>(
    criarEstadosFrota(FROTA_PADRAO),
  );
  const [gruposConfigurados, setGruposConfigurados] = useState<Record<GrupoReporte, boolean>>({
    comunicacao: true,
    operacao: true,
    gerencia: true,
  });
  const [grupos, setGrupos] = useState<Record<GrupoReporte, boolean>>({
    comunicacao: true,
    operacao: true,
    gerencia: true,
  });
  const [sco, setSco] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoReporte | null>(null);
  const [resumos, setResumos] = useState<ResumosReporte | null>(null);
  const [eventosPorLinha, setEventosPorLinha] = useState<Record<NumeroLinha, number> | null>(null);
  const [totalEventos, setTotalEventos] = useState(0);
  const [compilando, setCompilando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [erro, setErro] = useState('');
  const [alerta, setAlerta] = useState('');
  const [aviso, setAviso] = useState('');
  const [resultados, setResultados] = useState<ResultadoGrupoReporte[]>([]);

  const invalidarCompilacao = () => {
    setMensagem('');
    setPeriodo(null);
    setResumos(null);
    setEventosPorLinha(null);
    setTotalEventos(0);
    setResultados([]);
    setErro('');
    setAviso('');
  };

  useEffect(() => {
    let ativo = true;

    fetch('/api/reporte/config', { cache: 'no-store' })
      .then(async (resposta) => {
        const dados = (await resposta.json().catch(() => null)) as
          | (ConfiguracaoReporteAPI & { error?: string })
          | null;

        if (!resposta.ok || !dados) {
          throw new Error(mensagemErro(dados, 'Falha ao carregar a configuração do reporte.'));
        }

        return dados;
      })
      .then((dados) => {
        if (!ativo) return;

        const linhas = normalizarConfiguracaoFrota(dados.frota);
        setEstadosFrota(criarEstadosFrota(linhas));

        const configurados = {
          comunicacao: Boolean(dados.grupos?.comunicacao?.configurado),
          operacao: Boolean(dados.grupos?.operacao?.configurado),
          gerencia: Boolean(dados.grupos?.gerencia?.configurado),
        } satisfies Record<GrupoReporte, boolean>;

        setGruposConfigurados(configurados);
        setGrupos(configurados);
        setAlerta(dados.aviso || '');
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setErro(error instanceof Error
          ? error.message
          : 'Falha ao carregar a configuração do reporte.');
      })
      .finally(() => {
        if (!ativo) return;
        setData((atual) => atual || obterDataHojeSaoPaulo());
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const periodoPrevisto = dataReporteValida(data)
    ? calcularPeriodoReporte(data, turno)
    : null;
  const quantidadeGruposSelecionados = GRUPOS_REPORTE.filter(
    (grupo) => grupos[grupo],
  ).length;

  const alterarData = (novoValor: string) => {
    setData(novoValor);
    invalidarCompilacao();
  };

  const alterarTurno = (novoTurno: TurnoReporte) => {
    setTurno(novoTurno);
    invalidarCompilacao();
  };

  const atualizarFrota = (
    numeroLinha: number,
    alteracao: Partial<EstadoFrotaLinha>,
  ) => {
    setEstadosFrota((anterior) => anterior.map((linha) => (
      linha.numeroLinha === numeroLinha ? { ...linha, ...alteracao } : linha
    )));
    invalidarCompilacao();
  };

  const alterarSco = (novoValor: string) => {
    setSco(novoValor);
    setMensagem((anterior) => anterior ? aplicarScoNoTexto(anterior, novoValor) : anterior);
  };

  const compilar = async () => {
    setErro('');
    setAviso('');

    if (!dataReporteValida(data)) {
      setErro('Informe uma data válida para o reporte.');
      return;
    }

    const incompleta = estadosFrota.find(
      (linha) => !linha.circulouCompleta
        && linha.trensCirculando === null
        && !linha.justificativa.trim(),
    );

    if (incompleta) {
      setErro(
        `${incompleta.nomeLinha}: informe a quantidade de trens em circulação ou a justificativa do déficit.`,
      );
      return;
    }

    setCompilando(true);

    try {
      const resposta = await fetch('/api/reporte/compilar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          turno,
          frota: estadosFrota,
          sco,
        }),
      });
      const dados = (await resposta.json().catch(() => null)) as
        | (RespostaCompilarReporte & { error?: string })
        | null;

      if (!resposta.ok || !dados) {
        throw new Error(mensagemErro(dados, 'Falha ao compilar o reporte.'));
      }

      setMensagem(dados.mensagem);
      setPeriodo(dados.periodo);
      setResumos(dados.resumos);
      setEventosPorLinha(dados.eventosPorLinha);
      setTotalEventos(dados.totalEventos);
      setResultados([]);
      if (dados.aviso) setAlerta(dados.aviso);
      setAviso('Reporte compilado. Revise o texto e selecione os grupos antes do disparo.');
    } catch (error: unknown) {
      const texto = error instanceof Error
        ? error.message
        : 'Falha ao compilar o reporte.';
      setErro(texto);
      onNotificarErro?.(error, 'Compilação do Reporte de Turno');
    } finally {
      setCompilando(false);
    }
  };

  const disparar = async () => {
    setErro('');
    setAviso('');

    if (!mensagem.trim()) {
      setErro('Compile o reporte antes de disparar.');
      return;
    }

    if (!sco.trim()) {
      setErro('Informe o nome do SCO responsável antes do disparo.');
      return;
    }

    const selecionados = GRUPOS_REPORTE.filter((grupo) => grupos[grupo]);

    if (selecionados.length === 0) {
      setErro('Selecione ao menos um grupo para o disparo.');
      return;
    }

    const nomes = selecionados.map((grupo) => NOMES_GRUPOS_REPORTE[grupo]).join(', ');
    if (!window.confirm(`Disparar o Reporte de Turno para: ${nomes}?`)) {
      return;
    }

    setResultados([]);
    setDisparando(true);

    try {
      const resposta = await fetch('/api/reporte/disparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: mensagem,
          data,
          turno,
          sco,
          frota: estadosFrota,
          grupos: selecionados,
          resumos,
        }),
      });
      const dados = (await resposta.json().catch(() => null)) as
        | (RespostaDispararReporte & { error?: string })
        | null;

      if (!resposta.ok || !dados) {
        throw new Error(mensagemErro(dados, 'Falha ao disparar o reporte.'));
      }

      setResultados(dados.resultados);
      if (dados.aviso) setAlerta(dados.aviso);

      if (dados.status === 'sucesso') {
        const texto = `Reporte enviado para ${dados.resultados.length} grupo(s).`;
        setAviso(texto);
        onNotificarSucesso?.('Reporte enviado', texto);
      } else if (dados.status === 'parcial') {
        const sucessos = dados.resultados.filter((item) => item.sucesso).length;
        const falhos = new Set(
          dados.resultados
            .filter((item) => !item.sucesso)
            .map((item) => item.grupo),
        );
        setGrupos({
          comunicacao: falhos.has('comunicacao'),
          operacao: falhos.has('operacao'),
          gerencia: falhos.has('gerencia'),
        });
        setAviso(
          `Envio parcial: ${sucessos} de ${dados.resultados.length} grupo(s) receberam o reporte. Os grupos com falha permaneceram selecionados para nova tentativa.`,
        );
      } else {
        const texto = dados.aviso
          ? `Nenhum grupo recebeu o reporte. ${dados.aviso}`
          : 'Nenhum grupo recebeu o reporte. Verifique a conexão com o WhatsApp.';
        setErro(texto);
        onNotificarErro?.(new Error(texto), 'Disparo do Reporte de Turno');
      }
    } catch (error: unknown) {
      const texto = error instanceof Error
        ? error.message
        : 'Falha ao disparar o reporte.';
      setErro(texto);
      onNotificarErro?.(error, 'Disparo do Reporte de Turno');
    } finally {
      setDisparando(false);
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-safira" />
            Reporte de Turno
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Compile as ocorrências das Linhas 11, 12 e 13 com apoio do Gemini,
            revise o texto e dispare para os grupos configurados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            {TURNOS_REPORTE.map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => alterarTurno(opcao)}
                disabled={compilando || disparando}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  turno === opcao
                    ? 'bg-safira text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={turno === opcao}
              >
                {opcao}
                <span className="ml-1.5 hidden text-[11px] font-normal opacity-80 sm:inline">
                  {opcao === '09h' ? 'Manhã' : 'Noite'}
                </span>
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Data do reporte</span>
            <input
              type="date"
              value={data}
              onChange={(event) => alterarData(event.target.value)}
              disabled={compilando || disparando}
              className="bg-transparent text-sm outline-none disabled:opacity-60"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <Clock className="h-3.5 w-3.5" />
          Período apurado
        </span>
        <span>{periodo?.periodoLabel ?? periodoPrevisto?.periodoLabel ?? 'Data inválida'}</span>
        <span className="text-slate-300">|</span>
        <span>{turno === '09h' ? 'Turno de 09h' : 'Turno de 21h'}</span>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}
      {alerta && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {alerta}
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          {aviso}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrainFront className="h-4 w-4 text-coral" />
              <h3 className="text-sm font-semibold text-slate-800">Frota em circulação</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Marque a frota completa ou informe trens circulando e o motivo do déficit.
            </p>

            <div className="mt-4 space-y-3">
              {estadosFrota.map((linha) => {
                const deficit = linha.trensCirculando !== null
                  ? Math.max(0, linha.trensOperacionais - linha.trensCirculando)
                  : null;

                return (
                  <div key={linha.numeroLinha} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              linha.numeroLinha === 11
                                ? 'bg-coral'
                                : linha.numeroLinha === 12
                                  ? 'bg-safira'
                                  : 'bg-jade'
                            }`}
                          />
                          {linha.nomeLinha}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Nominal: {linha.trensOperacionais}+{linha.trensReserva}
                          {deficit !== null && deficit > 0 ? ` • Déficit: ${deficit}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={linha.circulouCompleta}
                        onClick={() => atualizarFrota(linha.numeroLinha, {
                          circulouCompleta: !linha.circulouCompleta,
                        })}
                        disabled={compilando || disparando}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          linha.circulouCompleta
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        <span
                          className={`h-4 w-7 rounded-full p-0.5 transition-colors ${
                            linha.circulouCompleta ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                        >
                          <span
                            className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                              linha.circulouCompleta ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </span>
                        {linha.circulouCompleta ? 'Frota completa' : 'Com déficit'}
                      </button>
                    </div>

                    {!linha.circulouCompleta && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                        <label className="text-xs font-medium text-slate-600">
                          Trens circulando
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={linha.trensCirculando ?? ''}
                            onChange={(event) => {
                              const valor = event.target.value;
                              atualizarFrota(linha.numeroLinha, {
                                trensCirculando: valor === ''
                                  ? null
                                  : Math.max(0, Math.min(999, Math.trunc(Number(valor) || 0))),
                              });
                            }}
                            disabled={compilando || disparando}
                            className="form-control mt-1 w-full disabled:opacity-60"
                            placeholder="Ex.: 29"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Justificativa do déficit
                          <input
                            type="text"
                            value={linha.justificativa}
                            maxLength={300}
                            onChange={(event) => atualizarFrota(linha.numeroLinha, {
                              justificativa: event.target.value,
                            })}
                            disabled={compilando || disparando}
                            className="form-control mt-1 w-full disabled:opacity-60"
                            placeholder="Ex.: manutenção preventiva de 2 trens"
                          />
                        </label>
                      </div>
                    )}

                    <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {comporStatusFrota(linha)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Mensagem compilada
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  O texto fica editável. A compilação usa o Gemini e o modelo configurado no admin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void compilar()}
                disabled={compilando || disparando}
                className="btn btn-safira btn-sm disabled:opacity-50"
              >
                {compilando ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {compilando ? 'Compilando...' : 'Gerar mensagens'}
              </button>
            </div>

            {eventosPorLinha && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {LINHAS_REPORTE.map((linha) => (
                  <span
                    key={linha.numero}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {linha.nome.split('-')[0].trim()}: {eventosPorLinha[linha.numero] ?? 0} evento(s)
                  </span>
                ))}
                <span className="rounded-full bg-safira-50 px-2.5 py-1 text-[11px] font-medium text-safira">
                  Total: {totalEventos}
                </span>
              </div>
            )}

            <textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              rows={16}
              disabled={!mensagem || compilando || disparando}
              className="form-control mt-3 w-full text-sm leading-6 disabled:bg-slate-50"
              placeholder="Clique em “Gerar mensagens” para compilar o reporte do período."
              aria-label="Texto final do Reporte de Turno"
            />

            {mensagem.trim() && (
              <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Nome do SCO responsável
                <input
                  type="text"
                  value={sco}
                  onChange={(event) => alterarSco(event.target.value)}
                  maxLength={160}
                  disabled={disparando}
                  className="form-control mt-1 w-full disabled:opacity-60"
                  placeholder="Ex.: João Silva"
                />
              </label>

              <div>
                <p className="text-xs font-medium text-slate-600">Grupos de envio</p>
                <div className="mt-1 grid gap-2">
                  {GRUPOS_REPORTE.map((grupo) => (
                    <label
                      key={grupo}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        gruposConfigurados[grupo]
                          ? 'border-slate-200 bg-white text-slate-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={grupos[grupo]}
                        disabled={!gruposConfigurados[grupo] || disparando}
                        onChange={(event) => setGrupos((anterior) => ({
                          ...anterior,
                          [grupo]: event.target.checked,
                        }))}
                        className="h-4 w-4 accent-safira"
                      />
                      <span className="font-medium">{NOMES_GRUPOS_REPORTE[grupo]}</span>
                      {!gruposConfigurados[grupo] && (
                        <span className="ml-auto text-[10px] uppercase tracking-wide">não configurado</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {resultados.length > 0 && (
              <ul className="mt-4 space-y-2">
                {resultados.map((resultado) => (
                  <li
                    key={resultado.grupo}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                      resultado.sucesso
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {resultado.sucesso
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span>
                      <strong>{resultado.nome}:</strong>{' '}
                      {resultado.sucesso ? 'enviado com sucesso.' : resultado.erro ?? 'falha no envio.'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">
                O disparo é paralelo para os grupos selecionados e fica registrado em
                <span className="font-mono"> historico_reportes</span>.
              </p>
              <button
                type="button"
                onClick={() => void disparar()}
                disabled={disparando || compilando || !mensagem.trim() || quantidadeGruposSelecionados === 0}
                className="btn btn-primary disabled:opacity-50"
              >
                {disparando ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {disparando ? 'Enviando...' : 'Disparar reporte'}
              </button>
            </div>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-jade" />
              <h3 className="text-sm font-semibold text-slate-800">Prévia no WhatsApp</h3>
            </div>

            <WhatsAppPreview
              titulo="Reporte de Turno"
              subtitulo={
                mensagem.trim()
                  ? `${quantidadeGruposSelecionados} grupo(s) selecionado(s)`
                  : 'Aguardando compilação'
              }
              mensagem={mensagem}
              hora={horaAtual()}
              remetente={sco.trim() || 'CCO'}
              placeholder="A mensagem compilada aparecerá aqui antes do disparo."
            />

            <p className="text-[11px] leading-4 text-slate-500">
              Revise o texto e o SCO. O envio não pode ser desfeito pelo sistema.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
