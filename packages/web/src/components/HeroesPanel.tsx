import type { ViewState } from '@lotg/protocol';

import { allocateTo, LEAVING_HORIZON_SECONDS } from '../game/beforeLeaving';
import {
  arrearsDeadlines,
  arrearsSince,
  arrivalsCoverage,
  lingeringLine,
  wageRisk,
  arrivalLine,
  type ArrivingHero,
  GUILD_ICON,
  type Hero,
  HERO_ICON,
  heroCount,
  wageCoverage,
  wageOf,
  xpLine,
} from '../ui/guild';
import type { Actions } from './actions';
import { formatNumber } from './format';
import { Explained, Icon } from './shared';

/** Um id de elemento a partir do id do herói, para ligar o botão ao que o descreve. */
const elementId = (heroId: string, suffix: string) =>
  `hero-${heroId.replace(/[^A-Za-z0-9_-]/g, '-')}-${suffix}`;

/** Os traços, cada um com a frase do servidor ao alcance do mouse, do teclado e do leitor de tela. */
export function Traits(props: { traits: ReadonlyArray<{ label: string; text: string }> }) {
  return (
    <>
      {props.traits.map((trait) => (
        <span key={trait.label}>
          {' '}
          · <Explained why={trait.text}>{trait.label}</Explained>
        </span>
      ))}
    </>
  );
}

/**
 * A ficha de um herói (GDD §9.1): o nome, a classe, o nível e os traços em uma linha; embaixo, o
 * poder com a conta do servidor, a experiência, o soldo e onde ele está. O Descontente tem ícone
 * e palavra: nada é dito só pela cor. "Dispensar" passa por `lords.dismissHero`, que confirma.
 */
function HeroSheet(props: { hero: Hero; disabled: boolean; busy: boolean; actions: Actions }) {
  const { hero } = props;
  const about = elementId(hero.id, 'about');
  return (
    <li class="hero" aria-busy={props.busy}>
      <p class="hero-name">
        <Icon name={HERO_ICON} /> <strong>{hero.name}</strong> · {hero.classLabel} · Nv{hero.level}
        <Traits traits={hero.traits} />
      </p>
      <p id={about} class="hero-sheet muted">
        <Explained why={hero.powerBreakdown}>Poder {formatNumber(hero.power)}</Explained> ·{' '}
        {xpLine(hero)} · Soldo {wageOf(hero.wagePerHour)} · {hero.statusText}
        {hero.discontent ? (
          <span class="warning">
            {' '}
            · <Icon name="warning" /> Descontente
          </span>
        ) : null}
      </p>
      <div class="hero-actions">
        <button
          type="button"
          disabled={props.disabled || props.busy}
          aria-describedby={about}
          onClick={() => props.actions.run('lords.dismissHero', { heroId: hero.id })}
        >
          Dispensar<span class="sr-only"> {hero.name}</span>
        </button>
      </div>
    </li>
  );
}

/** Quem uma carta prometeu e ainda não chegou: a ficha, o prazo e, à porta, o que o impede. */
function Arriving(props: { arriving: ArrivingHero; elapsed: number }) {
  const { arriving } = props;
  return (
    <li class="hero hero-arriving">
      <p class="hero-name">
        <Icon name="watch" /> <strong>{arriving.name}</strong> · {arriving.classLabel}
        <Traits traits={arriving.traits} />
      </p>
      <p class="hero-sheet muted">
        A caminho: <span class="num">{arrivalLine(arriving, props.elapsed)}</span>.
      </p>
      {arriving.blockedReason === null ? null : (
        <p class="blocked">
          <Icon name="lock" /> {arriving.blockedReason}
        </p>
      )}
    </li>
  );
}

/**
 * O soldo (GDD §9.1 e §13.3; IDEIA-10): quanto a equipe custa por hora e por quanto tempo o ouro
 * ainda a paga. Com o atraso aberto, o aviso: a frase do servidor, os prazos das consequências
 * com os números da visão e o botão que leva à Mina.
 */
