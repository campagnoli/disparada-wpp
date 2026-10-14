'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, FileText, LogOut, MapPin, Plus, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import AdminPrompt from '@/app/admin-prompt';
import AdminTemplates from '@/app/admin-templates';
import AdminWhatsApp from '@/app/admin-whatsapp';
import AdminEstacoes from '@/app/admin-estacoes';

export interface FalhaPredefinida {
  id: number;
  descricao: string;
  impacto: string;
  ordem: number;
}

interface AdminFalhasProps {
  falhas: FalhaPredefinida[];
  onFalhasAtualizadas: () => Promise<void>;
  onNotificarErro?: (erro: unknown, contexto?: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

function parseCSV(text: string): { falhas: { descricao: string; impacto: string }[]; erros: string[] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length === 0) {
    return { falhas: [], erros: ['O arquivo CSV está vazio.'] };
  }

  const firstLine = lines[0];
  const countSemicolon = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const delimiter = countSemicolon >= countComma ? ';' : ',';

  function splitLine(line: string): string[] {
    const cols: string[] = [];
    let col = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const nc = line[i + 1];
      if (c === '"') {
        if (inQ && nc === '"') {
          col += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === delimiter && !inQ) {
        cols.push(col.trim());
        col = '';
      } else {
        col += c;
      }
    }
    cols.push(col.trim());
    return cols;
  }

  const rawRows = lines.map(splitLine);
  if (rawRows.length === 0) {
    return { falhas: [], erros: ['Nenhuma linha de dados encontrada no arquivo CSV.'] };
  }

  const header = rawRows[0].map((h) =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  );

  let colDescricao = -1;
  let colImpacto = -1;

  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (h.includes('falha') || h.includes('descricao')) {
      colDescricao = i;
    } else if (h.includes('impacto')) {
      colImpacto = i;
    }
  }

  let startIndex = 0;
  if (colDescricao !== -1 && colImpacto !== -1) {
    startIndex = 1;
  } else {
    colDescricao = 0;
    colImpacto = 1;
    if (header[0]?.includes('falha') || header[1]?.includes('impacto')) {
      startIndex = 1;
    }
  }

  const falhas: { descricao: string; impacto: string }[] = [];
  const erros: string[] = [];

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    const linhaNum = i + 1;
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

    const desc = (row[colDescricao] ?? '').replace(/\s+/g, ' ').trim();
    const imp = (row[colImpacto] ?? '').replace(/\s+/g, ' ').trim();

    if (!desc && !imp) continue;

    if (!desc) {
      erros.push(`Linha ${linhaNum}: falha não informada.`);
      continue;
    }
    if (desc.length > 120) {
      erros.push(`Linha ${linhaNum}: a falha "${desc.slice(0, 30)}..." ultrapassa 120 caracteres (${desc.length}).`);
      continue;
    }
    if (!imp) {
      erros.push(`Linha ${linhaNum} ("${desc}"): impacto padrão não informado.`);
      continue;
    }
    if (imp.length > 500) {
      erros.push(`Linha ${linhaNum} ("${desc}"): o impacto ultrapassa 500 caracteres (${imp.length}).`);
      continue;
    }

    falhas.push({ descricao: desc, impacto: imp });
  }

  if (falhas.length === 0 && erros.length === 0) {
    erros.push('Nenhuma falha válida encontrada para importação no arquivo CSV.');
  }

  return { falhas, erros };
}

