'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Save, RotateCcw, Copy, Check, Info, Code, Tag, RefreshCw, FileText } from 'lucide-react';

interface AdminPromptProps {
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

interface DadosPromptAPI {
  prompt: string;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
  promptPadrao: string;
}

export default function AdminPrompt({ onNotificarErro, onNotificarSucesso }: AdminPromptProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [promptOriginal, setPromptOriginal] = useState('');
  const [promptEditado, setPromptEditado] = useState('');
  const [promptPadrao, setPromptPadrao] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'supabase' | 'local' | 'padrao'>('padrao');
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregarPrompt = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/prompt', { cache: 'no-store' });
      const data = (await res.json()) as DadosPromptAPI;
      if (!res.ok) throw new Error('Não foi possível obter o prompt do sistema.');

      setPromptOriginal(data.prompt);
      setPromptEditado(data.prompt);
      setPromptPadrao(data.promptPadrao);
      setIsCustom(data.isCustom);
      setUpdatedAt(data.updatedAt);
      setOrigem(data.origem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar prompt.';
      setErro(msg);
      onNotificarErro?.(err, 'Carregamento do Prompt');
    } finally {
      setCarregando(false);
    }
  }, [onNotificarErro]);

  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      try {
        const res = await fetch('/api/admin/prompt', { cache: 'no-store' });
        const data = (await res.json()) as DadosPromptAPI;
        if (!res.ok) throw new Error('Não foi possível obter o prompt do sistema.');

        if (!ativo) return;
        setPromptOriginal(data.prompt);
        setPromptEditado(data.prompt);
        setPromptPadrao(data.promptPadrao);
        setIsCustom(data.isCustom);
        setUpdatedAt(data.updatedAt);
        setOrigem(data.origem);
      } catch (err: unknown) {
        if (!ativo) return;
        const msg = err instanceof Error ? err.message : 'Falha ao carregar prompt.';
        setErro(msg);
        onNotificarErro?.(err, 'Carregamento do Prompt');
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void inicializar();

    return () => {
      ativo = false;
    };
  }, [onNotificarErro]);

  const handleSalvar = async () => {
    if (!promptEditado.trim()) {
      setErro('O prompt não pode ficar vazio.');
      return;
    }

    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptEditado.trim() }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
        prompt?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao salvar as alterações do prompt.');
      }

      setPromptOriginal(promptEditado.trim());
      setIsCustom(true);
      setUpdatedAt(new Date().toISOString());
      const msgSucesso = data.mensagem || 'Prompt do Gemini atualizado com sucesso!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('Prompt Atualizado', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar o prompt.';
      setErro(msg);
      onNotificarErro?.(err, 'Edição do Prompt');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = async () => {
    if (!window.confirm('Tem certeza de que deseja descartar as alterações e restaurar as instruções de sistema originais de fábrica?')) {
      return;
    }

    setRestaurando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurarPadrao: true }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
        prompt?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao restaurar o prompt padrão.');
      }

      const promptRestaurado = data.prompt || promptPadrao;
      setPromptOriginal(promptRestaurado);
      setPromptEditado(promptRestaurado);
      setIsCustom(false);
      setUpdatedAt(null);
      setOrigem('padrao');
      const msgSucesso = 'Instruções de fábrica restauradas com sucesso!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('Prompt Restaurado', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao restaurar prompt.';
      setErro(msg);
      onNotificarErro?.(err, 'Restauração do Prompt');
    } finally {
      setRestaurando(false);
    }
  };

  const copiarPrompt = () => {
    navigator.clipboard.writeText(promptEditado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const inserirTag = (tag: string) => {
    setPromptEditado((prev) => {
      if (prev.includes(tag)) return prev;
      return `${prev}\n\n${tag}`;
    });
  };

  const houveAlteracao = promptEditado !== promptOriginal;
  const qtdCaracteres = promptEditado.length;
  const qtdLinhas = promptEditado.split('\n').length;

  if (carregando) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-safira" />
        <span>Carregando configurações do prompt...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho do Editor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-safira" />
              Instruções de Sistema do Gemini (System Instruction)
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCustom
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isCustom ? 'Prompt Customizado Ativo' : 'Padrão de Fábrica'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalize as orientações de tom, estrutura e vocabulário enviadas à IA para compor as mensagens dos 3 grupos.
            {origem === 'supabase' && ' (Sincronizado na nuvem Supabase)'}
            {origem === 'local' && ' (Persistido no servidor da aplicação)'}
            {updatedAt && (
              <span className="ml-1 text-slate-400">
                · Atualizado em {new Date(updatedAt).toLocaleString('pt-BR')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void carregarPrompt()}
            disabled={carregando || salvando}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Recarregar prompt do servidor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Recarregar</span>
          </button>

          <button
            type="button"
            onClick={copiarPrompt}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Copiar texto do prompt"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
          </button>

          {isCustom && (
            <button
              type="button"
              disabled={restaurando || salvando}
              onClick={() => void handleRestaurarPadrao()}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-rose-700 hover:bg-rose-50 border-rose-200"
              title="Restaurar o texto original de fábrica"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>{restaurando ? 'Restaurando...' : 'Restaurar padrão'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={salvando || !houveAlteracao}
            onClick={() => void handleSalvar()}
            className="btn btn-safira btn-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{salvando ? 'Salvando...' : 'Salvar alterações'}</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
          {erro}
        </div>
      )}

      {aviso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
          {aviso}
        </div>
      )}

      {/* Caixa de Tags Dinâmicas Disponíveis */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Tag className="w-3.5 h-3.5 text-safira" />
          <span>Tags dinâmicas que o sistema preenche em tempo de execução:</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Você pode posicionar estas tags em qualquer ponto do texto. Se forem omitidas, o sistema anexará os dados automaticamente ao final do prompt.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { tag: '{{LINHA}}', desc: 'Nome da linha operacional atual (ex: LINHA 11-CORAL)' },
            { tag: '{{DICIONARIO_ESTACOES}}', desc: 'Relação completa de siglas e nomes de estações' },
            { tag: '{{EXEMPLOS_HISTORICO}}', desc: 'Exemplos reais recuperados por Few-Shot' },
            { tag: '{{LOOPS_ORIENTACOES}}', desc: 'Orientações didáticas sobre circulação em loops' },
          ].map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => inserirTag(item.tag)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700 hover:border-safira hover:text-safira transition-colors shadow-2xs"
              title={`Clique para inserir: ${item.desc}`}
            >
              <Code className="w-3 h-3 text-safira" />
              <span className="font-semibold">{item.tag}</span>
              <span className="text-[10px] text-slate-400 font-sans hidden md:inline">({item.desc})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Área de Edição do Prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <label htmlFor="editor-prompt-gemini" className="font-semibold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Corpo do Prompt (Texto das Instruções de Sistema)
          </label>
          <span className="font-mono text-[11px]">
            {qtdLinhas} linhas | {qtdCaracteres} caracteres
            {houveAlteracao && <span className="ml-2 text-amber-600 font-semibold">(Alterações não salvas)</span>}
          </span>
        </div>

        <div className="relative rounded-lg border border-slate-300 focus-within:border-safira focus-within:ring-1 focus-within:ring-safira bg-white shadow-2xs">
          <textarea
            id="editor-prompt-gemini"
            rows={18}
            value={promptEditado}
            onChange={(e) => setPromptEditado(e.target.value)}
            placeholder="Digite aqui as instruções que o modelo Gemini deve seguir..."
            className="w-full p-4 font-mono text-xs leading-relaxed text-slate-800 bg-transparent border-none outline-hidden resize-y min-h-[420px]"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Barra de Rodapé com Dica e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-safira flex-shrink-0" />
          <span>As alterações entram em vigor imediatamente na próxima ocorrência despachada, sem necessidade de reiniciar o servidor.</span>
        </div>

        {houveAlteracao && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPromptEditado(promptOriginal)}
              className="btn btn-secondary btn-sm"
            >
              Descartar alterações
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void handleSalvar()}
              className="btn btn-safira btn-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{salvando ? 'Salvando...' : 'Salvar alterações'}</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
