import { seasonAt } from './season';

/**
 * O único script da página. A faixa do alto acompanha a leitura: veste a cor da estação que
 * está sob ela e marca o nome dessa estação no índice. Sem script a página é a mesma, com a
 * faixa sempre em papel.
 */
const root = document.documentElement;
const bar = document.querySelector<HTMLElement>('.topbar');
const sections = [...document.querySelectorAll<HTMLElement>('section[data-season]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-season-link]')];
let queued = false;

function update(): void {
  queued = false;
  const line = (bar?.getBoundingClientRect().bottom ?? 0) + 1;
  const season = seasonAt(
    sections.map((section) => {
      const box = section.getBoundingClientRect();
      return { season: section.dataset.season ?? '', top: box.top, bottom: box.bottom };
    }),
    line,
  );
  if (season === null) delete root.dataset.season;
  else root.dataset.season = season;
  for (const link of links) {
    if (link.dataset.seasonLink === season) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(update);
}

addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
update();
