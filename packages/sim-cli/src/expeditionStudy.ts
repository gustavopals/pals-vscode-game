import { balance, type DifficultyId, expeditionModels } from '@lotg/content';

import { botFor } from './bots';
import { preparedFor } from './bots/economico';
import { guildPolicies } from './bots/explorador';
import { enviarExpedicoes, escolherTodoCaminho } from './bots/policies';
import { type Bot, botOf } from './bots/types';
import { identityLine } from './identity';
import { gameYearsIn, MATRIX_SEEDS, shareText } from './matrix';
import { formatDecimal, summarize, type Summary } from './report';
import { type OutcomeCounts, simulate } from './simulate';

/**
 * O estudo das expedições (roadmap da v0.3, V3D-T5.3; revisão da Fase D, M-D2 e M-R2): as
 * perguntas que a matriz padrão não responde, porque o Explorador dela visita o feudo duas
 * vezes por dia, sempre com folga e sempre na Equilibrada.
 *
 * - **Quantas encruzilhadas o jogador chega a decidir**, com 1, 2, 4 e 6 visitas por dia em cada
 *   ritmo, e com 2 visitas mais a visita extra de quem atende o aviso. O bot é o explorador
 *   respondendo a **toda** encruzilhada que encontra: a parte que sobra para a Postura é a que
 *   venceu antes da visita seguinte.
 * - **O que acontece a quem arrisca**: o bot `ousado` nas mesmas cadências, com os desfechos por
 *   destino, as capturas, as mortes (em Rei de Ferro), os Resgates e as equipes perdidas, por
 *   partida e por ano de jogo.
 *
 * Roda a pedido (`pnpm -s sim -- --expeditions`), em uma dificuldade por vez, sobre 7 dias
 * reais. **Não tem faixa e não reprova nada**: é medição para `docs/balance-v0.3.md`. Como toda
 * partida do simulador, só o bot muda; as regras são as do jogo.
 */
export type StudyOptions = {
  /** Sementes da rodada; o padrão são as 10 primeiras da matriz. */
  seeds?: readonly string[];
  /** Dificuldade das partidas; o padrão é `lord`. */
  difficulty?: DifficultyId;
  /** Ritmos da rodada; o padrão são os que o conteúdo oferece. */
  timeScales?: readonly number[];
};

/** As cadências do estudo: as sessões por dia real e se o jogador atende o aviso da encruzilhada. */
export const STUDY_CADENCES: ReadonlyArray<{
  label: string;
  sessionsPerDay: number;
  crossroadsVisit: boolean;
}> = [
  { label: '1 visita por dia', sessionsPerDay: 1, crossroadsVisit: false },
  { label: '2 visitas por dia', sessionsPerDay: 2, crossroadsVisit: false },
  { label: '2 visitas e a do aviso', sessionsPerDay: 2, crossroadsVisit: true },
  { label: '4 visitas por dia', sessionsPerDay: 4, crossroadsVisit: false },
  { label: '6 visitas por dia', sessionsPerDay: 6, crossroadsVisit: false },
];

/** O explorador que responde a toda encruzilhada que encontra, para quem volta em `awayHours`. */
function attentiveExplorer(awayHours: number): Bot {
  return botOf(preparedFor(guildPolicies(escolherTodoCaminho, enviarExpedicoes), awayHours));
}

export const STUDY_BOTS: ReadonlyArray<{
  id: 'explorador' | 'ousado';
  label: string;
  botFor: (sessionsPerDay: number) => Bot;
}> = [
  {
    id: 'explorador',
    label: 'Explorador (responde a tudo)',
    botFor: (sessionsPerDay) => attentiveExplorer(24 / sessionsPerDay),
  },
  { id: 'ousado', label: 'Ousado', botFor: (sessionsPerDay) => botFor('ousado', sessionsPerDay) },
];

const STUDY_REAL_HOURS = 7 * 24;
const STUDY_SEEDS = 10;