function Wage(props: { view: ViewState; elapsed: number; disabled: boolean; actions: Actions }) {
  const { view, elapsed } = props;
  const { guild } = view;
  const { arrears } = guild.wage;
  const coverage = wageCoverage(guild, elapsed);
  // Quem está a caminho também vai receber: o soldo e o prazo do ouro com eles, mesmo sem
  // ninguém no feudo hoje. E o atraso que fechou devendo uma partida diz quem parte.
  const ahead = arrivalsCoverage(guild, elapsed);
  const short = wageRisk(guild, LEAVING_HORIZON_SECONDS, elapsed)?.arrivals === true;
  const lingering = lingeringLine(guild, elapsed);
  if (guild.heroes.length === 0 && ahead === null && lingering === null) {
    return null;
  }
  const mine = allocateTo(view, 'gold');
  return (
    <>
      {guild.heroes.length === 0 ? null : (
        <p class="guild-wage">
          <Icon name="credit-card" /> Soldo da equipe:{' '}
          <strong class="num">{wageOf(guild.wage.perHour)}</strong> de ouro
          {coverage === null ? '.' : `. ${coverage}`}
        </p>
      )}
      {ahead === null ? null : short ? (
        <div class="banner banner-warning guild-arrears">
          <p>
            <span role="status">
              <Icon name="warning" /> {ahead}
            </span>
          </p>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.actions.run(mine.id, mine.arg)}
          >
            {mine.label}
          </button>
        </div>
      ) : (
        <p class="guild-wage muted">
          <Icon name="credit-card" /> {ahead}
        </p>
      )}
      {lingering === null ? null : (
        <div class="banner banner-warning guild-arrears">
          <p>
            <span role="status">
              <Icon name="warning" /> {lingering}
            </span>
          </p>
        </div>
      )}
      {arrears === null ? null : (
        <div class="banner banner-warning guild-arrears">
          <div>
            <p>
              <span role="status">
                <Icon name="warning" /> <strong>{arrearsSince(arrears, elapsed)}.</strong>
              </span>
            </p>
            {arrearsDeadlines(arrears, elapsed).length > 0 ? (
              <p class="guild-deadlines">{arrearsDeadlines(arrears, elapsed).join(' · ')}.</p>
            ) : null}
            <p class="muted">{arrears.text}</p>
          </div>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.actions.run(mine.id, mine.arg)}
          >
            {mine.label}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * O painel "Heróis" da aba Guilda (GDD §9.1 e §13.1): a frase do servidor sobre a equipe (como
 * o primeiro herói chega; ou que ainda não há para onde mandá-la), o soldo, a ficha de cada
 * herói e quem está a caminho. O app não escreve regra nem número: dispõe o que veio na visão.
 */
export function HeroesPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens da Guilda a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const { guild } = view;
  const empty = guild.heroes.length === 0 && guild.arriving.length === 0;
  return (
    <section aria-labelledby="heroes-title">
      {/* Sem herói o título é só "Heróis": quem conta a situação é a frase do servidor, abaixo. */}
      <h2 id="heroes-title">
        {guild.heroes.length === 0 ? 'Heróis' : `Heróis · ${heroCount(guild.heroes.length)}`}
      </h2>
      <p class={empty ? 'guild-empty' : 'muted hint'}>
        {empty ? <Icon name={GUILD_ICON} /> : null} {guild.text}
      </p>
      <Wage view={view} elapsed={elapsed} disabled={props.disabled} actions={props.actions} />
      {guild.heroes.length === 0 ? null : (
        <ul class="heroes" aria-label="A equipe">
          {guild.heroes.map((hero) => (
            <HeroSheet
              key={hero.id}
              hero={hero}
              disabled={props.disabled}
              busy={props.busy.has(`dismiss:${hero.id}`)}
              actions={props.actions}
            />
          ))}
        </ul>
      )}
      {guild.arriving.length === 0 ? null : (
        <ul class="heroes" aria-label="A caminho do feudo">
          {guild.arriving.map((arriving) => (
            <Arriving key={arriving.name} arriving={arriving} elapsed={elapsed} />
          ))}
        </ul>
      )}
    </section>
  );
}
