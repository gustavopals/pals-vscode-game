/** Número com vírgula decimal e até duas casas, para os textos de explicação. */
export function decimal(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** "1 trabalhador", "4 trabalhadores". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
