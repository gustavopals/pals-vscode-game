/** Um trecho da página que pertence a uma estação: onde começa e onde acaba, na vertical. */
export interface SeasonSpan {
  readonly season: string;
  readonly top: number;
  readonly bottom: number;
}

/**
 * A estação que está sob a linha de leitura (logo abaixo da faixa do alto); `null` fora das
 * quatro estações: na abertura, no modo de usar e no fecho, a faixa volta ao papel.
 */
export function seasonAt(spans: readonly SeasonSpan[], line: number): string | null {
  for (const span of spans) {
    if (span.top <= line && line < span.bottom) return span.season;
  }
  return null;
}
