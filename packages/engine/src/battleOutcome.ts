import {
  balance,
  battleFactorLabels,
  battleNoFactorText,
  battleOutcomeLabels,
  type InjurySeverityId,
} from '@lotg/content';

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
 * Primeiro a linha da batalha (`battleFought`, com os três fatores decisivos como dados e na
 * frase); depois, na ordem dos comandantes do relatório (a das alas), em três passos:
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
 * marcação e a batalha) é saltado. Desde a V4E-T2.3 quem a chama é a incursão (`raids.ts`, `fightRaid`): a batalha entra
 * na linha do tempo na Fase E (V4E-T2).
 */
export function applyBattleOutcome(
  draft: GameState,
  report: BattleReport,
  atMs: number,
  events: GameEvent[],
): void {
  emitBattleFought(draft, report, atMs, events);
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

/**
 * A linha da batalha na Crônica (GDD §10.7; V4D-T3.3): o desfecho e os fatores decisivos do
 * relatório, do maior ao menor, em `{fatores}` ("a muralha, que segurou o golpe, as torres e o
 * flanco que o inimigo achou"), e nos dados, `factor<n>`, `factor<n>Owner`, `factor<n>Amount` e
 * `factor<n>Wing` (vazio quando o fator pesou em mais de uma ala), de 1 a 3.
 */
export function emitBattleFought(
  draft: GameState,
  report: BattleReport,
  atMs: number,
  events: GameEvent[],
): void {
  const data: Record<string, string | number> = {
    battleId: report.id,
    playerLost: report.casualties
      .filter((entry) => entry.owner === 'player')
      .reduce((sum, entry) => sum + entry.lost, 0),
    hordeLost: report.casualties
      .filter((entry) => entry.owner === 'horde')
      .reduce((sum, entry) => sum + entry.lost, 0),
    mode: report.mode,
    outcome: report.outcome,
    ending: report.ending,
    rounds: report.rounds,
  };
  report.decisive.forEach((entry, index) => {
    const n = index + 1;
    data[`factor${n}`] = entry.factor;
    data[`factor${n}Owner`] = entry.owner;
    data[`factor${n}Amount`] = entry.amount;
    data[`factor${n}Wing`] = entry.wing ?? '';
  });
  const labels = report.decisive.map((entry) => battleFactorLabels[entry.factor][entry.owner]);
  emit(events, draft, atMs, 'battleFought', data, {
    desfecho: battleOutcomeLabels[report.outcome],
    fatores: listText(labels) ?? battleNoFactorText,
  });
}

/** "a, b e c"; `null` para a lista vazia. */
function listText(parts: readonly string[]): string | null {
  if (parts.length === 0) {
    return null;
  }
  return parts.length === 1
    ? parts[0]!
    : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]!}`;
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
