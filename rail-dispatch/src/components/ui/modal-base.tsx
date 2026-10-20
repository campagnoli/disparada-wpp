'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

type LarguraModal = 'md' | 'lg' | 'xl' | '2xl';

const LARGURAS: Record<LarguraModal, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

interface ModalBaseProps {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  icone?: ReactNode;
  largura?: LarguraModal;
  onFechar: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Casca reutilizável dos modais do sistema.
 * Centraliza acessibilidade, fechamento por ESC/overlay e bloqueio de scroll.
 */
export default function ModalBase({
  aberto,
  titulo,
  subtitulo,
  icone,
  largura = 'lg',
  onFechar,
  children,
  footer,
}: ModalBaseProps) {
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    const aoPressionarTecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFechar();
    };

    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoPressionarTecla);

    return () => {
      document.body.style.overflow = overflowOriginal;
      document.removeEventListener('keydown', aoPressionarTecla);
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onFechar();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl ${LARGURAS[largura]}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icone && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                {icone}
              </span>
            )}
            <div className="min-w-0">
              <h3 id={tituloId} className="truncate text-base font-bold text-slate-900">
                {titulo}
              </h3>
              {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
