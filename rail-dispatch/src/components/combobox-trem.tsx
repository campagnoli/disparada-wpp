'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, X, TrainFront, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface TremItem {
  id_trem: string;
}

export interface ComboboxTremProps {
  id?: string;
  valor: string;
  linhaSelecionada: string;
  aoMudar: (novoValor: string) => void;
  placeholder?: string;
  desabilitado?: boolean;
  carregando?: boolean;
  className?: string;
}

/**
 * Combobox / Autocomplete livre para ID do Trem.
 * Modelo: input único + dropdown abaixo (igual ao componente de seleção de falhas).
 * - Um único input, sempre visível.
 * - Clique ou digitação abre dropdown abaixo com sugestões.
 * - Busca trens da linha selecionada no Supabase.
 * - Permite seleção da lista OU digitação livre (ex: MRS 3740).
 * - Filtra em tempo real conforme digitação.
 * - Valor digitado é preservado mesmo que não exista na tabela trens.
 * - Nenhum input duplicado, nenhuma sobreposição.
 */
export function ComboboxTrem({
  id,
  valor,
  linhaSelecionada,
  aoMudar,
  placeholder = 'Ex: Q004, S024 ou digite livremente',
  desabilitado = false,
  carregando = false,
  className = '',
}: ComboboxTremProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [aberto, setAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [indiceFocado, setIndiceFocado] = useState(0);
  const [trensDisponiveis, setTrensDisponiveis] = useState<TremItem[]>([]);
  const [carregandoTrens, setCarregandoTrens] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Busca trens da linha selecionada no Supabase
  const buscarTrens = useCallback(async (linha: string) => {
    if (!linha || linha.trim() === '') {
      setTrensDisponiveis([]);
      return;
    }

    setCarregandoTrens(true);
    try {
      const { data, error } = await supabase
        .from('trens')
        .select('id_trem')
        .eq('linha', linha)
        .order('id_trem');

      if (error) {
        console.warn('Falha ao buscar trens do Supabase:', error.message);
        setTrensDisponiveis([]);
      } else {
        setTrensDisponiveis((data ?? []).map((item) => ({ id_trem: item.id_trem })));
      }
    } catch (err) {
      console.warn('Erro inesperado ao buscar trens:', err);
      setTrensDisponiveis([]);
    } finally {
      setCarregandoTrens(false);
    }
  }, []);

  useEffect(() => {
    buscarTrens(linhaSelecionada);
  }, [buscarTrens, linhaSelecionada]);

  // Filtra trens com base no termo de busca (o que está digitado no input principal)
  const trensFiltrados = useMemo(() => {
    const q = termoBusca.trim().toLowerCase();
    if (!q) return trensDisponiveis;
    return trensDisponiveis.filter((t) => t.id_trem.toLowerCase().includes(q));
  }, [trensDisponiveis, termoBusca]);

  // Verifica se o valor atual está na lista de trens oficiais
  const valorEstaNaLista = useMemo(() => {
    if (!valor) return false;
    return trensDisponiveis.some((t) => t.id_trem === valor);
  }, [valor, trensDisponiveis]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handleClickFora = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    document.addEventListener('touchstart', handleClickFora);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      document.removeEventListener('touchstart', handleClickFora);
    };
  }, [aberto]);

  // Auto-foca o input ao abrir e rola o item focado para vista
  useEffect(() => {
    if (!aberto) {
      setIndiceFocado(0);
      return;
    }
    setIndiceFocado(0);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [aberto]);

  useEffect(() => {
    if (!aberto || !listaRef.current) return;
    const elemento = listaRef.current.querySelector<HTMLElement>(`[data-index="${indiceFocado}"]`);
    if (elemento) {
      elemento.scrollIntoView({ block: 'nearest' });
    }
  }, [indiceFocado, aberto]);

  const selecionarTrem = (idTrem: string) => {
    aoMudar(idTrem);
    setTermoBusca(idTrem);
    setAberto(false);
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    aoMudar('');
    setTermoBusca('');
    setAberto(false);
  };

  const alternarAberto = () => {
    if (desabilitado || carregando) return;
    setAberto((prev) => !prev);
    if (!aberto) {
      setTermoBusca(valor);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setIndiceFocado((prev) => (prev < trensFiltrados.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAberto(true);
      setIndiceFocado((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (trensFiltrados.length > 0) {
        const idx = Math.max(0, Math.min(indiceFocado, trensFiltrados.length - 1));
        selecionarTrem(trensFiltrados[idx].id_trem);
      } else {
        // Digitação livre: mantém o que foi digitado e fecha
        setAberto(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAberto(false);
      setTermoBusca(valor);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoValor = e.target.value;
    setTermoBusca(novoValor);
    aoMudar(novoValor);
    setAberto(true);
  };

  const temValor = valor.trim().length > 0;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input principal - sempre visível, permite digitação direta */}
      <div className="relative w-full">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={aberto ? termoBusca : valor}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInput}
          onFocus={() => {
            if (!aberto && !desabilitado && !carregando) {
              setTermoBusca(valor);
              setAberto(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setAberto(false);
                setTermoBusca(valor);
              }
            }, 150);
          }}
          placeholder={aberto ? 'Filtrar trens...' : placeholder}
          maxLength={100}
          className={`w-full form-control pl-9 ${aberto ? 'border-safira ring-1 ring-safira/20' : ''} ${desabilitado ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        <div className="absolute left-2.5 top-1/2 -mt-2.5 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        {/* Botão limpar */}
        {!aberto && temValor && !desabilitado && !carregando && (
          <button
            type="button"
            onClick={limparSelecao}
            className="absolute right-2.5 top-1/2 -mt-2 p-1 rounded-md hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
            title="Limpar seleção"
            aria-label="Limpar seleção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botão abrir/fechar dropdown */}
        <button
          type="button"
          onClick={alternarAberto}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              alternarAberto();
            }
          }}
          disabled={desabilitado || carregando}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-controls={`${inputId}-listbox`}
          className="absolute right-2.5 top-1/2 -mt-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer ${aberto ? 'text-safira rotate-180' : ''}"
          title={aberto ? 'Fechar sugestões' : 'Abrir sugestões'}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200`} />
        </button>

        {carregandoTrens && (
          <span className="absolute right-2.5 bottom-1 text-[10px] text-slate-400 italic">
            Carregando trens...
          </span>
        )}
      </div>

      {/* Dropdown de sugestões ABAIXO do input (sem input dentro) */}
      {aberto && (
        <div
          className="absolute top-full mt-1 z-50 bg-white border border-slate-200 overflow-hidden rounded-xl shadow-2xl w-full min-w-[240px] sm:min-w-[320px]"
        >
          {/* Cabeçalho apenas com contador (não tem input de busca duplicado) */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{trensFiltrados.length} trem(s) encontrado(s)</span>
              <span className="hidden sm:inline">Use ↑↓ para navegar e Enter para escolher</span>
            </div>
          </div>

          {/* Lista de sugestões */}
          <ul
            ref={listaRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className="max-h-64 p-0 overflow-y-auto text-xs select-none focus:outline-none"
          >
            {trensFiltrados.length === 0 ? (
              <li className="p-4 text-center text-slate-500 space-y-1">
                <TrainFront className="w-6 h-6 mx-auto text-slate-300" />
                <p className="font-medium text-xs text-slate-700">
                  Nenhum trem para "{termoBusca}"
                </p>
                <p className="text-[11px] text-slate-400">
                  Digite livremente ou tente outro termo.
                </p>
              </li>
            ) : (
              trensFiltrados.map((trem, idx) => {
                const selecionado = trem.id_trem === valor;
                const focado = idx === indiceFocado;
                return (
                  <li
                    key={trem.id_trem}
                    role="option"
                    aria-selected={selecionado}
                    data-index={idx}
                    onClick={() => selecionarTrem(trem.id_trem)}
                    onMouseEnter={() => setIndiceFocado(idx)}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all ${selecionado ? 'bg-safira text-white font-semibold shadow-2xs' : focado ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${selecionado ? 'bg-white text-safira' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {selecionado ? '✓' : trem.id_trem.slice(0, 1)}
                      </span>
                      <span className="truncate font-medium">{trem.id_trem}</span>
                    </div>
                    {selecionado && <Check className="w-3.5 h-3.5 text-white" />}
                  </li>
                );
              })
            )}

            {/* Opção para usar valor manual quando nada encontrado */}
            {termoBusca.trim().length > 0 && trensFiltrados.length === 0 && (
              <li
                role="option"
                onClick={() => {
                  selecionarTrem(termoBusca.trim());
                }}
                className="px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all text-xs text-amber-700 hover:bg-amber-50 border-t border-amber-100"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 bg-amber-100 text-amber-700">
                    ✎
                  </span>
                  <span className="truncate font-medium">Usar valor: "{termoBusca}"</span>
                </div>
                <span className="text-[10px] font-medium text-amber-600">Salvar</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Hint visual quando valor não está na lista oficial */}
      {temValor && !valorEstaNaLista && !aberto && !desabilitado && (
        <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          <span className="font-medium">Valor não encontrado nos trens da linha "{linhaSelecionada}" — será salvo como digitado.</span>
        </p>
      )}
    </div>
  );
}

// Helper para gerar IDs únicos
function useId(): string {
  const [id] = useState(() => `cb-trem-${Math.random().toString(36).slice(2)}`);
  return id;
}
