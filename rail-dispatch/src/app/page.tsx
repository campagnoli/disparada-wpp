'use client';

import { useCallback, useEffect, useState } from 'react';
import { Train, Send, Sparkles, Copy, Check, AlertTriangle, Save, History, Clock, Search, Settings, ChevronDown } from 'lucide-react';
import { isModeloGemini, modelosGemini, type ModeloGemini } from '@/lib/gemini-models';
import { opcoesClassificacao, tiposIN } from '@/lib/classificacao-ocorrencia';
import AdminFalhas, { type FalhaPredefinida } from '@/app/admin-falhas';

interface Mensagens {
  comunicacao: string;
  operacao: string;
  gerencia: string;
}

interface FalhaSelecionada {
  chave: string;
  descricao: string;
  impacto: string;
}

interface Estacao {
  nome: string;
  sigla: string;
  linha: string;
}

interface OcorrenciaHistorico {
  id: string;
  codigo_evento: string | null;
  created_at: string | null;
  linha: string;
  via: string;
  localidade: string;
  id_trem: string | null;
  prefixo_viagem: string | null;
  classificacoes: string[];
  tipo_in: string | null;
  falha: string;
  hora_inicio: string;
  hora_fim: string | null;
  status: string;
}

interface OcorrenciaDetalhe extends OcorrenciaHistorico {
  msg_comunicacao: string;
  msg_operacao: string;
  msg_gerencia: string;
}

interface PaginaHistorico {
  items: OcorrenciaHistorico[];
  total: number;
  page: number;
  pageSize: number;
}

async function buscarFalhasPredefinidas(): Promise<FalhaPredefinida[]> {
  const response = await fetch('/api/admin/falhas', { cache: 'no-store' });
  const data = (await response.json()) as { falhas?: FalhaPredefinida[]; error?: string };
  if (!response.ok || !Array.isArray(data.falhas)) {
    throw new Error(data.error || 'Não foi possível carregar as opções de falha.');
  }
  return data.falhas;
}

async function buscarHistorico(page: number, signal?: AbortSignal): Promise<PaginaHistorico> {
  const res = await fetch(`/api/ocorrencias?page=${page}`, { signal });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Não foi possível carregar o histórico.';
    throw new Error(message);
  }

  if (typeof data !== 'object' || data === null || !('items' in data) || !Array.isArray(data.items)) {
    throw new Error('Resposta inválida ao carregar o histórico.');
  }

  return data as PaginaHistorico;
}

async function buscarOcorrencia(codigoEvento: string): Promise<OcorrenciaDetalhe> {
  const res = await fetch(`/api/ocorrencias?codigo_evento=${encodeURIComponent(codigoEvento)}`);
  const data = (await res.json().catch(() => null)) as {
    ocorrencia?: OcorrenciaDetalhe;
    error?: string;
  } | null;

  if (!res.ok || !data?.ocorrencia) {
    throw new Error(data?.error || 'Não foi possível encontrar a ocorrência.');
  }

  return data.ocorrencia;
}

