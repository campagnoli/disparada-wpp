'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Send,
  RefreshCw,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  Radio,
  Zap,
} from 'lucide-react';
import { ConfiguracaoWhatsApp } from '@/lib/whatsapp-config';
import WhatsAppConnectionModal from '@/components/WhatsAppConnectionModal';

interface AdminWhatsAppProps {
  onNotificarErro?: (erro: unknown, contexto: string) => void;
  onNotificarSucesso?: (titulo: string, mensagem: string) => void;
}

interface DadosWhatsAppAPI {
  config: ConfiguracaoWhatsApp;
  isCustom: boolean;
  updatedAt: string | null;
  origem: 'supabase' | 'local' | 'padrao';
}

export default function AdminWhatsApp({ onNotificarErro, onNotificarSucesso }: AdminWhatsAppProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [testandoConexao, setTestandoConexao] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  const [mostrarApiKey, setMostrarApiKey] = useState(false);
  const [statusConexao, setStatusConexao] = useState<{
    verificado: boolean;
    ok: boolean;
    status: string;
    erro?: string;
  } | null>(null);

  const [canalTeste, setCanalTeste] = useState<'comunicacao' | 'operacao' | 'gerencia' | 'personalizado'>('operacao');
  const [jidPersonalizado, setJidPersonalizado] = useState('');
  const [textoTeste, setTextoTeste] = useState(
    '🧪 *Teste de Conexão CCO - SIDO*\nDisparo de teste operacional via Evolution API realizado com sucesso!'
  );
  const [resultadoTeste, setResultadoTeste] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  const [configOriginal, setConfigOriginal] = useState<ConfiguracaoWhatsApp | null>(null);
  const [config, setConfig] = useState<ConfiguracaoWhatsApp>({
    apiUrl: 'http://3.129.22.114:8080',
    apiKey: '',
    instanceName: 'cco_despacho',
    grupos: {
      comunicacao: '120363384961563518@g.us',
      operacao: '120363420044955952@g.us',
      gerencia: '120363305531028865@g.us',
    },
    antiBloqueio: {
      simularDigitacao: true,
      tempoDigitacaoMin: 2500,
      tempoDigitacaoMax: 4500,
      pausaEntreGruposMin: 3000,
      pausaEntreGruposMax: 6000,
    },
  });

  const [isCustom, setIsCustom] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'supabase' | 'local' | 'padrao'>('padrao');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  const carregarConfig = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/whatsapp', { cache: 'no-store' });
      const data = (await res.json()) as DadosWhatsAppAPI;
      if (!res.ok) throw new Error('Não foi possível carregar as configurações de WhatsApp.');

      setConfig(data.config);
      setConfigOriginal(data.config);
      setIsCustom(data.isCustom);
      setUpdatedAt(data.updatedAt);
      setOrigem(data.origem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar configurações.';
      setErro(msg);
      onNotificarErro?.(err, 'Carregamento de WhatsApp');
    } finally {
      setCarregando(false);
    }
  }, [onNotificarErro]);

  useEffect(() => {
    void carregarConfig();
  }, [carregarConfig]);

  const houveAlteracao = Boolean(
    configOriginal && JSON.stringify(config) !== JSON.stringify(configOriginal)
  );

  const handleSalvar = async () => {
    // Valida formato dos JIDs antes de salvar
    const jids = Object.values(config.grupos);
    const invalido = jids.some((jid) => jid && !jid.includes('@'));
    if (invalido) {
      setErro('Os IDs de grupo (JIDs) devem conter o caractere "@" (ex: 120363384961563518@g.us).');
      return;
    }

    setSalvando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
        config?: ConfiguracaoWhatsApp;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao salvar as configurações.');
      }

      if (data.config) {
        setConfig(data.config);
        setConfigOriginal(data.config);
      } else {
        setConfigOriginal({ ...config });
      }

      setIsCustom(true);
      setUpdatedAt(new Date().toISOString());
      const msgSucesso = data.mensagem || 'Configurações de WhatsApp salvas com sucesso!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('WhatsApp Configurado', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar.';
      setErro(msg);
      onNotificarErro?.(err, 'Salvar WhatsApp');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = async () => {
    if (
      !window.confirm(
        'Tem certeza de que deseja restaurar as configurações de WhatsApp para os valores padrão do arquivo .env.local?'
      )
    ) {
      return;
    }

    setRestaurando(true);
    setErro('');
    setAviso('');

    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurarPadrao: true }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
        config?: ConfiguracaoWhatsApp;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao restaurar configurações padrão.');
      }

      if (data.config) {
        setConfig(data.config);
        setConfigOriginal(data.config);
      }
      setIsCustom(false);
      setUpdatedAt(null);
      setOrigem('padrao');
      const msgSucesso = 'Configurações restauradas com sucesso para os valores de .env.local!';
      setAviso(msgSucesso);
      onNotificarSucesso?.('WhatsApp Restaurado', msgSucesso);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao restaurar configurações.';
      setErro(msg);
      onNotificarErro?.(err, 'Restauração de WhatsApp');
    } finally {
      setRestaurando(false);
    }
  };

  const handleTestarConexao = async () => {
    setTestandoConexao(true);
    setStatusConexao(null);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'testar_conexao',
          config,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        status?: string;
        erro?: string;
      } | null;

      const isConnected = data?.ok === true && (data.status === 'open' || data.status === 'connected');

      setStatusConexao({
        verificado: true,
        ok: Boolean(data?.ok),
        status: data?.status || (res.ok ? 'Desconhecido' : `Erro ${res.status}`),
        erro: data?.erro,
      });

      if (isConnected) {
        onNotificarSucesso?.('Conexão Evolution API', 'Instância conectada e pronta para disparar no WhatsApp!');
      } else {
        setErro(data?.erro || `Instância reportou status: ${data?.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao testar conexão.';
      setStatusConexao({
        verificado: true,
        ok: false,
        status: 'erro_rede',
        erro: msg,
      });
      setErro(msg);
    } finally {
      setTestandoConexao(false);
    }
  };

  const handleEnviarMensagemTeste = async () => {
    setEnviandoTeste(true);
    setResultadoTeste(null);
    try {
      const jidDestino = canalTeste === 'personalizado' ? jidPersonalizado.trim() : config.grupos[canalTeste];
      if (!jidDestino) {
        throw new Error('Informe o ID do grupo ou número para teste.');
      }

      const res = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar_teste',
          canal: canalTeste,
          jid: jidDestino,
          texto: textoTeste,
          config,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        sucesso?: boolean;
        mensagem?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.sucesso) {
        throw new Error(data?.error || 'Falha ao entregar mensagem de teste.');
      }

      setResultadoTeste({
        sucesso: true,
        mensagem: data.mensagem || `Mensagem entregue com sucesso para ${jidDestino}!`,
      });
      onNotificarSucesso?.('Disparo de Teste Concluído', `Mensagem enviada com sucesso para ${jidDestino}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar teste.';
      setResultadoTeste({
        sucesso: false,
        mensagem: msg,
      });
      onNotificarErro?.(err, 'Disparo de Teste');
    } finally {
      setEnviandoTeste(false);
    }
  };

  if (carregando) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-safira" />
        <p className="text-sm">Carregando configurações de WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" />
              Conexão WhatsApp & Grupos do CCO (Evolution API)
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCustom
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isCustom ? (
                origem === 'supabase' ? 'Sincronizado no banco de dados' : 'Customizado Localmente'
              ) : (
                'Padrão (.env.local)'
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie diretamente na interface web os identificadores de grupos (JIDs), credenciais da Evolution API e parâmetros de digitação anti-bloqueio.
          </p>
          {updatedAt && (
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Última modificação salva: {new Date(updatedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isCustom && (
            <button
              type="button"
              onClick={() => void handleRestaurarPadrao()}
              disabled={restaurando || salvando}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              title="Restaurar para as credenciais originais do arquivo .env.local"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${restaurando ? 'animate-spin' : ''}`} />
              Restaurar Padrão (.env)
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSalvar()}
            disabled={salvando || restaurando || !houveAlteracao}
            className={`btn btn-sm flex items-center gap-1.5 text-xs font-semibold ${
              houveAlteracao ? 'btn-safira animate-pulse' : 'btn-secondary opacity-60'
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${salvando ? 'animate-spin' : ''}`} />
            {salvando ? 'Salvando...' : houveAlteracao ? 'Salvar Alterações' : 'Salvo'}
          </button>
        </div>
      </div>

      {/* Avisos e Erros */}
      {aviso && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium" role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{aviso}</span>
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{erro}</span>
        </div>
      )}

      <WhatsAppConnectionModal />

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bloco 1: Identificadores dos Grupos do CCO */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Users className="w-4 h-4 text-safira" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Identificadores de Grupos do WhatsApp (JIDs)
            </h4>
          </div>

          <p className="text-[11.5px] text-slate-500">
            Informe o identificador real de cada canal do WhatsApp. Grupos utilizam o sufixo <code>@g.us</code>.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="jid-comunicacao" className="form-label text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Grupo Comunicação (Passageiros / Mídias)</span>
                <span className="badge badge-safira text-[10px]">Canal 1</span>
              </label>
              <input
                id="jid-comunicacao"
                type="text"
                value={config.grupos.comunicacao}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    grupos: { ...prev.grupos, comunicacao: e.target.value },
                  }))
                }
                placeholder="ex: 120363384961563518@g.us"
                className="w-full form-control font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="jid-operacao" className="form-label text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Grupo Operação (Supervisão / Tráfego CCO)</span>
                <span className="badge badge-coral text-[10px]">Canal 2</span>
              </label>
              <input
                id="jid-operacao"
                type="text"
                value={config.grupos.operacao}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    grupos: { ...prev.grupos, operacao: e.target.value },
                  }))
                }
                placeholder="ex: 120363420044955952@g.us"
                className="w-full form-control font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="jid-gerencia" className="form-label text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Grupo Gerência (Diretoria / Executivos)</span>
                <span className="badge badge-jade text-[10px]">Canal 3</span>
              </label>
              <input
                id="jid-gerencia"
                type="text"
                value={config.grupos.gerencia}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    grupos: { ...prev.grupos, gerencia: e.target.value },
                  }))
                }
                placeholder="ex: 120363305531028865@g.us"
                className="w-full form-control font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Servidor Evolution API v2 */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Servidor Evolution API v2
              </h4>
            </div>
            <button
              type="button"
              onClick={() => void handleTestarConexao()}
              disabled={testandoConexao}
              className="inline-flex items-center gap-1.5 text-xs text-safira hover:underline font-semibold"
            >
              <Radio className={`w-3.5 h-3.5 ${testandoConexao ? 'animate-pulse text-emerald-600' : ''}`} />
              {testandoConexao ? 'Testando Conexão...' : 'Testar Conexão'}
            </button>
          </div>

          {/* Badge do Status da Conexão */}
          {statusConexao && (
            <div
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                statusConexao.ok && (statusConexao.status === 'open' || statusConexao.status === 'connected')
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    statusConexao.ok && (statusConexao.status === 'open' || statusConexao.status === 'connected')
                      ? 'bg-emerald-500 animate-ping'
                      : 'bg-amber-500'
                  }`}
                />
                <span>Status da Instância: <strong>{statusConexao.status}</strong></span>
              </div>
              {statusConexao.erro && <span className="text-[11px] text-amber-800 truncate max-w-xs">{statusConexao.erro}</span>}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="api-url" className="form-label text-xs font-semibold text-slate-700">
                URL da Evolution API
              </label>
              <input
                id="api-url"
                type="text"
                value={config.apiUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apiUrl: e.target.value,
                  }))
                }
                placeholder="http://3.129.22.114:8080"
                className="w-full form-control font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="instance-name" className="form-label text-xs font-semibold text-slate-700">
                Nome da Instância
              </label>
              <input
                id="instance-name"
                type="text"
                value={config.instanceName}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    instanceName: e.target.value,
                  }))
                }
                placeholder="cco_despacho"
                className="w-full form-control font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="api-key" className="form-label text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Chave de API (ApiKey Global)</span>
                <button
                  type="button"
                  onClick={() => setMostrarApiKey(!mostrarApiKey)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  {mostrarApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {mostrarApiKey ? 'Ocultar' : 'Exibir chave'}
                </button>
              </label>
              <input
                id="api-key"
                type={mostrarApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
                placeholder="vR8qm2Zp7Lx5Nk4CCO2026"
                className="w-full form-control font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Proteção Anti-Bloqueio & Digitação Humana */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-safira" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Proteção Anti-Bloqueio & Simulação Humana
            </h4>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">
                Simular status &quot;Digitando...&quot; no WhatsApp
              </span>
              <span className="text-[11px] text-slate-500">
                Ativa a presença <code>composing</code> no grupo antes de despachar cada informe.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.antiBloqueio.simularDigitacao}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    antiBloqueio: {
                      ...prev.antiBloqueio,
                      simularDigitacao: e.target.checked,
                    },
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tempo-digitacao-min" className="form-label text-xs font-semibold text-slate-700">
                Digitação Mínima (ms)
              </label>
              <input
                id="tempo-digitacao-min"
                type="number"
                step="100"
                value={config.antiBloqueio.tempoDigitacaoMin}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    antiBloqueio: {
                      ...prev.antiBloqueio,
                      tempoDigitacaoMin: Number(e.target.value),
                    },
                  }))
                }
                className="w-full form-control font-mono text-xs"
              />
              <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                {(config.antiBloqueio.tempoDigitacaoMin / 1000).toFixed(1)} segundos
              </span>
            </div>

            <div>
              <label htmlFor="tempo-digitacao-max" className="form-label text-xs font-semibold text-slate-700">
                Digitação Máxima (ms)
              </label>
              <input
                id="tempo-digitacao-max"
                type="number"
                step="100"
                value={config.antiBloqueio.tempoDigitacaoMax}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    antiBloqueio: {
                      ...prev.antiBloqueio,
                      tempoDigitacaoMax: Number(e.target.value),
                    },
                  }))
                }
                className="w-full form-control font-mono text-xs"
              />
              <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                {(config.antiBloqueio.tempoDigitacaoMax / 1000).toFixed(1)} segundos
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pausa-grupos-min" className="form-label text-xs font-semibold text-slate-700">
                Pausa entre Grupos Mín (ms)
              </label>
              <input
                id="pausa-grupos-min"
                type="number"
                step="100"
                value={config.antiBloqueio.pausaEntreGruposMin}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    antiBloqueio: {
                      ...prev.antiBloqueio,
                      pausaEntreGruposMin: Number(e.target.value),
                    },
                  }))
                }
                className="w-full form-control font-mono text-xs"
              />
              <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                {(config.antiBloqueio.pausaEntreGruposMin / 1000).toFixed(1)} segundos
              </span>
            </div>

            <div>
              <label htmlFor="pausa-grupos-max" className="form-label text-xs font-semibold text-slate-700">
                Pausa entre Grupos Máx (ms)
              </label>
              <input
                id="pausa-grupos-max"
                type="number"
                step="100"
                value={config.antiBloqueio.pausaEntreGruposMax}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    antiBloqueio: {
                      ...prev.antiBloqueio,
                      pausaEntreGruposMax: Number(e.target.value),
                    },
                  }))
                }
                className="w-full form-control font-mono text-xs"
              />
              <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                {(config.antiBloqueio.pausaEntreGruposMax / 1000).toFixed(1)} segundos
              </span>
            </div>
          </div>
        </div>

        {/* Bloco 4: Disparo de Mensagem de Teste ao Vivo */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Disparo de Teste Rápido (Ping)
            </h4>
          </div>

          <p className="text-[11.5px] text-slate-500">
            Valide se a entrega de mensagens está funcionando e se o JID do canal foi configurado corretamente sem disparar uma ocorrência inteira.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="canal-teste" className="form-label text-xs font-semibold text-slate-700">
                Destino do Teste
              </label>
              <select
                id="canal-teste"
                value={canalTeste}
                onChange={(e) => setCanalTeste(e.target.value as typeof canalTeste)}
                className="w-full form-control text-xs"
              >
                <option value="operacao">Grupo Operação ({config.grupos.operacao || 'Não configurado'})</option>
                <option value="comunicacao">Grupo Comunicação ({config.grupos.comunicacao || 'Não configurado'})</option>
                <option value="gerencia">Grupo Gerência ({config.grupos.gerencia || 'Não configurado'})</option>
                <option value="personalizado">Número / JID Personalizado...</option>
              </select>
            </div>

            {canalTeste === 'personalizado' && (
              <div>
                <label htmlFor="jid-personalizado" className="form-label text-xs font-semibold text-slate-700">
                  JID ou Telefone com DDI+DDD
                </label>
                <input
                  id="jid-personalizado"
                  type="text"
                  value={jidPersonalizado}
                  onChange={(e) => setJidPersonalizado(e.target.value)}
                  placeholder="ex: 5511999999999 ou 120363...@g.us"
                  className="w-full form-control font-mono text-xs"
                />
              </div>
            )}

            <div>
              <label htmlFor="texto-teste" className="form-label text-xs font-semibold text-slate-700">
                Texto do Teste
              </label>
              <textarea
                id="texto-teste"
                rows={3}
                value={textoTeste}
                onChange={(e) => setTextoTeste(e.target.value)}
                className="w-full form-control font-mono text-xs leading-relaxed"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleEnviarMensagemTeste()}
              disabled={enviandoTeste}
              className="w-full btn btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              <Send className={`w-3.5 h-3.5 ${enviandoTeste ? 'animate-bounce text-emerald-600' : ''}`} />
              {enviandoTeste ? 'Despachando Teste...' : 'Enviar Mensagem de Teste'}
            </button>

            {resultadoTeste && (
              <div
                className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                  resultadoTeste.sucesso
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {resultadoTeste.sucesso ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resultadoTeste.mensagem}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
