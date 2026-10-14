export const modelosGemini = [
  { id: 'gemini-3.5-flash-lite', nome: 'Gemini 3.5 Flash Lite (Recomendado)', limiteDiario: 500 },
  { id: 'gemini-3.1-flash-lite', nome: 'Gemini 3.1 Flash Lite', limiteDiario: 500 },
  { id: 'gemini-3.8-flash', nome: 'Gemini 3.8 Flash', limiteDiario: 20 },
] as const;

export type ModeloGemini = (typeof modelosGemini)[number]['id'];

export function isModeloGemini(value: unknown): value is ModeloGemini {
  return modelosGemini.some((modelo) => modelo.id === value);
}