export type StudyRow = {
  timeScale: number;
  paceLabel: string;
  bot: (typeof STUDY_BOTS)[number]['id'];
  botLabel: string;
  cadence: string;
  runs: number;
  gameYears: number;
  sent: number;
  crossroads: { player: number; posture: number };
  extraVisits: number;
  outcomes: OutcomeCounts;
  byModel: Record<string, { sent: number; outcomes: OutcomeCounts }>;
  fates: Summary['expeditions']['fates'];
  heroIdleHours: number;
  /** O ouro no cofre no fim, na partida que menos e na que mais juntou. */
  gold: { min: number; max: number };
  heroes: { min: number; max: number };
};

export type StudyResult = {
  difficulty: DifficultyId;
  difficultyLabel: string;
  seeds: readonly string[];
  rows: StudyRow[];
};

const noOutcomes = (): OutcomeCounts => ({ full: 0, success: 0, setback: 0, disaster: 0 });

export async function runExpeditionStudy(options: StudyOptions = {}): Promise<StudyResult> {
  const seeds = options.seeds ?? MATRIX_SEEDS.slice(0, STUDY_SEEDS);
  const difficulty = options.difficulty ?? 'lord';
  const timeScales = options.timeScales ?? balance.paces.map((pace) => pace.timeScale);
  const rows: StudyRow[] = [];
  for (const timeScale of timeScales) {
    const pace = balance.paces.find((entry) => entry.timeScale === timeScale);
    for (const bot of STUDY_BOTS) {
      for (const cadence of STUDY_CADENCES) {
        const row: StudyRow = {
          timeScale,
          paceLabel: `${pace?.label ?? 'Ritmo'} ${formatDecimal(timeScale)}×`,
          bot: bot.id,
          botLabel: bot.label,
          cadence: cadence.label,
          runs: seeds.length,
          gameYears: gameYearsIn(STUDY_REAL_HOURS, timeScale),
          sent: 0,
          crossroads: { player: 0, posture: 0 },
          extraVisits: 0,
          outcomes: noOutcomes(),
          byModel: {},
          fates: {
            injured: 0,
            captured: 0,
            died: 0,
            rescued: 0,
            levelUps: 0,
            itemsFound: 0,
            tilesCleared: 0,
            lost: 0,
          },
          heroIdleHours: 0,
          gold: { min: Infinity, max: -Infinity },
          heroes: { min: Infinity, max: -Infinity },
        };
        for (const seed of seeds) {
          const summary = summarize(
            await simulate({
              seed,
              days: STUDY_REAL_HOURS / 24,
              hours: STUDY_REAL_HOURS,
              strategy: bot.id,
              bot: bot.botFor(cadence.sessionsPerDay),
              sessionsPerDay: cadence.sessionsPerDay,
              timeScale,
              difficulty,
              crossroadsVisit: cadence.crossroadsVisit,
            }),
          );
          const { expeditions } = summary;
          row.sent += expeditions.sent;
          row.crossroads.player += expeditions.crossroadsByPlayer;
          row.crossroads.posture += expeditions.crossroadsByPosture;
          row.extraVisits += expeditions.extraVisits;
          row.heroIdleHours += expeditions.heroIdleHours;
          for (const key of Object.keys(row.outcomes) as Array<keyof OutcomeCounts>) {
            row.outcomes[key] += expeditions.outcomes[key];
          }
          for (const key of Object.keys(row.fates) as Array<keyof StudyRow['fates']>) {
            row.fates[key] += expeditions.fates[key];
          }
          for (const [id, counts] of Object.entries(expeditions.byModel)) {
            const model = (row.byModel[id] ??= { sent: 0, outcomes: noOutcomes() });
            model.sent += counts.sent;
            for (const key of Object.keys(model.outcomes) as Array<keyof OutcomeCounts>) {
              model.outcomes[key] += counts.outcomes[key];
            }
          }
          row.gold = {
            min: Math.min(row.gold.min, summary.stock.gold),
            max: Math.max(row.gold.max, summary.stock.gold),
          };
          row.heroes = {
            min: Math.min(row.heroes.min, summary.guild.heroes),
            max: Math.max(row.heroes.max, summary.guild.heroes),
          };
        }
        rows.push(row);
      }
    }
  }
  return {
    difficulty,
    difficultyLabel: balance.difficulties[difficulty].label,
    seeds,
    rows,
  };
}

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

