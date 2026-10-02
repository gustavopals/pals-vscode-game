/** Número com vírgula decimal e até duas casas, para os textos de explicação. */
export function decimal(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** Inteiro com ponto de milhar, para os textos: "1.500". */
export function thousands(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "1 trabalhador", "4 trabalhadores". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "A Serraria", "No Inverno": a primeira letra em maiúscula, para começar uma frase. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "madeira", "madeira e pedra", "comida, madeira e pedra". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
