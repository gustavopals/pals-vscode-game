export type Block =
  | { kind: 'title' | 'heading' | 'paragraph' | 'note'; text: string }
  | { kind: 'list'; items: string[] };

/**
 * Lê o Markdown da Crônica (`GET /chronicle.md`) em blocos: título, anos, lista e parágrafos.
 * O resultado é só texto: quem desenha nunca interpreta HTML, então nada do que vier no
 * conteúdo vira marcação.
 */
export function parseChronicle(markdown: string): Block[] {
  const blocks: Block[] = [];
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
      if (last?.kind === 'list') {
        last.items.push(line.slice(2).trim());
      } else {
        blocks.push({ kind: 'list', items: [line.slice(2).trim()] });
      }
    } else if (/^\*[^*].*\*$/.test(line)) {
      blocks.push({ kind: 'note', text: line.slice(1, -1) });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}