export default function DespachoOcorrencias() {
  const [linha, setLinha] = useState('Linha 11-Coral');
  const [via, setVia] = useState('Via 1');
  const [tipoLocalidade, setTipoLocalidade] = useState<'estacao' | 'trecho'>('estacao');
  const [localidadeInicio, setLocalidadeInicio] = useState('');
  const [localidadeFim, setLocalidadeFim] = useState('');
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [carregandoEstacoes, setCarregandoEstacoes] = useState(true);
  const [erroEstacoes, setErroEstacoes] = useState('');
  const [idTrem, setIdTrem] = useState('');
  const [prefixoViagem, setPrefixoViagem] = useState('');
  const [classificacoes, setClassificacoes] = useState<string[]>([]);
  const [tipoIN, setTipoIN] = useState('');
  const [informante, setInformante] = useState('');
  const [falhasSelecionadas, setFalhasSelecionadas] = useState<FalhaSelecionada[]>([]);
  const [falhaEditada, setFalhaEditada] = useState<string | null>(null);
  const [impactoEditado, setImpactoEditado] = useState<string | null>(null);
  const [falhasPredefinidas, setFalhasPredefinidas] = useState<FalhaPredefinida[]>([]);
  const [carregandoFalhas, setCarregandoFalhas] = useState(true);
  const [erroFalhas, setErroFalhas] = useState('');
  const [paginaFormulario, setPaginaFormulario] = useState<1 | 2 | 3>(1);
  const [horaInicio, setHoraInicio] = useState('');
  const [modeloGemini, setModeloGemini] = useState<ModeloGemini>('gemini-3.1-flash-lite');

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<OcorrenciaHistorico[]>([]);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [abaAtiva, setAbaAtiva] = useState<'ocorrencia' | 'historico' | 'admin'>('ocorrencia');
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState('');
  const [codigoBusca, setCodigoBusca] = useState('');
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<OcorrenciaDetalhe | null>(null);
  const [buscandoOcorrencia, setBuscandoOcorrencia] = useState(false);
  const [atualizandoHorarioFim, setAtualizandoHorarioFim] = useState(false);
  const [horaFim, setHoraFim] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagens>({
    comunicacao: '',
    operacao: '',
    gerencia: '',
  });
  const falha = falhaEditada
    ?? falhasSelecionadas.map((item) => item.descricao.trim()).filter(Boolean).join('\n');
  const impacto = impactoEditado
    ?? falhasSelecionadas.map((item) => item.impacto.trim()).filter(Boolean).join('\n');

  const carregarFalhasPredefinidas = useCallback(async () => {
    try {
      const data = await buscarFalhasPredefinidas();
      setErroFalhas('');
      const anteriores = new Map(falhasPredefinidas.map((item) => [`preset:${item.id}`, item]));
      const atuaisDisponiveis = new Map(data.map((item) => [`preset:${item.id}`, item]));
      setFalhasPredefinidas(data);
      setFalhasSelecionadas((atuais) => atuais.flatMap((item) => {
        if (item.chave === 'personalizada') return [item];
        const atualizada = atuaisDisponiveis.get(item.chave);
        if (!atualizada) return [];
        const anterior = anteriores.get(item.chave);
        const semEdicaoManual = anterior
          && item.descricao === anterior.descricao
          && item.impacto === anterior.impacto;
        return [{
          ...item,
          descricao: semEdicaoManual ? atualizada.descricao : item.descricao,
          impacto: semEdicaoManual ? atualizada.impacto : item.impacto,
        }];
      }));
      setFalhaEditada(null);
      setImpactoEditado(null);
    } catch (error: unknown) {
      setErroFalhas(error instanceof Error ? error.message : 'Não foi possível carregar as opções de falha.');
    }
    setCarregandoFalhas(false);
  }, [falhasPredefinidas]);

  useEffect(() => {
    let mounted = true;

    const carregar = async () => {
      try {
        const falhas = await buscarFalhasPredefinidas();
        if (!mounted) return;
        setFalhasPredefinidas(falhas);
      } catch (error: unknown) {
        if (mounted) {
          setErroFalhas(error instanceof Error ? error.message : 'Não foi possível carregar as opções de falha.');
        }
      } finally {
        if (mounted) setCarregandoFalhas(false);
      }
    };

    void carregar();
    return () => {
      mounted = false;
    };
  }, []);

  const alternarFalha = (falha: FalhaPredefinida | null, selecionada: boolean) => {
    const chave = falha ? `preset:${falha.id}` : 'personalizada';
    setFalhaEditada(null);
    setImpactoEditado(null);
    setFalhasSelecionadas((atuais) => {
      if (selecionada) {
        if (atuais.some((item) => item.chave === chave)) return atuais;
        return [...atuais, {
          chave,
          descricao: falha?.descricao ?? '',
          impacto: falha?.impacto ?? '',
        }];
      }
      return atuais.filter((item) => item.chave !== chave);
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setHoraInicio(new Date().toTimeString().slice(0, 5));
    }, 0);

    void buscarHistorico(1, controller.signal)
      .then((pagina) => {
        setHistorico(pagina.items);
        setTotalHistorico(pagina.total);
        setPaginaHistorico(pagina.page);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErroHistorico(error instanceof Error ? error.message : 'Falha ao carregar histórico.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoHistorico(false);
      });

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const carregarEstacoes = async () => {
      try {
        const res = await fetch(`/api/estacoes?linha=${encodeURIComponent(linha)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { estacoes?: Estacao[]; error?: string };

        if (!res.ok) throw new Error(data.error || 'Falha ao carregar as estações.');
        setEstacoes(data.estacoes ?? []);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setErroEstacoes(error instanceof Error ? error.message : 'Falha ao carregar as estações.');
        }
      } finally {
        if (!controller.signal.aborted) setCarregandoEstacoes(false);
      }
    };

    void carregarEstacoes();
    return () => controller.abort();
  }, [linha]);

  const handleGerarMensagens = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paginaFormulario === 1) {
      setPaginaFormulario(2);
      return;
    }
    if (paginaFormulario === 2) {
      setPaginaFormulario(3);
      return;
    }

    setLoading(true);

    try {
      const localidade = tipoLocalidade === 'estacao'
        ? localidadeInicio
        : `${localidadeInicio} - ${localidadeFim}`;
      const dadosOcorrencia = {
        linha,
        via,
        tipoLocalidade,
        localidade,
        localidadeInicio,
        localidadeFim,
        idTrem,
        prefixoViagem,
        classificacoes,
        tipoIN,
        falhas: [{ descricao: falha, impacto }],
        informante,
        falha,
        horaInicio,
        impacto,
        modelo: modeloGemini,
      };

      const res = await fetch('/api/gerar-mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosOcorrencia),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || `Falha na resposta da API (${res.status}).`);
      }
      const data: Mensagens = await res.json();
      setMensagens(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha inesperada.';
      alert(`Erro ao gerar mensagens com o Gemini: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async (pagina = paginaHistorico) => {
    setCarregandoHistorico(true);
    setErroHistorico('');

    try {
      const resultado = await buscarHistorico(pagina);
      setHistorico(resultado.items);
      setTotalHistorico(resultado.total);
      setPaginaHistorico(resultado.page);
    } catch (error: unknown) {
      setErroHistorico(error instanceof Error ? error.message : 'Falha ao carregar histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const handleSalvarOcorrencia = async () => {
    if (!mensagens.comunicacao || !mensagens.operacao || !mensagens.gerencia) return;
    setSalvando(true);

    try {
      const localidade = tipoLocalidade === 'estacao'
        ? localidadeInicio
        : `${localidadeInicio} - ${localidadeFim}`;
      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linha,
          via,
          tipoLocalidade,
          localidadeInicio,
          localidadeFim,
          localidade,
          idTrem,
          prefixoViagem,
          classificacoes,
          tipoIN,
          falhas: [{ descricao: falha, impacto }],
          informante,
          falha,
          horaInicio,
          impacto,
          mensagens,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        ocorrencia?: { codigo_evento?: string };
      } | null;

      if (!res.ok) throw new Error(data?.error || 'Falha ao registrar no banco.');
      const codigoEvento = data?.ocorrencia?.codigo_evento;
      if (!codigoEvento) throw new Error('O registro não retornou o ID do evento.');

      await carregarHistorico(1);
      setCodigoBusca(codigoEvento);
      setAbaAtiva('historico');
      alert(`Ocorrência gravada. ID do evento: ${codigoEvento}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar ocorrência.';
      alert(`Erro ao salvar ocorrência: ${message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handlePesquisarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscandoOcorrencia(true);
    setErroBusca('');
    setOcorrenciaSelecionada(null);
    setHoraFim('');

    try {
      const ocorrencia = await buscarOcorrencia(codigoBusca.trim());
      setOcorrenciaSelecionada(ocorrencia);
      setHoraFim(ocorrencia.hora_fim ?? '');
    } catch (error: unknown) {
      setErroBusca(error instanceof Error ? error.message : 'Falha ao pesquisar ocorrência.');
    } finally {
      setBuscandoOcorrencia(false);
    }
  };

  const handleAtualizarHorarioFim = async () => {
    if (!ocorrenciaSelecionada || !horaFim) return;
    setAtualizandoHorarioFim(true);
    setErroBusca('');

    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_evento: ocorrenciaSelecionada.codigo_evento, hora_fim: horaFim }),
      });
      const data = (await res.json().catch(() => null)) as {
        ocorrencia?: OcorrenciaDetalhe;
        error?: string;
      } | null;

      if (!res.ok || !data?.ocorrencia) {
        throw new Error(data?.error || 'Falha ao atualizar a ocorrência.');
      }

      setOcorrenciaSelecionada(data.ocorrencia);
      await carregarHistorico(paginaHistorico);
    } catch (error: unknown) {
      setErroBusca(error instanceof Error ? error.message : 'Falha ao atualizar ocorrência.');
    } finally {
      setAtualizandoHorarioFim(false);
    }
  };

  const copiarTexto = (chave: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-safira-50 text-safira rounded-lg border border-safira-100">
              <Train className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-safira">Despacho de Ocorrências CCO</h1>
              <p className="text-sm text-slate-400">Padronização e disparo de contingências via WhatsApp</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-jade-50 text-green-800 border border-jade-100">
            <span className="w-2 h-2 rounded-full bg-jade animate-pulse" />
            CCO Ativo
          </span>
        </header>

        <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Seções da ocorrência">
          <button
            id="aba-ocorrencia"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'ocorrencia'}
            aria-controls="painel-ocorrencia"
            onClick={() => setAbaAtiva('ocorrencia')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${abaAtiva === 'ocorrencia' ? 'border-safira text-safira' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <AlertTriangle className="h-4 w-4" />
            Nova ocorrência
          </button>
          <button
            id="aba-historico"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'historico'}
            aria-controls="painel-historico"
            onClick={() => {
              setAbaAtiva('historico');
              void carregarHistorico(1);
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${abaAtiva === 'historico' ? 'border-safira text-safira' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <History className="h-4 w-4" />
            Histórico
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{totalHistorico}</span>
          </button>
          <button
            id="aba-admin"
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'admin'}
            aria-controls="painel-admin"
            onClick={() => setAbaAtiva('admin')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${abaAtiva === 'admin' ? 'border-safira text-safira' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Settings className="h-4 w-4" />
            Administração
          </button>
        </div>

        <div
          id="painel-ocorrencia"
          role="tabpanel"
          aria-labelledby="aba-ocorrencia"
          hidden={abaAtiva !== 'ocorrencia'}
          className="grid grid-cols-1 gap-8 lg:grid-cols-12"
        >
          
          {/* Formulário de Registro */}
          <div className="lg:col-span-5 card p-4">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-coral" />
              Dados da Ocorrência
            </h2>

            <form onSubmit={handleGerarMensagens} className="space-y-4">
              <div aria-live="polite" className="rounded-md bg-safira-50 p-3">
                <p className="text-sm font-semibold text-safira">
                  Etapa {paginaFormulario} de 3: {
                    paginaFormulario === 1
                      ? 'Informações iniciais'
                      : paginaFormulario === 2
                        ? 'Falha e impacto operacional'
                        : 'Classificação da ocorrência'
                  }
                </p>
                <div className="mt-2 flex gap-2" aria-hidden="true">
                  {[1, 2, 3].map((etapa) => (
                    <span
                      key={etapa}
                      className={`h-1.5 flex-1 rounded-full ${paginaFormulario >= etapa ? 'bg-safira' : 'bg-safira/30'}`}
                    />
                  ))}
                </div>
              </div>

              {paginaFormulario === 1 ? (
                <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block">Linha</label>
                  <select
                    value={linha}
                    onChange={(e) => {
                      setLinha(e.target.value);
                      setEstacoes([]);
                      setLocalidadeInicio('');
                      setLocalidadeFim('');
                      setCarregandoEstacoes(true);
                      setErroEstacoes('');
                    }}
                    className="w-full form-select"
                  >
                    <option value="Linha 11-Coral">Linha 11-Coral</option>
                    <option value="Linha 12-Safira">Linha 12-Safira</option>
                    <option value="Linha 13-Jade">Linha 13-Jade</option>
                  </select>
                </div>

                <div>
                  <label className="form-label block">Via</label>
                  <select
                    value={via}
                    onChange={(e) => setVia(e.target.value)}
                    className="w-full form-select"
                  >
                    <option value="Via 1">Via 1</option>
                    <option value="Via 2">Via 2</option>
                    <option value="Via Auxiliar">Via Auxiliar</option>
                    <option value="Via Singela (Trecho)">Via Singela</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tipo-localidade" className="form-label block">Área afetada</label>
                <select
                  id="tipo-localidade"
                  value={tipoLocalidade}
                  onChange={(e) => {
                    if (e.target.value === 'estacao' || e.target.value === 'trecho') {
                      setTipoLocalidade(e.target.value);
                      setLocalidadeInicio('');
                      setLocalidadeFim('');
                    }
                  }}
                  className="w-full form-select"
                >
                  <option value="estacao">Estação</option>
                  <option value="trecho">Trecho entre estações</option>
                </select>
              </div>

              {tipoLocalidade === 'estacao' ? (
                <div>
                  <label htmlFor="estacao-afetada" className="form-label block">Estação afetada</label>
                  <select
                    id="estacao-afetada"
                    required
                    value={localidadeInicio}
                    onChange={(e) => setLocalidadeInicio(e.target.value)}
                    disabled={carregandoEstacoes || estacoes.length === 0}
                    className="w-full form-select"
                  >
                    <option value="" disabled>
                      {carregandoEstacoes ? 'Carregando estações...' : 'Selecione a estação'}
                    </option>
                    {estacoes.map((estacao) => (
                      <option key={estacao.sigla} value={estacao.sigla}>
                        {estacao.nome} ({estacao.sigla})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="estacao-inicio" className="form-label block">Estação A / início</label>
                    <select
                      id="estacao-inicio"
                      required
                      value={localidadeInicio}
                      onChange={(e) => setLocalidadeInicio(e.target.value)}
                      disabled={carregandoEstacoes || estacoes.length === 0}
                      className="w-full form-select"
                    >
                      <option value="" disabled>
                        {carregandoEstacoes ? 'Carregando estações...' : 'Selecione a estação'}
                      </option>
                      {estacoes.map((estacao) => (
                        <option
                          key={estacao.sigla}
                          value={estacao.sigla}
                          disabled={estacao.sigla === localidadeFim}
                        >
                          {estacao.nome} ({estacao.sigla})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="estacao-fim" className="form-label block">Estação B / fim</label>
                    <select
                      id="estacao-fim"
                      required
                      value={localidadeFim}
                      onChange={(e) => setLocalidadeFim(e.target.value)}
                      disabled={carregandoEstacoes || estacoes.length === 0}
                      className="w-full form-select"
                    >
                      <option value="" disabled>
                        {carregandoEstacoes ? 'Carregando estações...' : 'Selecione a estação'}
                      </option>
                      {estacoes.map((estacao) => (
                        <option
                          key={estacao.sigla}
                          value={estacao.sigla}
                          disabled={estacao.sigla === localidadeInicio}
                        >
                          {estacao.nome} ({estacao.sigla})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(erroEstacoes || (!carregandoEstacoes && estacoes.length === 0)) && (
                <p className="text-sm text-rose-700" role="alert">
                  {erroEstacoes || `Nenhuma estação cadastrada para ${linha}.`}
                </p>
              )}

              <div>
                <label className="form-label block">Hora de Início</label>
                <input
                  type="time"
                  required
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full form-control"
                />
              </div>

              <div>
                <label htmlFor="id-trem" className="form-label block">ID do trem</label>
                <input
                  id="id-trem"
                  type="text"
                  placeholder="Número/ID do trem"
                  value={idTrem}
                  onChange={(e) => setIdTrem(e.target.value)}
                  maxLength={100}
                  className="w-full form-control"
                />
              </div>

              <div>
                <label htmlFor="prefixo-viagem" className="form-label block">Prefixo da viagem</label>
                <input
                  id="prefixo-viagem"
                  type="text"
                  placeholder="Ex: H512"
                  value={prefixoViagem}
                  onChange={(e) => setPrefixoViagem(e.target.value)}
                  maxLength={100}
                  className="w-full form-control"
                />
              </div>

              <div>
                <label htmlFor="informante" className="form-label block">Informante</label>
                <input
                  id="informante"
                  type="text"
                  required
                  placeholder="Ex: Fulano de tal"
                  value={informante}
                  onChange={(e) => setInformante(e.target.value)}
                  className="w-full form-control"
                />
              </div>
                </div>
              ) : paginaFormulario === 2 ? (
                <div className="space-y-4">

              <div>
                <fieldset disabled={carregandoFalhas}>
                  <legend className="form-label block">Falhas / Descrições do Operador</legend>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                      <span>
                        {falhasSelecionadas.length === 0
                          ? 'Selecione uma ou mais falhas'
                          : `${falhasSelecionadas.length} ${falhasSelecionadas.length === 1 ? 'falha selecionada' : 'falhas selecionadas'}`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="space-y-2">
                        {falhasPredefinidas.map((opcao) => {
                          const chave = `preset:${opcao.id}`;
                          const selecionada = falhasSelecionadas.some((item) => item.chave === chave);
                          return (
                            <label key={opcao.id} className="flex cursor-pointer items-start gap-2 py-1">
                              <input
                                type="checkbox"
                                checked={selecionada}
                                onChange={(event) => alternarFalha(opcao, event.target.checked)}
                                className="mt-1"
                              />
                              <span>{opcao.descricao}</span>
                            </label>
                          );
                        })}
                        <label className="flex cursor-pointer items-start gap-2 border-t border-slate-200 pt-2">
                          <input
                            type="checkbox"
                            checked={falhasSelecionadas.some((item) => item.chave === 'personalizada')}
                            onChange={(event) => alternarFalha(null, event.target.checked)}
                            className="mt-1"
                          />
                          <span>Outra / descrever</span>
                        </label>
                      </div>
                    </div>
                  </details>
                </fieldset>
                {carregandoFalhas && <p className="mt-1 text-sm text-slate-500">Carregando opções de falha...</p>}
                {erroFalhas && <p className="mt-1 text-sm text-rose-700" role="alert">{erroFalhas}</p>}
                {falhasSelecionadas.length > 0 && (
                  <p className="mt-1 truncate text-xs text-slate-500" title={falhasSelecionadas.map((item) => item.descricao || 'Outra').join(', ')}>
                    Selecionadas: {falhasSelecionadas.map((item) => item.descricao || 'Outra').join(', ')}
                  </p>
                )}
                <div className="mt-3">
                  <label htmlFor="falha-descricao" className="form-label block">Falha / Descrição</label>
                  <textarea
                    id="falha-descricao"
                    required
                    rows={3}
                    maxLength={5000}
                    value={falha}
                    onChange={(event) => setFalhaEditada(event.target.value)}
                    placeholder="A descrição das falhas selecionadas aparecerá aqui; você pode editá-la."
                    className="w-full form-control"
                  />
                </div>
                <div className="mt-3">
                  <label htmlFor="falha-impacto" className="form-label block">Impacto inicial</label>
                  <textarea
                    id="falha-impacto"
                    required
                    rows={3}
                    maxLength={5000}
                    value={impacto}
                    onChange={(event) => setImpactoEditado(event.target.value)}
                    placeholder="Os impactos das falhas selecionadas aparecerão aqui; você pode editá-los."
                    className="w-full form-control"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modelo-gemini" className="form-label block">Modelo do Gemini</label>
                <select
                  id="modelo-gemini"
                  value={modeloGemini}
                  onChange={(e) => {
                    if (isModeloGemini(e.target.value)) setModeloGemini(e.target.value);
                  }}
                  className="w-full form-select"
                >
                  {modelosGemini.map((modelo) => (
                    <option key={modelo.id} value={modelo.id}>
                      {modelo.nome} — até {modelo.limiteDiario} solicitações/dia
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  O Flash Lite tem uma cota diária maior; escolha o modelo conforme a necessidade.
                </p>
              </div>
              </div>
              ) : (
                <div className="space-y-4">
                  <fieldset>
                    <legend className="form-label block">Classificação da ocorrência</legend>
                    <p className="mb-2 text-sm text-slate-600">Selecione uma ou mais opções.</p>
                    <div className="space-y-2">
                      {opcoesClassificacao.map((opcao) => (
                        <label key={opcao.valor} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={classificacoes.includes(opcao.valor)}
                            onChange={(event) => {
                              setClassificacoes((atuais) => event.target.checked
                                ? [...atuais, opcao.valor]
                                : atuais.filter((item) => item !== opcao.valor));
                              if (opcao.valor === 'IN' && !event.target.checked) setTipoIN('');
                            }}
                          />
                          <span>{opcao.rotulo}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {classificacoes.includes('IN') && (
                    <div>
                      <label htmlFor="tipo-in" className="form-label block">Tipo de IN</label>
                      <select
                        id="tipo-in"
                        required
                        value={tipoIN}
                        onChange={(event) => setTipoIN(event.target.value)}
                        className="w-full form-select"
                      >
                        <option value="" disabled>Selecione o tipo de IN</option>
                        {tiposIN.map((tipo) => (
                          <option key={tipo} value={tipo}>Tipo {tipo}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {paginaFormulario > 1 && (
                  <button
                    type="button"
                    onClick={() => setPaginaFormulario((pagina) => pagina === 3 ? 2 : 1)}
                    disabled={loading}
                    className="flex-1 btn btn-secondary disabled:opacity-50"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={
                    paginaFormulario === 1
                      ? loading
                        || carregandoEstacoes
                        || !localidadeInicio
                        || (tipoLocalidade === 'trecho' && (!localidadeFim || localidadeFim === localidadeInicio))
                      : paginaFormulario === 2
                        ? loading
                        || carregandoFalhas
                        || !falhasSelecionadas.length
                        || !falha.trim()
                        || !impacto.trim()
                        : loading || (classificacoes.includes('IN') && !tipoIN)
                  }
                  className="flex-1 btn btn-safira disabled:opacity-50"
                >
                  {paginaFormulario < 3 ? (
                    'Próxima página'
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {loading ? 'Formatando com Gemini...' : 'Gerar Mensagens'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Cards de Pré-visualização das 3 Mensagens */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Card 1: Comunicação */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-safira">Grupo: Comunicação / Imprensa</span>
                  <p className="text-xs text-slate-500">Contexto claro para a equipe de comunicação e jornalistas</p>
                </div>
                <button
                  onClick={() => copiarTexto('comunicacao', mensagens.comunicacao)}
                  disabled={!mensagens.comunicacao}
                  className="btn btn-secondary btn-sm disabled:opacity-30"
                  title="Copiar texto"
                >
                  {copiado === 'comunicacao' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <textarea
                rows={3}
                value={mensagens.comunicacao}
                onChange={(e) => setMensagens({ ...mensagens, comunicacao: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-sans"
              />
            </div>

            {/* Card 2: Operação */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-coral">Grupo: Operação / Tráfego CCO</span>
                  <p className="text-xs text-slate-500">Técnico, sucinto e direcionado à circulação</p>
                </div>
                <button
                  onClick={() => copiarTexto('operacao', mensagens.operacao)}
                  disabled={!mensagens.operacao}
                  className="btn btn-secondary btn-sm disabled:opacity-30"
                  title="Copiar texto"
                >
                  {copiado === 'operacao' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <textarea
                rows={3}
                value={mensagens.operacao}
                onChange={(e) => setMensagens({ ...mensagens, operacao: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-mono text-xs"
              />
            </div>

            {/* Card 3: Gerência */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-jade">Grupo: Gerência / Diretoria</span>
                  <p className="text-xs text-slate-500">Informe executivo com causa e previsão de atuação</p>
                </div>
                <button
                  onClick={() => copiarTexto('gerencia', mensagens.gerencia)}
                  disabled={!mensagens.gerencia}
                  className="btn btn-secondary btn-sm disabled:opacity-30"
                  title="Copiar texto"
                >
                  {copiado === 'gerencia' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <textarea
                rows={4}
                value={mensagens.gerencia}
                onChange={(e) => setMensagens({ ...mensagens, gerencia: e.target.value })}
                placeholder="Aguardando geração..."
                className="w-full form-control font-sans"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!mensagens.comunicacao || !mensagens.operacao || !mensagens.gerencia || salvando}
                onClick={handleSalvarOcorrencia}
                className="w-full btn btn-safira disabled:opacity-30"
              >
                <Save className="w-4 h-4" />
                {salvando ? 'Salvando...' : 'Salvar mensagens'}
              </button>

              <button
                type="button"
                disabled={!mensagens.comunicacao || !mensagens.operacao || !mensagens.gerencia}
                onClick={() => alert('Próximo passo: Conectar o endpoint do WhatsApp (Evolution API)!')}
                className="w-full btn btn-jade disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
                Disparar nos 3 Grupos do WhatsApp
              </button>
            </div>

          </div>

        </div>

        <section
          id="painel-historico"
          role="tabpanel"
          aria-labelledby="aba-historico"
          hidden={abaAtiva !== 'historico'}
          className="card p-4"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <History className="h-4 w-4 text-safira" />
              Histórico recente de ocorrências
            </h2>
            <button
              type="button"
              onClick={() => void carregarHistorico(paginaHistorico)}
              disabled={carregandoHistorico}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              <History className="h-4 w-4" />
              {carregandoHistorico ? 'Atualizando...' : 'Atualizar lista'}
            </button>
          </div>

          {erroHistorico && <p className="mb-3 text-sm text-rose-700" role="alert">{erroHistorico}</p>}

          <form onSubmit={handlePesquisarOcorrencia} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="codigo-evento" className="form-label block">Pesquisar por ID do evento</label>
              <input
                id="codigo-evento"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                required
                placeholder="DDMMAAAALLNNN"
                className="w-full form-control font-mono"
              />
            </div>
            <button type="submit" disabled={buscandoOcorrencia || !codigoBusca.trim()} className="btn btn-safira disabled:opacity-50">
              <Search className="h-4 w-4" />
              {buscandoOcorrencia ? 'Pesquisando...' : 'Pesquisar'}
            </button>
          </form>

          {erroBusca && <p className="mb-4 text-sm text-rose-700" role="alert">{erroBusca}</p>}

          {ocorrenciaSelecionada && (
            <section className="mb-6 border-y border-slate-200 py-4" aria-label="Atualizar horário fim do evento">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-safira">Evento {ocorrenciaSelecionada.codigo_evento}</h3>
                  <p className="text-sm text-slate-600">
                    {ocorrenciaSelecionada.linha} ({ocorrenciaSelecionada.via}) · {ocorrenciaSelecionada.localidade}
                  </p>
                </div>
                <span className="badge badge-safira">{ocorrenciaSelecionada.status}</span>
              </div>

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label htmlFor="hora-fim" className="form-label block">Horário fim</label>
                  <input
                    id="hora-fim"
                    type="time"
                    required
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="form-control"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAtualizarHorarioFim()}
                  disabled={!horaFim || atualizandoHorarioFim}
                  className="btn btn-safira disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" />
                  {atualizandoHorarioFim ? 'Atualizando...' : 'Atualizar mensagem'}
                </button>
              </div>

              <div className="space-y-4">
                {([
                  ['comunicacao', 'Comunicação / Imprensa', ocorrenciaSelecionada.msg_comunicacao],
                  ['operacao', 'Operação / CCO', ocorrenciaSelecionada.msg_operacao],
                  ['gerencia', 'Gerência', ocorrenciaSelecionada.msg_gerencia],
                ] as const).map(([chave, titulo, texto]) => (
                  <div key={chave}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label htmlFor={`mensagem-atualizada-${chave}`} className="form-label mb-0">{titulo}</label>
                      <button
                        type="button"
                        onClick={() => copiarTexto(`evento-${chave}`, texto)}
                        className="btn btn-secondary btn-sm"
                        title={`Copiar mensagem de ${titulo}`}
                      >
                        {copiado === `evento-${chave}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <textarea
                      id={`mensagem-atualizada-${chave}`}
                      rows={3}
                      readOnly
                      value={texto}
                      className="w-full form-control"
                    />
                  </div>
                ))}
              </div>
            </section>

          )}

          <div className="overflow-x-auto">
            <table className="table w-full text-left">
              <thead>
                <tr>
                  <th>ID do evento</th>
                  <th>Hora</th>
                  <th>Linha / Via</th>
                  <th>Local</th>
                  <th>ID do trem</th>
                  <th>Prefixo da viagem</th>
                  <th>Falha informada</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      {carregandoHistorico ? 'Carregando histórico...' : 'Nenhuma ocorrência registrada.'}
                    </td>
                  </tr>
                ) : (
                  historico.map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono font-medium text-safira">{item.codigo_evento || '-'}</td>
                      <td>
                        <span className="flex items-center gap-1.5 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {item.hora_inicio}
                        </span>
                      </td>
                      <td>{item.linha} ({item.via})</td>
                      <td className="font-medium">{item.localidade}</td>
                      <td className="font-mono">{item.id_trem || '-'}</td>
                      <td className="font-mono">{item.prefixo_viagem || '-'}</td>
                      <td className="max-w-xs truncate">{item.falha}</td>
                      <td><span className="badge badge-safira">{item.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => void carregarHistorico(paginaHistorico - 1)}
              disabled={paginaHistorico <= 1 || carregandoHistorico}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <p className="text-sm text-slate-600" aria-live="polite">
              Página {paginaHistorico} de {Math.max(1, Math.ceil(totalHistorico / 10))}
            </p>
            <button
              type="button"
              onClick={() => void carregarHistorico(paginaHistorico + 1)}
              disabled={paginaHistorico >= Math.ceil(totalHistorico / 10) || carregandoHistorico}
              className="btn btn-secondary btn-sm disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </section>

        <div
          id="painel-admin"
          role="tabpanel"
          aria-labelledby="aba-admin"
          hidden={abaAtiva !== 'admin'}
        >
          <AdminFalhas
            falhas={falhasPredefinidas}
            onFalhasAtualizadas={carregarFalhasPredefinidas}
          />
        </div>

      </div>
    </main>
  );
}