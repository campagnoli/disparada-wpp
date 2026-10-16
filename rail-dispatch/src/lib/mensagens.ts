export function normalizarSCO(valor: unknown): string {
  if (typeof valor !== 'string') return '';

  return valor.trim().replace(/^#+\s*/, '').replace(/\s+/g, ' ');
}

export function incluirSCO(mensagem: string, sco: string): string {
  const linhas = mensagem.trim().split(/\r?\n/);
  const nome = sco.trim().toLocaleLowerCase('pt-BR');
  const assinaturaIndex = linhas.findIndex((linha) => {
    const normalizada = linha.trim()
      .replace(/^\*?#?SCO:\*?\s*/i, 'SCO: ')
      .toLocaleLowerCase('pt-BR');
    return normalizada === `sco: ${nome}`
      || normalizada === `responsável: ${nome}`
      || normalizada === `#${nome}`;
  });
  if (assinaturaIndex >= 0 && /^\*?#SCO:\*?/i.test(linhas[assinaturaIndex].trim())) {
    linhas[assinaturaIndex] = `*#SCO:* ${sco}`;
    return linhas.join('\n').trim();
  }
  const mensagemBase = (assinaturaIndex >= 0 ? linhas.slice(0, assinaturaIndex) : linhas)
    .join('\n')
    .trimEnd();
  return mensagemBase ? `${mensagemBase}\nSCO: ${sco}` : `SCO: ${sco}`;
}

export function finalizarMensagemComAssinaturaSCO(mensagem: string): string {
  const linhas = mensagem.trim().split(/\r?\n/);
  const assinaturaIndex = linhas.findIndex((linha, index) => {
    if (/^\s*(?:\*?#?SCO:\*?\s*.+|Responsável:\s*.+)\s*$/i.test(linha)) return true;
    return /^#\s*.+$/.test(linha.trim())
      && linhas.slice(index + 1).every((linhaSeguinte) => !linhaSeguinte.trim());
  });
  if (assinaturaIndex < 0) return mensagem.trim();

  const assinatura = linhas[assinaturaIndex].trim();
  const nome = assinatura
    .replace(/^\*?#?SCO:\*?\s*/i, '')
    .replace(/^Responsável:\s*/i, '')
    .replace(/^#\s*/, '')
    .trim();
  if (!nome) return linhas.slice(0, assinaturaIndex).join('\n').trimEnd();

  const linhaFinal = /^\*?#SCO:\*?/i.test(assinatura) ? `*#SCO:* ${nome}` : `SCO: ${nome}`;
  return [...linhas.slice(0, assinaturaIndex), linhaFinal].join('\n').trimEnd();
}
