/**
 * Número com vírgula decimal e até duas casas, para os textos de explicação. `places` pede mais
 * casas onde duas esconderiam o número: a mestria, que anda de 0,003 em 0,003.
 */
export function decimal(value: number, places = 2): string {
  const scale = 10 ** places;
  return String(Math.round(value * scale) / scale).replace('.', ',');
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

/**
 * Duração em tempo real, por extenso, para as frases da visão: "40 s", "1 min 20 s", "40 min",
 * "1 h 08 min", "4 h". Abaixo de dez minutos os segundos aparecem; acima, arredonda para cima,
 * para um prazo nunca ser anunciado menor do que é. É o mesmo formato que a interface usa nos
 * prazos que ela mesma escreve.
 */
export function durationText(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  if (total < 60) {
    return `${total} s`;
  }
  if (total < 600 && total % 60 !== 0) {
    return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
  }
  const minutes = Math.ceil(total / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** Uma fração como parte de um todo, para as frases: 1/2 é "metade"; 3/4, "75%". */
export function shareText(ratio: { num: number; den: number }): string {
  return ratio.num * 2 === ratio.den ? 'metade' : `${decimal((ratio.num * 100) / ratio.den)}%`;
}
