'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Search,
  Layers,
  GitFork,
  ArrowUpDown,
  ArrowUpRight,
  ShieldCheck,
  DoorOpen,
  Filter,
} from 'lucide-react';

export interface EstacaoAdmin {
  id?: string;
  nome: string;
  sigla: string;
  linha: string;
  ordem: number;
  vias?: string[];
  plataformas?: string[];
  itens_infraestrutura?: string[];
}

interface AdminEstacoesProps {
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

const LINHAS_OPCOES = ['Linha 11-Coral', 'Linha 12-Safira', 'Linha 13-Jade'];

const ITENS_INFRAESTRUTURA_OPCOES = [
  { id: 'elevador', label: 'Elevador', icon: ArrowUpDown },
  { id: 'escada_rolante', label: 'Escada Rolante', icon: ArrowUpRight },
  { id: 'linha_bloqueio', label: 'Linha de Bloqueio (Catracas)', icon: ShieldCheck },
  { id: 'acesso_estacao', label: 'Acesso à Estação', icon: DoorOpen },
];

export default function AdminEstacoes({
  onNotificarErro,
  onNotificarSucesso,
}: AdminEstacoesProps) {
  const [estacoes, setEstacoes] = useState<EstacaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [filtroLinha, setFiltroLinha] = useState<string>('todas');
  const [busca, setBusca] = useState('');

  // Estado do formulário de criação/edição
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formSigla, setFormSigla] = useState('');
  const [formLinha, setFormLinha] = useState('Linha 11-Coral');
  const [formOrdem, setFormOrdem] = useState<number>(1);
  const [formVias, setFormVias] = useState<string[]>([]);
  const [novaVia, setNovaVia] = useState('');
  const [formPlataformas, setFormPlataformas] = useState<string[]>([]);
  const [novaPlataforma, setNovaPlataforma] = useState('');
  const [formItensInfra, setFormItensInfra] = useState<string[]>([
    'elevador',
    'escada_rolante',
    'linha_bloqueio',
    'acesso_estacao',
  ]);

  const carregarEstacoes = async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/admin/estacoes');
      const data = (await res.json()) as { estacoes?: EstacaoAdmin[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao buscar estações.');
      setEstacoes(data.estacoes ?? []);
    } catch (err: unknown) {
      console.error('Erro ao listar estações:', err);
      onNotificarErro?.(err, 'Carregamento de estações');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarEstacoes();
  }, []);

  const resetForm = () => {
    setEditandoId(null);
    setFormNome('');
    setFormSigla('');
    setFormLinha('Linha 11-Coral');
    setFormOrdem(estacoes.length + 1);
    setFormVias([]);
    setNovaVia('');
    setFormPlataformas([]);
    setNovaPlataforma('');
    setFormItensInfra(['elevador', 'escada_rolante', 'linha_bloqueio', 'acesso_estacao']);
    setFormAberto(false);
  };

  const iniciarCriacao = () => {
    resetForm();
    setFormAberto(true);
  };

  const iniciarEdicao = (estacao: EstacaoAdmin) => {
    setEditandoId(estacao.id || estacao.sigla);
    setFormNome(estacao.nome);
    setFormSigla(estacao.sigla);
    setFormLinha(estacao.linha);
    setFormOrdem(estacao.ordem ?? 1);
    setFormVias(estacao.vias ? [...estacao.vias] : []);
    setNovaVia('');
    setFormPlataformas(estacao.plataformas ? [...estacao.plataformas] : []);
    setNovaPlataforma('');
    setFormItensInfra(
      estacao.itens_infraestrutura ? [...estacao.itens_infraestrutura] : ['elevador', 'escada_rolante', 'linha_bloqueio', 'acesso_estacao']
    );
    setFormAberto(true);
  };

  const adicionarVia = (viaTexto: string) => {
    const limpa = viaTexto.trim().replace(/^via\s+/i, '');
    if (!limpa) return;
    if (!formVias.includes(limpa)) {
      setFormVias((prev) => [...prev, limpa]);
    }
    setNovaVia('');
  };

  const removerVia = (viaItem: string) => {
    setFormVias((prev) => prev.filter((v) => v !== viaItem));
  };

  const adicionarPlataforma = (platTexto: string) => {
    const limpa = platTexto.trim().replace(/^plat(?:aforma)?\s+/i, '');
    if (!limpa) return;
    if (!formPlataformas.includes(limpa)) {
      setFormPlataformas((prev) => [...prev, limpa]);
    }
    setNovaPlataforma('');
  };

  const removerPlataforma = (platItem: string) => {
    setFormPlataformas((prev) => prev.filter((p) => p !== platItem));
  };

  const toggleInfra = (infraId: string) => {
    setFormItensInfra((prev) =>
      prev.includes(infraId) ? prev.filter((id) => id !== infraId) : [...prev, infraId]
    );
  };

