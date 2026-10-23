import { balance, type InjurySeverityId } from '@lotg/content';

import type { BattleReport } from './battleReport';
import { emit } from './chronicle';
import { releaseEquipment, wearTeam } from './equipment';
import { dropCommander } from './formations';
import { grantXp } from './outcomes';
import type { GameEvent, GameState, Hero } from './types';

/**
 * O que uma batalha faz aos heróis que comandaram as alas (GDD §10.4 e §8.2; V4D-T3.2): consome
 * o relatório (`buildBattleReport`) e muda o estado em um instante da linha do tempo.
 *
 * Na ordem dos comandantes do relatório (a das alas), e em três passos:
 *
 * 1. **Quem caiu.** O ferido (`fate: 'wounded'`) fica com `Hero.injury`, com os prazos das
 *    expedições (`injuries.durationMs`): grave quando a ala dele perdeu ao menos
 *    `battle.commanderInjury.severeAtLoss` dos soldados com que começou, leve abaixo disso; quem
 *    já estava ferido fica com o prazo mais longo e a gravidade maior, e quem estava no feudo
 *    passa a `injured`. O morto (`fate: 'died'`, só em Rei de Ferro, decidido na resolução)
 *    deixa de servir ao feudo, sai das formações e devolve o que levava ao arsenal.
 * 2. **A experiência** do relatório (`xp`), a quem sobreviveu, com `heroLeveledUp` (`grantXp`).
 * 3. **O desgaste** do equipamento de quem sobreviveu: `equipment.wearPerBattle` pontos por item
 *    (`wearTeam`), com `itemWorn` para o que chega a zero.
 *
 * Nada aqui sorteia nem dá identificador. O herói que o estado já não tem (dispensado entre a
 * marcação e a batalha) é saltado. **Nenhuma incursão chama esta função ainda**: a batalha entra
 * na linha do tempo na Fase E (V4E-T2).
 */
export function applyBattleOutcome(
  draft: GameState,
  report: BattleReport,
  atMs: number,
  events: GameEvent[],
): void {
  const survivors: Array<{ hero: Hero; xp: number }> = [];
  for (const commander of report.commanders) {
    const hero = draft.guild.heroes.find((entry) => entry.id === commander.heroId);
    if (hero === undefined) {
      continue;
    }
    const data = { heroId: hero.id, battleId: report.id };
    if (commander.fate === 'died') {
      draft.guild.heroes = draft.guild.heroes.filter((entry) => entry.id !== hero.id);
      dropCommander(draft, hero.id);
      draft.stats.heroesDied = (draft.stats.heroesDied ?? 0) + 1;
      emit(events, draft, atMs, 'commanderDied', data, { heroi: hero.name });
      releaseEquipment(draft, hero, atMs, events);
      continue;
    }
    if (commander.fate === 'wounded') {
      const severity = commanderSeverity(report, commander.wing);
      wound(hero, severity, atMs);
      draft.stats.heroesInjured = (draft.stats.heroesInjured ?? 0) + 1;
      emit(events, draft, atMs, 'commanderInjured', { ...data, severity }, { heroi: hero.name });
    }
    survivors.push({ hero, xp: commander.xp });
  }
  for (const { hero, xp } of survivors) {
    grantXp(draft, [hero], xp, atMs, events);
  }
  wearTeam(
    draft,
    survivors.map(({ hero }) => hero),
    atMs,
    events,
    balance.equipment.wearPerBattle,
  );
}

/**
 * A gravidade do ferimento do comandante que caiu: grave quando a ala dele perdeu ao menos
 * `severeAtLoss` dos soldados do jogador com que começou (a "parte do dano" do §10.4), leve
 * abaixo disso, e leve na ala que começou sem soldados.
 */
export function commanderSeverity(
  report: BattleReport,
  wing: BattleReport['commanders'][number]['wing'],
): InjurySeverityId {
  const { severeAtLoss } = balance.battle.commanderInjury;
  const squads = report.casualties.filter(
    (entry) => entry.owner === 'player' && entry.wing === wing,
  );
  const start = squads.reduce((sum, entry) => sum + entry.start, 0);
  const lost = squads.reduce((sum, entry) => sum + entry.lost, 0);
  return start > 0 && lost * severeAtLoss.den >= start * severeAtLoss.num ? 'severe' : 'light';
}

const SEVERITY_ORDER: readonly InjurySeverityId[] = ['light', 'severe'];

function wound(hero: Hero, severity: InjurySeverityId, atMs: number): void {
  const before = hero.injury;
  hero.injury = {
    severity:
      before !== null && SEVERITY_ORDER.indexOf(before.severity) > SEVERITY_ORDER.indexOf(severity)
        ? before.severity
        : severity,
    untilMs: Math.max(atMs + balance.injuries.durationMs[severity], before?.untilMs ?? 0),
  };
  if (hero.status === 'idle') {
    hero.status = 'injured';
  }
}
