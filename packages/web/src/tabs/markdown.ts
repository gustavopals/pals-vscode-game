/**
 * "Sua escolha voltou" (roadmap da v0.2, V2D-T4.3): a nota que o servidor põe debaixo da linha de
 * uma carta que é a continuação de outra, citando a linha da escolha que a trouxe. `target` é a
 * posição, no documento, da linha citada; `null` se ela não está no texto.
 */
export type Echo = { label: string; quote: string; target: number | null };

/** Uma linha da Crônica. `n` é a posição dela no documento, a partir de 1: serve de âncora. */
export type ChronicleLine = { n: number; text: string; echo?: Echo };

export type Block =
  | { kind: 'title' | 'heading' | 'paragraph' | 'note'; text: string }
  | { kind: 'list'; items: ChronicleLine[] };

/** `Sua escolha voltou: “No 3º dia da Primavera, o senhor…”`: o rótulo e a linha citada. */
const ECHO = /^(.+?): “(.*)”$/;

/**
 * Lê o Markdown da Crônica (`GET /chronicle.md`) em blocos: título, anos, lista e parágrafos.
 * O resultado é só texto: quem desenha nunca interpreta HTML, então nada do que vier no
 * conteúdo vira marcação.
 *
 * Um item recuado logo abaixo de outro é uma nota dele. A que tem a forma `rótulo: “citação”` é a
 * ligação de uma carta com a escolha que a trouxe: a citação é a linha da escolha, palavra por
 * palavra, e é por ela que a linha é achada, de baixo para cima (a mais recente antes desta). O
 * texto continua valendo para quem lê o arquivo baixado, sem o app.
 */
export function parseChronicle(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines: ChronicleLine[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'title', text: line.slice(2).trim() });
    } else if (line.startsWith('- ')) {
      const text = line.slice(2).trim();
      const parent = last?.kind === 'list' ? last.items[last.items.length - 1] : undefined;
      const echo = /^\s+- /.test(raw) && parent !== undefined ? ECHO.exec(text) : null;
      if (echo !== null && parent !== undefined && parent.echo === undefined) {
        const [, label = '', quote = ''] = echo;
        // A linha citada é a mais recente, antes desta, com a mesma frase.
        const cited = lines
          .slice(0, -1)
          .reverse()
          .find((entry) => entry.text === quote);
        parent.echo = { label, quote, target: cited?.n ?? null };
        continue;
      }
      const item: ChronicleLine = { n: lines.length + 1, text };
      lines.push(item);
      if (last?.kind === 'list') {
        last.items.push(item);
      } else {
        blocks.push({ kind: 'list', items: [item] });
      }
    } else if (/^\*[^*].*\*$/.test(line)) {
      blocks.push({ kind: 'note', text: line.slice(1, -1) });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}

/** O `id` da linha `n` na aba Crônica: é para onde "Sua escolha voltou" leva. */
export const chronicleAnchor = (n: number): string => `cronica-${n}`;