export default function AdminFalhas({
  falhas,
  onFalhasAtualizadas,
  onNotificarErro,
  onNotificarSucesso,
}: AdminFalhasProps) {
  const [autenticado, setAutenticado] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [senha, setSenha] = useState('');
  const [secaoAdmin, setSecaoAdmin] = useState<'falhas' | 'prompt' | 'templates' | 'whatsapp' | 'estacoes'>('falhas');
  const [modoCadastro, setModoCadastro] = useState<'individual' | 'csv'>('individual');
  const [novaFalha, setNovaFalha] = useState('');
  const [novoImpacto, setNovoImpacto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [edicoes, setEdicoes] = useState<Record<number, { descricao: string; impacto: string }>>({});
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  // Estados para importação por CSV
  const [csvArquivoNome, setCsvArquivoNome] = useState('');
  const [csvFalhasPrevia, setCsvFalhasPrevia] = useState<{ descricao: string; impacto: string }[]>([]);
  const [csvErros, setCsvErros] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const verificarSessao = async () => {
      try {
        const response = await fetch('/api/admin/session', { cache: 'no-store' });
        const data = (await response.json()) as { authenticated?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || 'Não foi possível verificar o acesso.');
        setAutenticado(data.authenticated === true);
      } catch (error: unknown) {
        setErro(error instanceof Error ? error.message : 'Não foi possível verificar o acesso.');
      } finally {
        setVerificandoSessao(false);
      }
    };

    void verificarSessao();
  }, []);

  const entrar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: senha }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
      setSenha('');
      setAutenticado(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível entrar.';
      setErro(msg);
      onNotificarErro?.(error, 'Login Administrativo');
    } finally {
      setSalvando(false);
    }
  };

  const sair = async () => {
    setErro('');
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
      setAutenticado(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.';
      setErro(msg);
      onNotificarErro?.(error, 'Encerramento de Sessão');
    }
  };

  const adicionarFalha = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/falhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: novaFalha, impacto: novoImpacto }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível adicionar a opção.');
      setNovaFalha('');
      setNovoImpacto('');
      setAviso('Opção adicionada com sucesso.');
      onNotificarSucesso?.('Falha Adicionada', 'A nova opção de falha foi cadastrada com sucesso no catálogo.');
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível adicionar a opção.';
      setErro(msg);
      onNotificarErro?.(error, 'Cadastro de Falha');
    } finally {
      setSalvando(false);
    }
  };

  const salvarFalha = async (falha: FalhaPredefinida) => {
    const edicao = edicoes[falha.id] ?? { descricao: falha.descricao, impacto: falha.impacto };
    setSalvandoId(falha.id);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/falhas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: falha.id, ...edicao }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a opção.');
      setEdicoes((anteriores) => {
        const proximas = { ...anteriores };
        delete proximas[falha.id];
        return proximas;
      });
      setAviso('Opção atualizada com sucesso.');
      onNotificarSucesso?.('Falha Atualizada', 'A opção predefinida de falha foi atualizada com sucesso.');
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível atualizar a opção.';
      setErro(msg);
      onNotificarErro?.(error, 'Atualização de Falha');
    } finally {
      setSalvandoId(null);
    }
  };

  const removerFalha = async (falha: FalhaPredefinida) => {
    if (!window.confirm(`Remover a opção "${falha.descricao}"?`)) return;
    setErro('');
    setAviso('');

    try {
      const response = await fetch(`/api/admin/falhas?id=${falha.id}`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível remover a opção.');
      setAviso('Opção removida.');
      onNotificarSucesso?.('Falha Removida', `A opção "${falha.descricao}" foi removida com sucesso.`);
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível remover a opção.';
      setErro(msg);
      onNotificarErro?.(error, 'Remoção de Falha');
    }
  };

  // Funções para Importação por CSV
  const handleSelecionarArquivoCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErro('');
    setAviso('');
    setCsvErros([]);
    setCsvFalhasPrevia([]);
    setCsvArquivoNome('');

    if (!file) return;

    setCsvArquivoNome(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setCsvErros(['Não foi possível ler o arquivo selecionado.']);
        return;
      }

      const { falhas: parsedFalhas, erros: parsedErros } = parseCSV(text);
      setCsvFalhasPrevia(parsedFalhas);
      setCsvErros(parsedErros);
    };

    reader.onerror = () => {
      setCsvErros(['Erro ao ler o arquivo CSV.']);
    };

    reader.readAsText(file);
  };

  const limparSelecaoCSV = () => {
    setCsvArquivoNome('');
    setCsvFalhasPrevia([]);
    setCsvErros([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const importarCSV = async () => {
    if (csvFalhasPrevia.length === 0) return;

    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const response = await fetch('/api/admin/falhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote: csvFalhasPrevia }),
      });
      const data = (await response.json()) as {
        sucesso?: boolean;
        inseridas?: number;
        ignoradas?: number;
        total?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao importar opções do arquivo CSV.');
      }

      const inseridas = data.inseridas ?? 0;
      const ignoradas = data.ignoradas ?? 0;
      const textoMsg = `${inseridas} ${inseridas === 1 ? 'falha adicionada' : 'falhas adicionadas'} com sucesso!${ignoradas > 0 ? ` (${ignoradas} já cadastrada${ignoradas > 1 ? 's' : ''} ignorada${ignoradas > 1 ? 's' : ''})` : ''}`;
      setAviso(textoMsg);
      onNotificarSucesso?.('Importação Concluída', textoMsg);
      limparSelecaoCSV();
      await onFalhasAtualizadas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Não foi possível importar as opções.';
      setErro(msg);
      onNotificarErro?.(error, 'Importação de CSV');
    } finally {
      setSalvando(false);
    }
  };

  const baixarModeloCSV = () => {
    const conteudo = 'Falha;Impacto padrão\n'
      + 'Falha de sinalização;Devido à falha de sinalização, os trens estão circulando com velocidade reduzida no trecho afetado.\n'
      + 'Alagamento na via;Devido ao alagamento na via, a circulação dos trens está temporariamente paralisada no trecho afetado.\n'
      + 'Objeto na via;Devido à presença de objeto na via, os trens circulam com restrição até a liberação pela equipe técnica.\n';

    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_falhas_impactos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (verificandoSessao) {
    return <p className="card p-4 text-sm text-slate-600">Verificando acesso administrativo...</p>;
  }

  return (
    <section className="card p-4 md:p-6" aria-label="Administração das opções de falha e prompt">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            {secaoAdmin === 'falhas' ? 'Opções predefinidas de falha' : 'Configuração do Prompt da IA'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {secaoAdmin === 'falhas'
              ? 'As opções cadastradas ficam disponíveis para todos os operadores no despacho.'
              : 'Personalize o comportamento, regras e estilo de resposta do Google Gemini.'}
          </p>
        </div>
        {autenticado && (
          <button type="button" onClick={() => void sair()} className="btn btn-secondary btn-sm">
            <LogOut className="h-4 w-4" />
            Sair da administração
          </button>
        )}
      </div>

      {erro && <p className="mb-4 text-sm text-rose-700" role="alert">{erro}</p>}
      {aviso && <p className="mb-4 text-sm text-emerald-700" role="status">{aviso}</p>}

      {!autenticado ? (
        <form onSubmit={entrar} className="max-w-md space-y-3">
          <div>
            <label htmlFor="senha-admin" className="form-label block">Senha de administrador</label>
            <input
              id="senha-admin"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full form-control"
            />
          </div>
          <button type="submit" disabled={salvando} className="btn btn-safira disabled:opacity-50">
            {salvando ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Menu de navegação entre as seções da administração */}
          <div className="flex border-b border-slate-200 gap-2">
            <button
              type="button"
              onClick={() => setSecaoAdmin('falhas')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                secaoAdmin === 'falhas'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Catálogo de Falhas ({falhas.length})
            </button>
            <button
              type="button"
              onClick={() => setSecaoAdmin('prompt')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                secaoAdmin === 'prompt'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Editar Prompt do Gemini (IA)
            </button>
            <button
              type="button"
              onClick={() => setSecaoAdmin('templates')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                secaoAdmin === 'templates'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="h-4 w-4 text-emerald-600" />
              Modelos de Mensagem (Templates)
            </button>
            <button
              type="button"
              onClick={() => setSecaoAdmin('whatsapp')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                secaoAdmin === 'whatsapp'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Send className="h-4 w-4 text-green-600" />
              Conexão WhatsApp & Grupos
            </button>
            <button
              type="button"
              onClick={() => setSecaoAdmin('estacoes')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                secaoAdmin === 'estacoes'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="h-4 w-4 text-sky-600" />
              Estações & Malha
            </button>
          </div>

          {secaoAdmin === 'prompt' ? (
            <AdminPrompt
              onNotificarErro={onNotificarErro}
              onNotificarSucesso={onNotificarSucesso}
            />
          ) : secaoAdmin === 'templates' ? (
            <AdminTemplates
              onNotificarErro={onNotificarErro}
              onNotificarSucesso={onNotificarSucesso}
            />
          ) : secaoAdmin === 'whatsapp' ? (
            <AdminWhatsApp
              onNotificarErro={onNotificarErro}
              onNotificarSucesso={onNotificarSucesso}
            />
          ) : secaoAdmin === 'estacoes' ? (
            <AdminEstacoes
              onNotificarErro={onNotificarErro}
              onNotificarSucesso={onNotificarSucesso}
            />
          ) : (
            <>
              {/* Seletor de modo de cadastro */}
          <div className="mb-4 flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setModoCadastro('individual')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                modoCadastro === 'individual'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Plus className="h-4 w-4" />
              Cadastro individual
            </button>
            <button
              type="button"
              onClick={() => setModoCadastro('csv')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                modoCadastro === 'csv'
                  ? 'border-safira text-safira'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar por CSV
            </button>
          </div>

          {modoCadastro === 'individual' ? (
            <form onSubmit={adicionarFalha} className="mb-6 space-y-3">
              <div>
                <label htmlFor="nova-falha" className="form-label block">Nova opção de falha</label>
                <input
                  id="nova-falha"
                  required
                  maxLength={120}
                  value={novaFalha}
                  onChange={(event) => setNovaFalha(event.target.value)}
                  placeholder="Ex.: Falha de sinalização"
                  className="w-full form-control"
                />
              </div>
              <div>
                <label htmlFor="novo-impacto" className="form-label block">Impacto inicial padrão</label>
                <textarea
                  id="novo-impacto"
                  required
                  maxLength={500}
                  rows={2}
                  value={novoImpacto}
                  onChange={(event) => setNovoImpacto(event.target.value)}
                  placeholder="Ex.: Devido ao alagamento, os trens estão circulando com velocidade reduzida."
                  className="w-full form-control"
                />
              </div>
              <button type="submit" disabled={salvando} className="btn btn-safira disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Adicionar falha e impacto
              </button>
            </form>
          ) : (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-safira" />
                    Upload de Falhas e Impactos via Planilha CSV
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    O arquivo deve conter as colunas: <span className="font-semibold text-slate-800">Falha</span> e <span className="font-semibold text-slate-800">Impacto padrão</span> (separador vírgula ou ponto e vírgula).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={baixarModeloCSV}
                  className="btn btn-secondary btn-sm text-xs inline-flex items-center gap-1.5"
                  title="Baixar planilha de exemplo pré-formatada"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar modelo CSV
                </button>
              </div>

              <div>
                <label htmlFor="input-csv-falhas" className="form-label block">
                  Selecione o arquivo CSV
                </label>
                <input
                  id="input-csv-falhas"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleSelecionarArquivoCSV}
                  className="w-full form-control text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-safira file:text-white hover:file:bg-safira/90 cursor-pointer"
                />
              </div>

              {csvErros.length > 0 && (
                <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 space-y-1" role="alert">
                  <p className="font-semibold">Problemas encontrados no arquivo:</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {csvErros.slice(0, 5).map((erroItem, idx) => (
                      <li key={idx}>{erroItem}</li>
                    ))}
                    {csvErros.length > 5 && (
                      <li className="font-medium">... e mais {csvErros.length - 5} erro(s).</li>
                    )}
                  </ul>
                </div>
              )}

              {csvFalhasPrevia.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-800">
                      ✓ {csvFalhasPrevia.length} {csvFalhasPrevia.length === 1 ? 'falha identificada' : 'falhas identificadas'} no arquivo <span className="font-mono text-slate-700">({csvArquivoNome})</span>:
                    </p>
                    <button
                      type="button"
                      onClick={limparSelecaoCSV}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Cancelar arquivo
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white">
                    <table className="table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="w-1/3">Falha</th>
                          <th>Impacto padrão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvFalhasPrevia.map((item, idx) => (
                          <tr key={idx}>
                            <td className="font-medium text-slate-800">{item.descricao}</td>
                            <td className="text-slate-600">{item.impacto}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void importarCSV()}
                    className="btn btn-safira inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {salvando ? 'Importando falhas...' : `Confirmar importação de ${csvFalhasPrevia.length} ${csvFalhasPrevia.length === 1 ? 'falha' : 'falhas'}`}
                  </button>
                </div>
              )}
            </div>
          )}

          <ul className="space-y-3">
            {falhas.map((falha) => (
              <li key={falha.id} className="rounded-md border border-slate-200 p-3">
                <div className="mb-3">
                  <label htmlFor={`falha-desc-${falha.id}`} className="form-label block">Falha</label>
                  <input
                    id={`falha-desc-${falha.id}`}
                    required
                    maxLength={120}
                    value={edicoes[falha.id]?.descricao ?? falha.descricao}
                    onChange={(event) => setEdicoes((anteriores) => ({
                      ...anteriores,
                      [falha.id]: {
                        descricao: event.target.value,
                        impacto: anteriores[falha.id]?.impacto ?? falha.impacto,
                      },
                    }))}
                    className="w-full form-control"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor={`falha-impacto-${falha.id}`} className="form-label block">Impacto inicial padrão</label>
                  <textarea
                    id={`falha-impacto-${falha.id}`}
                    required
                    maxLength={500}
                    rows={2}
                    value={edicoes[falha.id]?.impacto ?? falha.impacto}
                    onChange={(event) => setEdicoes((anteriores) => ({
                      ...anteriores,
                      [falha.id]: {
                        descricao: anteriores[falha.id]?.descricao ?? falha.descricao,
                        impacto: event.target.value,
                      },
                    }))}
                    className="w-full form-control"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={salvando || salvandoId !== null}
                    onClick={() => void salvarFalha(falha)}
                    className="btn btn-safira btn-sm disabled:opacity-50"
                  >
                    {salvandoId === falha.id ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  <button
                    type="button"
                    disabled={salvando || salvandoId !== null}
                    onClick={() => void removerFalha(falha)}
                    aria-label={`Remover ${falha.descricao}`}
                    className="btn btn-secondary btn-sm text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )}
</section>
  );
}