  const salvarEstacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formSigla.trim() || !formLinha.trim()) {
      onNotificarErro?.(new Error('Preencha nome, sigla e linha da estação.'));
      return;
    }

    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        nome: formNome.trim(),
        sigla: formSigla.trim().toUpperCase(),
        linha: formLinha.trim(),
        ordem: Number(formOrdem) || 1,
        vias: formVias,
        plataformas: formPlataformas,
        itens_infraestrutura: formItensInfra,
      };

      if (editandoId && editandoId.includes('-')) {
        payload.id = editandoId;
      }

      const res = await fetch('/api/admin/estacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { sucesso?: boolean; mensagem?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar estação.');

      onNotificarSucesso?.('Estação Salva', data.mensagem || 'Dados da estação salvos com sucesso!');
      resetForm();
      await carregarEstacoes();
    } catch (err: unknown) {
      console.error('Falha ao salvar estação:', err);
      onNotificarErro?.(err, 'Salvar Estação');
    } finally {
      setSalvando(false);
    }
  };

  const excluirEstacao = async (estacao: EstacaoAdmin) => {
    const confirmacao = window.confirm(
      `Deseja realmente excluir a estação ${estacao.nome} (${estacao.sigla}) da ${estacao.linha}?`
    );
    if (!confirmacao) return;

    try {
      let url = '/api/admin/estacoes?';
      if (estacao.id) {
        url += `id=${encodeURIComponent(estacao.id)}`;
      } else {
        url += `sigla=${encodeURIComponent(estacao.sigla)}&linha=${encodeURIComponent(estacao.linha)}`;
      }

      const res = await fetch(url, { method: 'DELETE' });
      const data = (await res.json()) as { sucesso?: boolean; mensagem?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir estação.');

      onNotificarSucesso?.('Estação Removida', data.mensagem || 'Estação excluída com sucesso.');
      await carregarEstacoes();
    } catch (err: unknown) {
      console.error('Falha ao excluir estação:', err);
      onNotificarErro?.(err, 'Excluir Estação');
    }
  };

  const estacoesFiltradas = useMemo(() => {
    return estacoes.filter((e) => {
      const matchLinha = filtroLinha === 'todas' || e.linha.includes(filtroLinha) || filtroLinha.includes(e.linha);
      const termo = busca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        e.sigla.toLowerCase().includes(termo);
      return matchLinha && matchBusca;
    });
  }, [estacoes, filtroLinha, busca]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-safira" />
            Cadastro e Gestão de Estações
          </h2>
          <p className="text-xs text-slate-500">
            Cadastre estações, configure vias, plataformas e equipamentos de infraestrutura para cada linha operacional.
          </p>
        </div>

        {!formAberto && (
          <button
            type="button"
            onClick={iniciarCriacao}
            className="btn btn-primary inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nova Estação
          </button>
        )}
      </div>

      {/* Formulário de Criação / Edição */}
      {formAberto && (
        <form
          onSubmit={salvarEstacao}
          className="rounded-xl border border-safira/30 bg-safira/5 p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-safira/20 pb-3">
            <h3 className="text-sm font-bold text-safira flex items-center gap-2">
              {editandoId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editandoId ? `Editar Estação: ${formNome} (${formSigla})` : 'Nova Estação'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label block">Nome Completo da Estação *</label>
              <input
                type="text"
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Palmeiras-Barra Funda"
                className="w-full form-input"
              />
            </div>

            <div>
              <label className="form-label block">Sigla Oficial (3 letras) *</label>
              <input
                type="text"
                required
                maxLength={4}
                value={formSigla}
                onChange={(e) => setFormSigla(e.target.value.toUpperCase())}
                placeholder="Ex: BFU"
                className="w-full form-input uppercase font-mono font-bold"
              />
            </div>

            <div>
              <label className="form-label block">Ordem Física na Linha *</label>
              <input
                type="number"
                required
                min={0}
                value={formOrdem}
                onChange={(e) => setFormOrdem(Number(e.target.value))}
                className="w-full form-input font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="form-label block">Linha Operacional *</label>
              <select
                value={formLinha}
                onChange={(e) => setFormLinha(e.target.value)}
                className="w-full form-select"
              >
                {LINHAS_OPCOES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Configuração de Vias da Estação */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <GitFork className="w-4 h-4 text-safira" />
              Vias Locais da Estação
              <span className="text-[11px] font-normal text-slate-500">
                (ex: Vias de parada, manobra ou loop locais)
              </span>
            </label>

            <div className="flex flex-wrap gap-2 items-center">
              {formVias.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhuma via específica adicionada.</span>
              ) : (
                formVias.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-safira/10 text-safira border border-safira/30"
                  >
                    Via {v}
                    <button
                      type="button"
                      onClick={() => removerVia(v)}
                      className="hover:text-rose-600 cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={novaVia}
                onChange={(e) => setNovaVia(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionarVia(novaVia);
                  }
                }}
                placeholder="Digitar via (ex: 1, 2, 4) e clicar em adicionar"
                className="form-input text-xs flex-1 max-w-xs"
              />
              <button
                type="button"
                onClick={() => adicionarVia(novaVia)}
                className="btn btn-secondary btn-sm cursor-pointer"
              >
                + Adicionar Via
              </button>
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 ml-2">
                <span>Rápidos:</span>
                {['1', '2', '3', '4'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => adicionarVia(sug)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer"
                  >
                    +{sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Configuração de Plataformas da Estação */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Plataformas de Embarque da Estação
              <span className="text-[11px] font-normal text-slate-500">
                (ex: Plataformas 7, 8, 9, 10 para Barra Funda; 3, 4, 5 para Brás L11)
              </span>
            </label>

            <div className="flex flex-wrap gap-2 items-center">
              {formPlataformas.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhuma plataforma cadastrada.</span>
              ) : (
                formPlataformas.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300"
                  >
                    Plataforma {p}
                    <button
                      type="button"
                      onClick={() => removerPlataforma(p)}
                      className="hover:text-rose-600 cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={novaPlataforma}
                onChange={(e) => setNovaPlataforma(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionarPlataforma(novaPlataforma);
                  }
                }}
                placeholder="Digitar plataforma (ex: 7, 8) e clicar em adicionar"
                className="form-input text-xs flex-1 max-w-xs"
              />
              <button
                type="button"
                onClick={() => adicionarPlataforma(novaPlataforma)}
                className="btn btn-secondary btn-sm cursor-pointer"
              >
                + Adicionar Plataforma
              </button>
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 ml-2">
                <span>Rápidos:</span>
                {['1', '2', '3', '4', '7', '8', '9', '10'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => adicionarPlataforma(sug)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer"
                  >
                    +{sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Itens de Infraestrutura */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-800 block">
              Equipamentos e Itens de Infraestrutura Presentes na Estação
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {ITENS_INFRAESTRUTURA_OPCOES.map((item) => {
                const Icone = item.icon;
                const selecionado = formItensInfra.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleInfra(item.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer ${
                      selecionado
                        ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icone className={`w-4 h-4 ${selecionado ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-xs">{selecionado ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botões do Formulário */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={salvando}
              className="btn btn-secondary cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="btn btn-primary inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando Estação...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Estação
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-600 shrink-0">Filtrar Linha:</span>
          {['todas', ...LINHAS_OPCOES].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setFiltroLinha(l)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                filtroLinha === l
                  ? 'bg-safira text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {l === 'todas' ? 'Todas as Linhas' : l.replace('Linha ', '')}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou sigla..."
            className="w-full form-input pl-9 text-xs"
          />
        </div>
      </div>

      {/* Lista de Estações */}
      {carregando ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-safira" />
          <span className="text-xs">Carregando estações cadastradas...</span>
        </div>
      ) : estacoesFiltradas.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white p-6 space-y-2">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Nenhuma estação encontrada</p>
          <p className="text-xs text-slate-400">
            {busca || filtroLinha !== 'todas'
              ? 'Tente ajustar os filtros de busca ou linha acima.'
              : 'Clique em "Nova Estação" para cadastrar a primeira estação da malha.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {estacoesFiltradas.map((estacao) => (
            <div
              key={`${estacao.linha}-${estacao.sigla}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                        {estacao.sigla}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{estacao.nome}</h4>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      {estacao.linha} • Ordem física #{estacao.ordem}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => iniciarEdicao(estacao)}
                      title="Editar Estação"
                      className="p-1.5 text-slate-400 hover:text-safira hover:bg-safira/10 rounded-md cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void excluirEstacao(estacao)}
                      title="Excluir Estação"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Vias e Plataformas */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Vias:</span>
                    {estacao.vias && estacao.vias.length > 0 ? (
                      estacao.vias.map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-safira/10 text-safira border border-safira/20"
                        >
                          {v.toLowerCase().startsWith('via') ? v : `Via ${v}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Padrão da linha</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Plataformas:</span>
                    {estacao.plataformas && estacao.plataformas.length > 0 ? (
                      estacao.plataformas.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          Plat {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Não cadastradas</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens de Infraestrutura */}
              <div className="border-t border-slate-100 pt-2.5 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                {(estacao.itens_infraestrutura || []).includes('elevador') && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                    <ArrowUpDown className="w-3 h-3 text-sky-600" /> Elevador
                  </span>
                )}
                {(estacao.itens_infraestrutura || []).includes('escada_rolante') && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                    <ArrowUpRight className="w-3 h-3 text-indigo-600" /> Escada Rolante
                  </span>
                )}
                {(estacao.itens_infraestrutura || []).includes('linha_bloqueio') && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                    <ShieldCheck className="w-3 h-3 text-amber-600" /> Catracas
                  </span>
                )}
                {(estacao.itens_infraestrutura || []).includes('acesso_estacao') && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                    <DoorOpen className="w-3 h-3 text-emerald-600" /> Acesso
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
