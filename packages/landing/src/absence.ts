/** Menos que isto fora da aba não conta como ausência. */
export const MIN_ABSENCE_MS = 10_000;

/** O tempo fora, do jeito que se fala: "40 s", "3 min", "2 h". Sempre arredondado para baixo. */
export function formatAbsence(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

/**
 * O recado da barra de status para quem trocou de aba e voltou; `null` se a saída foi curta
 * demais. O verbo no condicional é de propósito: a página não tem feudo nenhum para andar.
 */
export function absenceNote(ms: number): string | null {
  if (!(ms >= MIN_ABSENCE_MS)) return null;
  return `Você saiu por ${formatAbsence(ms)}. Pedra Alta teria seguido sem você.`;
}
