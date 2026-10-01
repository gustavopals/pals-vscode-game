import { absenceNote } from './absence';

/**
 * O único script da página. Quem troca de aba e volta lê na barra de status quanto tempo passou
 * fora: é o jogo em uma frase (o mundo continua andando com a aba fechada). Sem script a página
 * é a mesma, só sem esse recado.
 */
const note = document.querySelector<HTMLElement>('[data-absence-note]');
let leftAt: number | null = null;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    leftAt = Date.now();
    return;
  }
  if (leftAt === null || !note) return;
  const text = absenceNote(Date.now() - leftAt);
  leftAt = null;
  if (text) note.textContent = text;
});
