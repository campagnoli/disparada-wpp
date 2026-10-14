'use client';

import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Search, ChevronDown, X, Check, TrainFront, SearchX } from 'lucide-react';

export interface EstacaoItem {
  id?: string;
  nome: string;
  sigla: string;
  linha: string;
  ordem?: number;
  vias?: string[];
  plataformas?: string[];
  itens_infraestrutura?: string[];
}

export interface SeletorEstacaoProps {
  id?: string;
  estacoes: EstacaoItem[];
  valor: string;
  aoMudar: (novoValor: string, estacaoSelecionada?: EstacaoItem | null) => void;
  formatoValor?: 'sigla|linha' | 'sigla';
  placeholder?: string;
  desabilitado?: boolean;
  carregando?: boolean;
  obrigatorio?: boolean;
  alinhamento?: 'esquerda' | 'direita' | 'auto';
  mostrarBadgeLinha?: boolean;
  visualCompacto?: boolean;
  className?: string;
}

/**
 * Remove acentos e converte para minúsculas para busca fonética e flexível.
 */
function normalizarTexto(txt: string): string {
  return (txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Retorna cores visuais adequadas para as linhas ferroviárias de SP.
 */
function obterEstiloLinha(linha?: string): string {
  if (!linha) return 'bg-slate-100 text-slate-700 border-slate-200';
  const l = linha.toLowerCase();
  if (l.includes('coral') || l.includes('11')) {
    return 'bg-orange-50 text-orange-800 border-orange-200';
  }
  if (l.includes('safira') || l.includes('12')) {
    return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  }
  if (l.includes('jade') || l.includes('13')) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (l.includes('rubi') || l.includes('7')) {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  if (l.includes('diamante') || l.includes('8')) {
    return 'bg-slate-100 text-slate-800 border-slate-300';
  }
  if (l.includes('esmeralda') || l.includes('9')) {
    return 'bg-teal-50 text-teal-800 border-teal-200';
  }
  if (l.includes('turquesa') || l.includes('10')) {
    return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function SeletorEstacao({
  id,
  estacoes,
  valor,
  aoMudar,
  formatoValor = 'sigla|linha',
  placeholder = 'Digite ou selecione uma estação...',
  desabilitado = false,
  carregando = false,
  obrigatorio = false,
  alinhamento = 'auto',
  mostrarBadgeLinha = true,
  visualCompacto = false,
  className = '',
}: SeletorEstacaoProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [aberto, setAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [indiceFocado, setIndiceFocado] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputBuscaRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Localiza a estação selecionada atualmente
  const estacaoSelecionada = useMemo(() => {
    if (!valor) return null;
    if (formatoValor === 'sigla|linha' || valor.includes('|')) {
      const [sigla, linha] = valor.split('|');
      return (
        estacoes.find((e) => e.sigla === sigla && (!linha || e.linha === linha)) ||
        estacoes.find((e) => e.sigla === sigla) ||
        null
      );
    }
    return estacoes.find((e) => e.sigla === valor) || null;
  }, [valor, formatoValor, estacoes]);

  // Filtra e pontua as estações com base no termo de busca (sem acentos e case-insensitive)
  const estacoesFiltradas = useMemo(() => {
    const q = normalizarTexto(termoBusca);
    if (!q) return estacoes;

    return estacoes
      .filter((e) => {
        const nome = normalizarTexto(e.nome);
        const sigla = normalizarTexto(e.sigla);
        const linha = normalizarTexto(e.linha);
        return nome.includes(q) || sigla.includes(q) || linha.includes(q);
      })
      .sort((a, b) => {
        // Prioriza correspondência exata de sigla
        const siglaA = normalizarTexto(a.sigla);
        const siglaB = normalizarTexto(b.sigla);
        if (siglaA === q && siglaB !== q) return -1;
        if (siglaB === q && siglaA !== q) return 1;

        // Prioriza início de nome
        const nomeA = normalizarTexto(a.nome);
        const nomeB = normalizarTexto(b.nome);
        if (nomeA.startsWith(q) && !nomeB.startsWith(q)) return -1;
        if (nomeB.startsWith(q) && !nomeA.startsWith(q)) return 1;

        return (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome);
      });
  }, [estacoes, termoBusca]);

  // Agrupa estações por linha quando não há termo de busca ativo
  const agrupadoPorLinha = useMemo(() => {
    if (termoBusca.trim().length > 0) return null;

    // Detecta se há mais de uma linha na lista
    const linhasUnicas = new Set(estacoes.map((e) => e.linha || 'Outras'));
    if (linhasUnicas.size <= 1) return null;

    const grupos: Record<string, EstacaoItem[]> = {};
    for (const est of estacoesFiltradas) {
      const l = est.linha || 'Outras';
      if (!grupos[l]) grupos[l] = [];
      grupos[l].push(est);
    }
    return grupos;
  }, [estacoes, estacoesFiltradas, termoBusca]);

  // Fecha o dropdown ao clicar fora do componente
  useEffect(() => {
    if (!aberto) return;

    const handleClickFora = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
        setTermoBusca('');
      }
    };

    document.addEventListener('mousedown', handleClickFora);
    document.addEventListener('touchstart', handleClickFora);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      document.removeEventListener('touchstart', handleClickFora);
    };
  }, [aberto]);

  // Auto-foca o input de busca assim que o dropdown se abre
  useEffect(() => {
    if (aberto) {
      setIndiceFocado(0);
      const timer = setTimeout(() => {
        inputBuscaRef.current?.focus();
        inputBuscaRef.current?.select();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setTermoBusca('');
    }
  }, [aberto]);

  // Rola o item focado para a área visível ao navegar via setas
  useEffect(() => {
    if (!aberto || !listaRef.current) return;
    const elemento = listaRef.current.querySelector<HTMLElement>(`[data-index="${indiceFocado}"]`);
    if (elemento) {
      elemento.scrollIntoView({ block: 'nearest' });
    }
  }, [indiceFocado, aberto]);

  const selecionarEstacao = (estacao: EstacaoItem) => {
    const novoValor = formatoValor === 'sigla|linha' ? `${estacao.sigla}|${estacao.linha}` : estacao.sigla;
    aoMudar(novoValor, estacao);
    setAberto(false);
    setTermoBusca('');
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    aoMudar('', null);
    setTermoBusca('');
  };

  const alternarAberto = () => {
    if (desabilitado || carregando) return;
    setAberto((prev) => !prev);
  };

  // Suporte a navegação por teclado no gatilho
  const handleKeyDownGatilho = (e: React.KeyboardEvent) => {
    if (desabilitado || carregando) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setAberto(true);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Se usuário pressionar uma letra no teclado, abre com a letra digitada
      setTermoBusca(e.key);
      setAberto(true);
    }
  };

  // Suporte a navegação por teclado dentro do campo de busca
  const handleKeyDownBusca = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceFocado((prev) => (prev < estacoesFiltradas.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceFocado((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (estacoesFiltradas.length > 0) {
        const idx = Math.max(0, Math.min(indiceFocado, estacoesFiltradas.length - 1));
        selecionarEstacao(estacoesFiltradas[idx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAberto(false);
      setTermoBusca('');
    }
  };

  // Define a posição horizontal do popover
  const classesAlinhamento =
    alinhamento === 'direita'
      ? 'right-0 sm:left-auto min-w-[300px] w-full sm:w-[320px]'
      : alinhamento === 'esquerda'
      ? 'left-0 sm:right-auto min-w-[300px] w-full sm:w-[320px]'
      : 'left-0 right-0 w-full min-w-[280px] sm:min-w-[320px]';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Campo oculto para formulários padrão */}
      <input type="hidden" id={inputId} value={valor} required={obrigatorio} />

      {/* Botão Gatilho (Parecido com um Select nativo, mas moderno e clicável) */}
      <button
        type="button"
        onClick={alternarAberto}
        onKeyDown={handleKeyDownGatilho}
        disabled={desabilitado || carregando}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${inputId}-listbox`}
        className={`w-full form-select flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${
          aberto ? 'border-safira ring-2 ring-safira/20' : ''
        } ${
          desabilitado || carregando
            ? 'opacity-60 bg-slate-100 cursor-not-allowed hover:border-slate-300'
            : 'bg-white hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 py-0.5">
          <TrainFront
            className={`w-4 h-4 shrink-0 transition-colors ${
              estacaoSelecionada ? 'text-safira' : 'text-slate-400'
            }`}
          />
          {carregando ? (
            <span className="text-slate-400 text-xs italic">Carregando estações...</span>
          ) : estacaoSelecionada ? (
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="font-semibold text-slate-900 truncate text-sm">
                {estacaoSelecionada.nome}
              </span>
              <span className="text-xs text-slate-500 font-mono shrink-0">
                ({estacaoSelecionada.sigla})
              </span>
              {mostrarBadgeLinha && estacaoSelecionada.linha && (
                <span
                  className={`hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border shrink-0 ${obterEstiloLinha(
                    estacaoSelecionada.linha
                  )}`}
                >
                  {estacaoSelecionada.linha}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {estacaoSelecionada && !desabilitado && !carregando && (
            <span
              role="button"
              tabIndex={0}
              onClick={limparSelecao}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  limparSelecao(e as unknown as React.MouseEvent);
                }
              }}
              title="Limpar seleção"
              className="p-1 rounded-md hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              aberto ? 'rotate-180 text-safira' : 'text-slate-400'
            }`}
          />
        </div>
      </button>

      {/* Menu Flutuante / Popover de Pesquisa */}
      {aberto && (
        <div
          className={`absolute top-full mt-1.5 z-50 bg-white border border-slate-200 overflow-hidden ${
            visualCompacto ? 'rounded-md shadow-lg' : 'rounded-xl shadow-2xl'
          } ${classesAlinhamento}`}
        >
          {/* Campo de Digitação Direta / Busca em Tempo Real */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={inputBuscaRef}
                type="text"
                value={termoBusca}
                onChange={(e) => {
                  setTermoBusca(e.target.value);
                  setIndiceFocado(0);
                }}
                onKeyDown={handleKeyDownBusca}
                placeholder="Digite o nome, sigla ou linha..."
                className="w-full text-xs py-2 pl-9 pr-8 bg-white border border-slate-200 rounded-lg outline-none focus:border-safira focus:ring-1 focus:ring-safira transition-all placeholder:text-slate-400"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => {
                    setTermoBusca('');
                    setIndiceFocado(0);
                    inputBuscaRef.current?.focus();
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-0.5">
              <span>{estacoesFiltradas.length} encontrada(s)</span>
              <span className="hidden sm:inline">Use ↑↓ para navegar e Enter para escolher</span>
            </div>
          </div>

          {/* Lista com Rolagem das Estações */}
          <ul
            ref={listaRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className={`${visualCompacto ? 'max-h-52 p-1' : 'max-h-64 p-1.5'} overflow-y-auto space-y-0.5 text-xs select-none focus:outline-none`}
          >
            {estacoesFiltradas.length === 0 ? (
              <li className="p-4 text-center text-slate-500 space-y-1">
                <SearchX className="w-6 h-6 mx-auto text-slate-300" />
                <p className="font-medium text-xs text-slate-700">
                  Nenhuma estação para &ldquo;{termoBusca}&rdquo;
                </p>
                <p className="text-[11px] text-slate-400">
                  Busque pelo nome (ex: Luz, Brás), sigla (ex: BAS) ou número da linha.
                </p>
              </li>
            ) : agrupadoPorLinha ? (
              // Agrupamento Visual por Linha (quando sem busca digitada)
              Object.entries(agrupadoPorLinha).map(([linhaNome, listaEst], gIdx) => (
                <li key={linhaNome} className="space-y-0.5">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400 bg-slate-50/60 rounded flex items-center justify-between">
                    <span>{linhaNome}</span>
                    <span className="text-[9px] font-normal text-slate-400">{listaEst.length} est.</span>
                  </div>
                  <ul className="space-y-0.5">
                    {listaEst.map((estacao) => {
                      const idxGlobal = estacoesFiltradas.findIndex(
                        (e) => e.sigla === estacao.sigla && e.linha === estacao.linha
                      );
                      const selecionado =
                        estacaoSelecionada?.sigla === estacao.sigla &&
                        (!estacaoSelecionada?.linha || estacaoSelecionada.linha === estacao.linha);
                      const focado = idxGlobal === indiceFocado;

                      return (
                        <li
                          key={`${estacao.sigla}-${estacao.linha}`}
                          role="option"
                          aria-selected={selecionado}
                          data-index={idxGlobal}
                          onClick={() => selecionarEstacao(estacao)}
                          onMouseEnter={() => setIndiceFocado(idxGlobal)}
                          className={`px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all ${
                            selecionado
                              ? 'bg-safira text-white font-semibold shadow-2xs'
                              : focado
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                                selecionado
                                  ? 'bg-white text-safira'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {selecionado ? '✓' : estacao.sigla.slice(0, 1)}
                            </span>
                            <span className="truncate font-medium">{estacao.nome}</span>
                            <span
                              className={`text-[11px] font-mono shrink-0 ${
                                selecionado ? 'text-white/80' : 'text-slate-400'
                              }`}
                            >
                              ({estacao.sigla})
                            </span>
                          </div>
                          {selecionado && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            ) : (
              // Lista Linear / Filtrada por Digitação
              estacoesFiltradas.map((estacao, idx) => {
                const selecionado =
                  estacaoSelecionada?.sigla === estacao.sigla &&
                  (!estacaoSelecionada?.linha || estacaoSelecionada.linha === estacao.linha);
                const focado = idx === indiceFocado;

                return (
                  <li
                    key={`${estacao.sigla}-${estacao.linha}`}
                    role="option"
                    aria-selected={selecionado}
                    data-index={idx}
                    onClick={() => selecionarEstacao(estacao)}
                    onMouseEnter={() => setIndiceFocado(idx)}
                    className={`px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all ${
                      selecionado
                        ? 'bg-safira text-white font-semibold shadow-2xs'
                        : focado
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                          selecionado
                            ? 'bg-white text-safira'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selecionado ? '✓' : estacao.sigla.slice(0, 1)}
                      </span>
                      <span className="truncate font-medium">{estacao.nome}</span>
                      <span
                        className={`text-[11px] font-mono shrink-0 ${
                          selecionado ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        ({estacao.sigla})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {estacao.linha && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${
                            selecionado
                              ? 'bg-white/20 text-white border-white/30'
                              : obterEstiloLinha(estacao.linha)
                          }`}
                        >
                          {estacao.linha}
                        </span>
                      )}
                      {selecionado && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
