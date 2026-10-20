import type { ReactNode } from 'react';

/**
 * Converte a formatação textual do WhatsApp em elementos React.
 * Suporta *negrito*, _itálico_ e ~tachado~.
 */
export function formatWhatsAppText(text: string): ReactNode[] {
  const pattern = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  const partes: ReactNode[] = [];
  let inicio = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > inicio) {
      partes.push(text.slice(inicio, match.index));
    }

    const conteudo = match[0].slice(1, -1);
    const chave = `formatado-${match.index}`;
    if (match[0].startsWith('*')) {
      partes.push(<strong key={chave} className="font-bold">{conteudo}</strong>);
    } else if (match[0].startsWith('_')) {
      partes.push(<em key={chave}>{conteudo}</em>);
    } else {
      partes.push(<del key={chave}>{conteudo}</del>);
    }
    inicio = match.index + match[0].length;
  }

  if (inicio < text.length) {
    partes.push(text.slice(inicio));
  }

  return partes;
}
