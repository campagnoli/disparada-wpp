import {
  CheckCheck,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  Smile,
  TrainFront,
} from 'lucide-react';
import { formatWhatsAppText } from '@/lib/whatsapp-format';

interface WhatsAppPreviewProps {
  titulo: string;
  subtitulo?: string;
  mensagem: string;
  hora: string;
  remetente?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Mockup de conversa do WhatsApp usado nas prévias de mensagens.
 * Mantém o mesmo visual e a mesma formatação em todas as telas.
 */
export default function WhatsAppPreview({
  titulo,
  subtitulo = 'Você, Supervisão CCO, Tráfego, Manutenção...',
  mensagem,
  hora,
  remetente,
  placeholder = 'A mensagem aparecerá aqui antes do disparo.',
  className = '',
}: WhatsAppPreviewProps) {
  const temMensagem = Boolean(mensagem.trim());

  return (
    <div className={`overflow-hidden rounded-xl border border-[#2a3942] bg-[#0b141a] shadow-lg ${className}`}>
      <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-emerald-50">
          <TrainFront className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-slate-100">{titulo}</h4>
          <p className="truncate text-xs text-slate-400">{subtitulo}</p>
        </div>
        <span className="rounded-full p-2 text-slate-400" aria-hidden="true">
          <Search className="h-4 w-4" />
        </span>
        <span className="rounded-full p-2 text-slate-400" aria-hidden="true">
          <MoreVertical className="h-4 w-4" />
        </span>
      </div>

      <div
        className="max-h-[68vh] min-h-[300px] space-y-4 overflow-y-auto px-3 py-5 sm:px-5"
        style={{
          backgroundColor: '#0b141a',
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(134, 150, 160, 0.045) 0 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, rgba(134, 150, 160, 0.04) 0 1px, transparent 1.5px)',
          backgroundSize: '24px 24px, 32px 32px',
        }}
      >
        <div className="mx-auto w-fit rounded-lg bg-[#182229]/95 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300 shadow-sm">
          Hoje
        </div>

        {temMensagem ? (
          <div className="flex justify-end">
            <div className="relative max-w-[95%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3.5 pb-2 pt-2.5 text-[12px] leading-relaxed text-[#e9edef] shadow-sm sm:max-w-[88%]">
              <span
                aria-hidden="true"
                className="absolute -right-1 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-[#005c4b] border-t-transparent"
              />
              {remetente?.trim() && (
                <p className="mb-1 text-[11px] font-semibold text-[#7dd3b0]">
                  {remetente.trim()}
                </p>
              )}
              <div className="whitespace-pre-wrap break-words">
                {formatWhatsAppText(mensagem)}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#b6c9c3]">
                <span>{hora}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="Lida" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center px-6 text-center text-xs text-slate-400">
            {placeholder}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 bg-[#202c33] px-3 py-2.5">
        <span className="rounded-full p-2 text-slate-400" aria-hidden="true">
          <Smile className="h-5 w-5" />
        </span>
        <div className="flex-1 rounded-lg bg-[#2a3942] px-3 py-2 text-xs text-slate-400">
          Digite uma mensagem
        </div>
        <span className="rounded-full p-2 text-slate-400" aria-hidden="true">
          <Paperclip className="h-5 w-5" />
        </span>
        <span className="rounded-full p-2 text-slate-400" aria-hidden="true">
          <Mic className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
