/**
 * A ligação entre uma linha do Markdown da Crônica e o relatório de uma expedição (revisão da
 * Fase D, A2). `GET /games/:id/chronicle.md?links=1` põe no fim de cada linha de expedição um
 * comentário de Markdown com o identificador dela (`expedition-<n>`), invisível para quem lê o
 * documento; o app o separa com `splitChronicleLink` e casa com `guild.reports[].expeditionId`.
 * Sem `links`, o documento sai limpo: é o que o jogador baixa.
 *
 * O identificador é o mesmo que os eventos já levam em `data.expeditionId` e a visão, em cada
 * expedição e em cada relatório: não diz a variante do grafo nem a chave de nó nenhum.
 */
const EXPEDITION_ID = /^expedition-[1-9][0-9]*$/;
const LINK = / <!-- (expedition-[1-9][0-9]*) -->$/;

/** `expedition-12`: o identificador de uma expedição, como o motor o dá. */
export function isExpeditionId(value: unknown): value is string {
  return typeof value === 'string' && EXPEDITION_ID.test(value);
}

/** O que entra no fim da linha: ` <!-- expedition-12 -->`. */
export function chronicleLinkSuffix(expeditionId: string): string {
  return ` <!-- ${expeditionId} -->`;
}

/** Separa a frase da marca: a linha sem ela e a expedição de que fala, ou `null` sem marca. */
export function splitChronicleLink(line: string): { text: string; expeditionId: string | null } {
  const match = LINK.exec(line);
  return match === null
    ? { text: line, expeditionId: null }
    : { text: line.slice(0, match.index), expeditionId: match[1] ?? null };
}
