/**
 * Erro de domínio das ocorrências operacionais.
 * Mantido em arquivo próprio para que os módulos de serviço não dependam
 * uns dos outros apenas para compartilhar a classe de erro.
 */
export class OcorrenciasOperacionaisError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'OcorrenciasOperacionaisError';
    this.status = status;
  }
}
