/** O que o Markdown da Crônica precisa de uma linha de `game_events`. */
export type ChronicleRow = {
  kind: string;
  payload: { text: string; data: Record<string, string | number> };
};

/**
 * Como a nota de uma continuação chama a escolha que a trouxe: a resposta do jogador, ou a
 * opção que o conselho aplicou sozinho quando o prazo acabou. Um desfecho de outro tipo não
 * ganha nota.
 */
const ECHO_LABELS: Record<string, string> = {
  cardAnswered: 'Sua escolha voltou',
  cardExpired: 'A decisão do conselho voltou',
};

/**
 * A Crônica em Markdown: o título, um cabeçalho por ano de jogo (delimitado pelos eventos
 * `yearStarted` que o motor emitiu) e uma linha por evento, com a frase que veio nele.
 *
 * **"Sua escolha voltou"** (roadmap da v0.2, V2D-T4.3): a carta que é continuação de outra
 * (`cardDrawn` com `previousInstanceId`) leva, logo abaixo, um item recuado que cita a linha do
 * desfecho da carta anterior, palavra por palavra. A ligação fica em texto: vale para quem lê o
 * arquivo baixado, e é por essa citação que o app acha a linha e leva o leitor até ela. Nada
 * aqui é regra de jogo: só se juntam duas linhas que os eventos já ligavam pela ocorrência.
 */
export function chronicleMarkdown(settlementName: string, rows: readonly ChronicleRow[]): string {
  const lines = [`# Crônica de ${settlementName}`, '', '## Ano 1', ''];
  if (rows.length === 0) {
    lines.push('*Ainda não há nada a contar.*');
  }
  /** O desfecho de cada ocorrência de carta já contado: a resposta, ou a decisão do conselho. */
  const outcomes = new Map<string, ChronicleRow>();
  for (const row of rows) {
    const { text, data } = row.payload;
    if (row.kind === 'yearStarted') {
      lines.push('', `## Ano ${data.year}`, '');
    }
    lines.push(`- ${text}`);
    if (row.kind === 'cardDrawn' && typeof data.previousInstanceId === 'string') {
      const previous = outcomes.get(data.previousInstanceId);
      const label = previous === undefined ? undefined : ECHO_LABELS[previous.kind];
      if (previous !== undefined && label !== undefined) {
        lines.push(`  - ${label}: “${previous.payload.text}”`);
      }
    }
    if (row.kind in ECHO_LABELS && typeof data.instanceId === 'string') {
      outcomes.set(data.instanceId, row);
    }
  }
  return `${lines.join('\n')}\n`;
}