const range = ({ min, max }: { min: number; max: number }): string =>
  min === max ? String(min) : `${min} a ${max}`;

/** Por partida e por ano de jogo, com uma casa: "0,4". */
function perYear(total: number, row: StudyRow): string {
  return formatDecimal(Math.round((total * 10) / (row.runs * row.gameYears)) / 10);
}

/** O estudo em Markdown, pronto para `docs/balance-v0.3.md`. */
export function formatExpeditionStudy(result: StudyResult): string {
  const who = (row: StudyRow) => [row.paceLabel, row.botLabel, row.cadence];
  const crossroads = table(
    [
      'Ritmo',
      'Bot',
      'Visitas',
      'Anos de jogo',
      'Expedições',
      'Encruzilhadas: jogador ÷ todas',
      'Visitas extras',
      'Herói ocioso (herói-h por partida)',
      'Heróis no fim',
      'Ouro no fim',
    ],
    result.rows.map((row) => [
      ...who(row),
      formatDecimal(row.gameYears),
      String(row.sent),
      shareText(row.crossroads.player, row.crossroads.player + row.crossroads.posture),
      String(row.extraVisits),
      String(Math.round(row.heroIdleHours / row.runs)),
      range(row.heroes),
      range(row.gold),
    ]),
  );
  const fates = table(
    [
      'Ritmo',
      'Bot',
      'Visitas',
      'Nós com prova: P/S/R/D',
      'Feridos',
      'Cativos',
      'Mortos',
      'Resgatados',
      'Equipes perdidas',
      'Covil limpo',
      'Capturas por ano',
      'Resgates por ano',
      'Mortes por ano',
    ],
    result.rows.map((row) => {
      const { full, success, setback, disaster } = row.outcomes;
      return [
        ...who(row),
        `${full}/${success}/${setback}/${disaster}`,
        String(row.fates.injured),
        String(row.fates.captured),
        String(row.fates.died),
        String(row.fates.rescued),
        String(row.fates.lost),
        String(row.fates.tilesCleared),
        perYear(row.fates.captured, row),
        perYear(row.fates.rescued, row),
        perYear(row.fates.died, row),
      ];
    }),
  );
  const models = expeditionModels.filter((model) =>
    result.rows.some((row) => row.byModel[model.id] !== undefined),
  );
  const byModel = table(
    ['Ritmo', 'Bot', 'Visitas', ...models.map((model) => `${model.label}: envios · P/S/R/D`)],
    result.rows.map((row) => [
      ...who(row),
      ...models.map((model) => {
        const counts = row.byModel[model.id];
        if (counts === undefined) {
          return '—';
        }
        const { full, success, setback, disaster } = counts.outcomes;
        return `${counts.sent} · ${full}/${success}/${setback}/${disaster}`;
      }),
    ]),
  );
  const [first] = result.seeds;
  const last = result.seeds[result.seeds.length - 1];
  return [
    '# Estudo das expedições',
    '',
    `${identityLine()} · dificuldade ${result.difficultyLabel} (${result.difficulty}) · ${result.seeds.length} sementes (${first} a ${last}) · 7 dias reais por partida`,
    '',
    `Somas das sementes de cada linha. O Explorador daqui responde a toda encruzilhada que encontra na visita: a parte que fica para a Postura é a que venceu (${balance.expeditions.crossroadsWaitRealMs / 3_600_000} h reais) antes de ele voltar. "A do aviso" é uma visita a mais, ao fim da hora em que uma equipe para em uma encruzilhada.`,
    '',
    '## Encruzilhadas por cadência de visitas',
    '',
    crossroads,
    '',
    '## O que aconteceu a quem partiu',
    '',
    'Por ano: por partida e por ano de jogo (7 dias reais são 3 anos no Rápido, 1 no Normal e meio no Tranquilo).',
    '',
    fates,
    '',
    '## Por destino',
    '',
    'Os envios e os desfechos dos nós com prova (Sucesso Pleno / Sucesso / Revés / Desastre).',
    '',
    byModel,
    '',
  ].join('\n');
}
