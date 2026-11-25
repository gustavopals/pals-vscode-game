import {
  type AccountConflictDetails,
  DisplayNameSchema,
  GameSeedSchema,
  type ViewState,
} from '@lotg/protocol';

import { awaitGithubAuthorization } from '../account/githubDevice';
import { type ConflictChoice, conflictOptions } from '../account/githubLink';
import { validateRecoveryCode } from '../account/recoveryCode';
import type { Controller } from '../app/controller';
import type { Dialogs, PickItem, Validation } from '../app/dialogs';
import type { Route } from '../app/router';
import {
  emergencySignature,
  emergencyTerms,
  planFormation,
  SIEGE_ANCHOR,
  SIEGE_SECTION,
  waveDeadline,
  waveDecision,
  type Wave,
} from '../ui/siege';
import {
  choiceSummary,
  difficultyLine,
  isScenarioLocked,
  type NewGameChoice,
  type NewGameOptions,
  paceLine,
  resolveChoice,
  scenarioLine,
  scenarioLockedText,
} from '../game/newGame';
import { nextTheme, THEME_LABELS } from '../theme/theme';
import type { ThemeId } from '../services/preferences';
import {
  cardDeadline,
  cardSecondsLeft,
  type CouncilCard,
  nextAudience,
  optionBlock,
} from '../ui/council';
import {
  busyQueues,
  capitalize,
  formatApprox,
  formatCost,
  formatDuration,
  formatNumber,
  formatRemaining,
  planWaiting,
  refundSentence,
  remainingNow,
  upgradeName,
} from '../ui/format';
import {
  armableHeroes,
  ARSENAL_ANCHOR,
  ARSENAL_SECTION,
  blockedReason,
  canSend,
  CROSSROADS_ICON,
  crossroadsDeadline,
  crossroadsSecondsLeft,
  defaultPosture,
  defaultTeam,
  type Destination,
  DESTINATION_NODE,
  destinationTerms,
  eligibleHeroes,
  type Expedition,
  EXPEDITION_NODE,
  EXPEDITIONS_ANCHOR,
  EXPEDITIONS_SECTION,
  heroFitPower,
  isPostureOption,
  type Item,
  ITEM_ICON,
  itemLine,
  type Posture,
  reportAnchor,
  REPORTS_ANCHOR,
  REPORTS_SECTION,
  sabotageStatus,
  sendable,
  slotLine,
  teamFit,
  teamLine,
  teamSize,
  waitingExpeditions,
  wornIn,
} from '../ui/expeditions';
import {
  festivalCost,
  type Hero,
  HERO_NODE,
  OFFER_NODE,
  offerTerms,
  rotationLine,
  sheetLine,
  TAVERN_ANCHOR,
  TAVERN_SECTION,
  type TavernOffer,
  traitLines,
  wageOf,
} from '../ui/guild';
import {
  blockedFor,
  MASTER_NODE,
  CARAVANS_ANCHOR,
  CARAVANS_SECTION,
  caravanGold,
  caravanResource,
  directionVerb,
  escortHeroes,
  escortLine,
  goldText,
  hasMarket,
  MARKET_ANCHOR,
  MARKET_SECTION,
  masterOptionLine,
  maxFor,
  parseAmount,
  priceOf,
  remainingLine,
  type TradeDirection,
  tradeLine,
  tradeTotal,
  TRENDS,
  stockLeftLine,
} from '../ui/market';
import {
  CONSTRUCTIONS_ANCHOR,
  CONSTRUCTIONS_SECTION,
  OBJECTIVES_ANCHOR,
  OBJECTIVES_SECTION,
} from '../ui/objectives';
import { stripChronicleLinks } from '../tabs/markdown';
import {
  batchOption,
  forgeEndsLine,
  forgeLine,
  repairFor,
  repairLine,
  SMITHY_ANCHOR,
  SMITHY_ICON,
  SMITHY_SECTION,
} from '../ui/smithy';
import {
  ARMY_ANCHOR,
  ARMY_ICON,
  ARMY_SECTION,
  BATTLE_REPORTS_ANCHOR,
  battleReportAnchor,
  batchAmount,
  disbandLine,
  offerOf,
  trainLine,
  trainingEndsLine,
  type UnitId,
  unitOf,
} from '../ui/army';
import {
  chapelMissingLine,
  placedRelicsCount,
  RELIC_NODE,
  relicEffectiveLine,
  RELICS_ANCHOR,
  RELICS_SECTION,
  relicsOf,
  relicStateBadge,
} from '../ui/relics';
import {
  claimableHexes,
  hexKey,
  OUTPOST_NODE,
  outpostsOf,
  repairableOutposts,
  TERRAIN_ICONS,
  type ExploredMapHex,
  type RepairableOutpost,
} from '../ui/hexmap';
import {
  isYearTurnVows,
  VOW_ICON,
  vowBonusText,
  type VowId,
  VOWS_ANCHOR,
  VOWS_SECTION,
  vowsConfirmationText,
  vowsDeadlineText,
  vowsOf,
  vowsReviewSignature,
  vowsWindowOpen,
} from '../ui/vows';
import { THREAT_ANCHOR, THREAT_SECTION, threatRowWork } from '../ui/threat';
import type { TreeNode } from '../ui/treeModel';
import { allocationMessage, injuredCount, nextWorkerGain, workersCount } from '../ui/workers';

type WorkerRow = ViewState['workers'][number];
type WorkersRules = ViewState['workersRules'];
type BuildingId = ViewState['constructions']['available'][number]['building'];
type PlannedRow = ViewState['constructions']['planned'][number];

/** Um comando do app. Os que têm `palette` aparecem na paleta, com o prefixo "Lords:". */
export type AppCommand = {
  id: string;
  /** Título sem o prefixo. */
  title: string;
  palette: boolean;
  /** O comando faz sentido agora (há conta, há feudo…). Sem isto, sempre. */
  when?: () => boolean;
  run: (arg?: unknown) => void | Promise<void>;
};

/** O que os comandos precisam do navegador. */
export type CommandEnv = {
  /** Salva um arquivo de texto pelo navegador. */
  download(filename: string, content: string): void;
  reload(): void;
  sleep(ms: number): Promise<void>;
  /** O tema em uso agora (a escolha ou o do sistema). */
  currentTheme(): ThemeId;
  openPalette(): void;
  /**
   * Leva a página e o foco ao elemento com este id, depois de a aba à vista ser desenhada: é
   * como "Ver a defesa" chega ao painel da Ameaça, que fica abaixo da dobra da aba Feudo, e como
   * o botão de um objetivo chega às construções ou à lista dos objetivos.
   */
  reveal(elementId: string): void;
};

/**
 * As seções a que `lords.openPanel` leva a página e o foco, além das abas: o argumento, a aba em
 * que a seção fica e a âncora dela.
 */
const SECTIONS: Record<string, { route: Route; anchor: string }> = {
  [SIEGE_SECTION]: { route: 'army', anchor: SIEGE_ANCHOR },
  [THREAT_SECTION]: { route: 'fief', anchor: THREAT_ANCHOR },
  [OBJECTIVES_SECTION]: { route: 'fief', anchor: OBJECTIVES_ANCHOR },
  [CONSTRUCTIONS_SECTION]: { route: 'fief', anchor: CONSTRUCTIONS_ANCHOR },
  [TAVERN_SECTION]: { route: 'guild', anchor: TAVERN_ANCHOR },
  [EXPEDITIONS_SECTION]: { route: 'guild', anchor: EXPEDITIONS_ANCHOR },
  [REPORTS_SECTION]: { route: 'guild', anchor: REPORTS_ANCHOR },
  [ARSENAL_SECTION]: { route: 'guild', anchor: ARSENAL_ANCHOR },
  [RELICS_SECTION]: { route: 'guild', anchor: RELICS_ANCHOR },
  [VOWS_SECTION]: { route: 'today', anchor: VOWS_ANCHOR },
  [SMITHY_SECTION]: { route: 'fief', anchor: SMITHY_ANCHOR },
  [ARMY_SECTION]: { route: 'army', anchor: ARMY_ANCHOR },
  [MARKET_SECTION]: { route: 'market', anchor: MARKET_ANCHOR },
  [CARAVANS_SECTION]: { route: 'market', anchor: CARAVANS_ANCHOR },
};

export const PALETTE_PREFIX = 'Lords: ';

/** A regra dos nomes (de quem governa e do feudo), como o servidor a aplica. */
export const NAME_RULE = 'De 2 a 24 caracteres.';

export const PRIVACY_PARAGRAPHS = [
  'O servidor guarda o nome de exibição que você escolheu, o identificador do GitHub (só se você vincular), o rótulo deste navegador, as datas de acesso e os hashes das credenciais. O progresso do feudo e as ordens dadas ficam vinculados à conta.',
  'O token do GitHub passa pelo servidor a caminho da validação e não é guardado.',
  'Neste navegador, as credenciais e o último estado do feudo (para o modo sem conexão) ficam no armazenamento local do site. Limpar os dados de navegação os apaga; sem GitHub nem Código do Reino, isso também apaga o acesso à conta.',
  'Excluir a conta bloqueia o acesso na hora. Os dados saem do servidor depois de sete dias; cópias de segurança podem guardá-los por até 14 dias depois de geradas.',
  'O app não carrega nada de terceiros: sem anúncios, sem rastreadores, sem scripts de outros sites.',
];

/** Texto da validação da alocação: o motivo do erro, ou `null` se o número serve. */
export function workersPreview(row: WorkerRow, free: number, input: string): string | null {
  const max = row.assigned + free;
  const count = Number(input);
  if (input.trim() === '' || !Number.isInteger(count) || count < 0) {
    return 'Digite um número inteiro de trabalhadores.';
  }
  if (count > max) {
    return `Só há ${max} disponíveis para ${row.label} (${row.assigned} já lá e ${free} livres).`;
  }
  return null;
}

/**
 * O que o edifício passaria a render com o número digitado, antes de confirmar: quem chega rende
 * menos enquanto se adapta, e a frase diz quanto, por quanto tempo e o que vem depois (GDD §5.4).
 */
export function workersValidation(
  row: WorkerRow,
  rules: WorkersRules,
  free: number,
  input: string,
): Validation {
  const problem = workersPreview(row, free, input);
  if (problem !== null) {
    return { message: problem, severity: 'error' };
  }
  return { message: allocationMessage(row, rules, Number(input)), severity: 'info' };
}

// A regra do nome é a do protocolo: o app não repete os limites.
const nameValidation = (value: string): Validation | null =>
  DisplayNameSchema.safeParse(value).success ? null : { message: NAME_RULE, severity: 'error' };

/** O prefixo do id da linha de uma carta na árvore (`ui/treeModel.ts`). */
const CARD_NODE = 'card:';
/** O id da linha "Ameaça" da árvore: o botão dela ordena a obra da Torre de Vigia ou a da Paliçada. */
const THREAT_NODE = 'threat';

/**
 * A carta e a opção que quem chamou `lords.answerCard` já escolheu: o painel manda as duas
 * (`{ instanceId, optionId }`); a árvore, a linha da carta (`card:<instanceId>`); a paleta, nada.
 */
export function cardRequest(arg: unknown): { instanceId?: string; optionId?: string } {
  if (typeof arg !== 'object' || arg === null) {
    return {};
  }
  const { id, instanceId, optionId } = arg as Record<string, unknown>;
  if (typeof instanceId === 'string') {
    return { instanceId, ...(typeof optionId === 'string' ? { optionId } : {}) };
  }
  return typeof id === 'string' && id.startsWith(CARD_NODE)
    ? { instanceId: id.slice(CARD_NODE.length) }
    : {};
}

/**
 * O herói ou o candidato que quem chamou o comando já escolheu: o painel manda o identificador
 * (`{ heroId }`, `{ offerId }`); a árvore, a linha (`hero:<id>`, `offer:<id>`); a paleta, nada.
 */
export function guildRequest(
  arg: unknown,
  field: 'heroId' | 'offerId',
  prefix: string,
): string | undefined {
  if (typeof arg !== 'object' || arg === null) {
    return undefined;
  }
  const record = arg as Record<string, unknown>;
  const direct = record[field];
  if (typeof direct === 'string') {
    return direct;
  }
  const { id } = record;
  return typeof id === 'string' && id.startsWith(prefix) ? id.slice(prefix.length) : undefined;
}

/**
 * A relíquia que quem chamou `lords.placeRelic` ou `lords.removeRelic` já escolheu: o painel manda
 * `{ relicId }`; a árvore, a linha (`relic:<id>`); a paleta, nada.
 */
export function relicRequest(arg: unknown): string | undefined {
  if (typeof arg === 'string') {
    return arg === '' ? undefined : arg;
  }
  if (typeof arg !== 'object' || arg === null) {
    return undefined;
  }
  const { id, relicId } = arg as Record<string, unknown>;
  if (typeof relicId === 'string') {
    return relicId === '' ? undefined : relicId;
  }
  return typeof id === 'string' && id.startsWith(RELIC_NODE)
    ? id.slice(RELIC_NODE.length)
    : undefined;
}

/**
 * O hexágono que quem chamou `lords.claimOutpost` já escolheu: a ficha manda `"q,r"` ou
 * `{ hex: "q,r" }`; a paleta, nada.
 */
export function claimOutpostRequest(arg: unknown): string | undefined {
  if (typeof arg === 'string') {
    return arg === '' ? undefined : arg;
  }
  if (typeof arg !== 'object' || arg === null) {
    return undefined;
  }
  const { hex } = arg as Record<string, unknown>;
  return typeof hex === 'string' && hex !== '' ? hex : undefined;
}

/**
 * O posto que quem chamou `lords.repairOutpost` já escolheu: a ficha e o Relatório de Retorno
 * mandam o `outpostId` (como texto ou `{ outpostId }`); a árvore, a linha (`outpost:<id>`); a
 * paleta, nada.
 */
export function repairOutpostRequest(arg: unknown): string | undefined {
  if (typeof arg === 'string') {
    if (arg === '') {
      return undefined;
    }
    return arg.startsWith(OUTPOST_NODE) ? arg.slice(OUTPOST_NODE.length) : arg;
  }
  if (typeof arg !== 'object' || arg === null) {
    return undefined;
  }
  const { id, outpostId } = arg as Record<string, unknown>;
  if (typeof outpostId === 'string') {
    return outpostId === '' ? undefined : outpostId;
  }
  return typeof id === 'string' && id.startsWith(OUTPOST_NODE)
    ? id.slice(OUTPOST_NODE.length)
    : undefined;
}

/**
 * A expedição e o caminho que quem chamou `lords.chooseExpeditionPath` já escolheu: o painel
 * manda os dois (`{ expeditionId, optionId }`); o aviso, a expedição; a árvore, a linha
 * (`expedition:<id>`); a aba Hoje, o identificador sozinho; a paleta, nada.
 */
export function expeditionRequest(arg: unknown): { expeditionId?: string; optionId?: string } {
  if (typeof arg === 'string') {
    return arg === '' ? {} : { expeditionId: arg };
  }
  if (typeof arg !== 'object' || arg === null) {
    return {};
  }
  const { id, expeditionId, optionId } = arg as Record<string, unknown>;
  if (typeof expeditionId === 'string') {
    return { expeditionId, ...(typeof optionId === 'string' ? { optionId } : {}) };
  }
  return typeof id === 'string' && id.startsWith(EXPEDITION_NODE)
    ? { expeditionId: id.slice(EXPEDITION_NODE.length) }
    : {};
}

/**
 * O que quem chamou `lords.sendExpedition` já escolheu: o painel manda o destino, a equipe e a
 * Postura; um botão "Enviar o Resgate", o destino sozinho (como texto ou em `{ modelId }`); a
 * árvore e a paleta, nada. `postures` são as Posturas que a visão oferece (`guild.postures`): só
 * uma delas segue, e o app não tem a lista escrita.
 */
export function sendRequest(
  arg: unknown,
  postures: ReadonlyArray<Pick<Posture, 'id'>>,
): {
  modelId?: string;
  heroIds?: string[];
  posture?: Posture['id'];
} {
  if (typeof arg === 'string') {
    return arg === '' ? {} : { modelId: arg };
  }
  if (typeof arg !== 'object' || arg === null) {
    return {};
  }
  const { id, modelId, heroIds, posture } = arg as Record<string, unknown>;
  if (typeof modelId !== 'string') {
    return typeof id === 'string' && id.startsWith(DESTINATION_NODE)
      ? { modelId: id.slice(DESTINATION_NODE.length) }
      : {};
  }
  const team =
    Array.isArray(heroIds) && heroIds.every((heroId) => typeof heroId === 'string')
      ? (heroIds as string[])
      : undefined;
  const known = postures.find((entry) => entry.id === posture)?.id;
  return {
    modelId,
    ...(team === undefined ? {} : { heroIds: team }),
    ...(known === undefined ? {} : { posture: known }),
  };
}

/**
 * O herói, o item e o espaço que quem chamou `lords.equipItem` ou `lords.unequipItem` já
 * escolheu: a ficha manda o herói e o espaço; o arsenal, o item; a paleta, nada. `slots` são os
 * espaços que a visão traz (`guild.equipmentSlots`): só um deles segue.
 */
export function equipRequest(
  arg: unknown,
  slots: ReadonlyArray<{ id: Item['slot'] }>,
): {
  heroId?: string;
  itemId?: string;
  slot?: Item['slot'];
} {
  if (typeof arg !== 'object' || arg === null) {
    return {};
  }
  const { heroId, itemId, slot } = arg as Record<string, unknown>;
  const known = slots.find((entry) => entry.id === slot)?.id;
  return {
    ...(typeof heroId === 'string' ? { heroId } : {}),
    ...(typeof itemId === 'string' ? { itemId } : {}),
    ...(known === undefined ? {} : { slot: known }),
  };
}

/**
 * Folga, em ms, para dizer que uma carta sumiu porque o prazo acabou: o relógio desta página
 * conta o prazo a partir de quando a visão chegou, e o servidor, de quando a montou.
 */
const EXPIRY_SLACK_MS = 10_000;

/** O id do edifício, vindo direto de um comando ou do item da árvore de uma ação inline. */
function buildingOf(arg: unknown, prefix: string): string | undefined {
  if (typeof arg === 'string') {
    return arg;
  }
  const id = (arg as TreeNode | undefined)?.id;
  return typeof id === 'string' && id.startsWith(prefix) ? id.slice(prefix.length) : undefined;
}

/**
 * Todos os comandos da v0.1 (GDD §13.6). A árvore, a barra de status, os avisos e a paleta
 * passam por aqui: é o único lugar que conversa com o jogador por diálogos.
 */
export function createCommands(
  controller: Controller,
  dialogs: Dialogs,
  env: CommandEnv,
): AppCommand[] {
  const signedIn = () => controller.account.state.kind !== 'signedOut';
  const signedOut = () => !signedIn();
  const hasGame = () => controller.hasGame;
  const elapsed = () => (controller.now() - controller.viewReceivedAt) / 1000;

  /** A visão atual, ou um aviso de que ainda não há feudo aberto. */
  const requireView = (): ViewState | null => {
    const view = controller.view;
    if (view === null) {
      controller.toast({
        kind: 'info',
        text: 'Ainda não há um feudo aberto neste navegador.',
        actions: [{ label: 'Jogar agora', run: () => controller.navigate('welcome') }],
      });
    }
    return view;
  };

  // A lista já mostra o custo da troca: a regra, na frase do servidor, e o que um trabalhador a
  // mais rende em cada edifício, agora e depois da adaptação. Os feridos de uma incursão não
  // estão livres para uma ordem: a lista diz quantos são e de que ofício saíram.
  const pickWorker = (view: ViewState) =>
    dialogs.pick<WorkerRow>({
      title: 'Alocar trabalhadores',
      placeholder:
        `${view.population.free} ${view.population.free === 1 ? 'aldeão livre' : 'aldeões livres'}` +
        `${view.population.injured > 0 ? ` · ${injuredCount(view.population.injured)}` : ''}. ` +
        view.workersRules.adaptationText,
      items: view.workers.map((row) => ({
        label: `${row.label} Nv${row.level}`,
        description: [
          `${workersCount(row.assigned)} · ${formatNumber(row.grossPerHour)}/h`,
          row.adapting > 0 ? `${row.adapting} em adaptação` : null,
          row.injured > 0 ? injuredCount(row.injured) : null,
        ]
          .filter((part) => part !== null)
          .join(' · '),
        detail: `+1: ${nextWorkerGain(row, view.workersRules)}. ${row.breakdown}`,
        value: row,
      })),
    });

  const allocate = async (arg?: unknown) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const requested = buildingOf(arg, 'worker:');
    const row =
      view.workers.find((entry) => entry.building === requested) ?? (await pickWorker(view));
    if (row === undefined) {
      return;
    }
    const { free } = view.population;
    const rules = view.workersRules;
    const answer = await dialogs.input({
      title: `${row.label} Nv${row.level}`,
      prompt: [
        `Quantos trabalhadores? Hoje são ${row.assigned}${row.adapting > 0 ? ` (${row.adapting} em adaptação)` : ''}; há ${free} livres.`,
        `Cada um rende ${formatNumber(row.perWorkerPerHour)}/h aqui; quem chega agora, ${formatNumber(row.perNewWorkerPerHour)}/h.`,
        rules.adaptationText,
      ].join(' '),
      value: String(row.assigned),
      confirmLabel: 'Alocar',
      // A cada tecla: o que o número digitado rende agora e depois da adaptação.
      validate: (value) => workersValidation(row, rules, free, value),
    });
    if (answer !== undefined && Number(answer) !== row.assigned) {
      await controller.order('setWorkers', { building: row.building, count: Number(answer) });
    }
  };

  const step = (delta: number) => async (arg?: unknown) => {
    const view = requireView();
    const requested = buildingOf(arg, 'worker:');
    const row = view?.workers.find((entry) => entry.building === requested);
    if (view === null) {
      return;
    }
    if (row === undefined) {
      await allocate();
      return;
    }
    const count = Math.max(0, row.assigned + delta);
    if (count === row.assigned) {
      // "−" em um edifício vazio: não há o que mudar, e uma ordem sem efeito não vai ao servidor.
      return;
    }
    await controller.order('setWorkers', { building: row.building, count });
  };

  const build = async (arg?: unknown) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const { available } = view.constructions;
    const busy = busyQueues(view.constructions);
    // Vindo da linha "Ameaça" da árvore, a obra é a que a linha oferece: sem a Torre de Vigia,
    // a Torre (é o que tira a névoa); com ela, a Paliçada.
    const requested =
      (arg as TreeNode | undefined)?.id === THREAT_NODE
        ? threatRowWork(view)?.building
        : buildingOf(arg, 'construction:');
    let building = available.find((upgrade) => upgrade.building === requested)?.building;
    if (building === undefined) {
      // Uma ou duas obras em curso (GDD §6.3): a lista diz quais são e quando terminam.
      const queue =
        busy.length === 0
          ? 'Os pedreiros estão livres'
          : `Em obras: ${busy
              .map(
                (active) =>
                  `${active.label} → Nv${active.targetLevel}, termina em ${formatRemaining(remainingNow(active.secondsRemaining, elapsed()))}`,
              )
              .join('; ')}`;
      // Por que os prazos da lista são esses nesta estação: vale para todas as obras, dito uma vez.
      const durationNotes = [
        ...new Set(available.flatMap((upgrade) => upgrade.durationNote ?? [])),
      ];
      building = await dialogs.pick({
        title: 'Construir ou melhorar',
        placeholder:
          durationNotes.length > 0
            ? `${queue}. ${durationNotes.join(' ')}`
            : busy.length === 0
              ? `${queue}.`
              : queue,
        items: available.map((upgrade) => ({
          // Cadeado: está bloqueada, e o detalhe diz por quê.
          icon: upgrade.blockedReason === null ? 'check' : 'lock',
          label: upgradeName(upgrade),
          description: `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`,
          // O que a obra muda fica ao lado do custo, antes do que a impede (ou de "pode começar").
          detail: [upgrade.effect, upgrade.blockedReason ?? 'Pode começar agora.']
            .filter((line) => line !== null)
            .join(' '),
          value: upgrade.building,
        })),
      });
    }
    if (building !== undefined) {
      // Mesmo bloqueada, a ordem segue: é o servidor que recusa, com o motivo atualizado.
      await controller.order('startConstruction', { building });
    }
  };

  const cancelConstruction = async (arg?: unknown) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const busy = busyQueues(view.constructions);
    if (busy.length === 0) {
      controller.toast({ kind: 'info', text: 'Não há obra em andamento.' });
      return;
    }
    // Vindo de uma linha da árvore, a obra é a da linha. Com duas em curso e sem linha, pergunta.
    const requested = buildingOf(arg, 'active:');
    const active =
      busy.find((queue) => queue.building === requested) ??
      (busy.length === 1
        ? busy[0]
        : await dialogs.pick({
            title: 'Cancelar qual obra?',
            placeholder: 'Há duas obras em andamento.',
            items: busy.map((queue) => ({
              icon: 'tools',
              label: `${queue.label} → Nv${queue.targetLevel}`,
              description: `termina em ${formatRemaining(remainingNow(queue.secondsRemaining, elapsed()))}`,
              detail: refundSentence(queue.refund, 'Cancelar devolve'),
              value: queue,
            })),
          }));
    if (active === undefined) {
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `Cancelar a obra de ${active.label}?`,
      // O que entra no estoque e, com o depósito perto do limite, o que se perderia.
      detail: [refundSentence(active.refund, 'Voltam')],
      confirmLabel: 'Cancelar a obra',
      cancelLabel: 'Manter a obra',
    });
    if (confirmed) {
      await controller.order('cancelConstruction', { building: active.building });
    }
  };

  /**
   * A obra planejada começa sozinha? Uma lista de duas opções; `undefined` é desistência. Para a
   * obra que ainda não pode começar, a automática já vem marcada: é para isso que se planeja, e
   * `Enter` basta. Se a obra já pode começar, marcar a automática é começá-la agora e gastar na
   * hora: a opção diz isso, e o que vem marcado é só deixar na lista. O padrão nunca gasta.
   */
  const askAutoStart = (upgrade: ViewState['constructions']['available'][number]) => {
    const startsNow = upgrade.blockedReason === null;
    return dialogs.pick<boolean>({
      title: `Planejar: ${upgradeName(upgrade)}`,
      placeholder: 'Planejar não gasta nada: a obra é paga quando começa.',
      items: [
        {
          icon: 'play-circle',
          label: 'Iniciar quando houver recursos',
          detail: startsNow
            ? 'Há recursos e pedreiros livres: a obra começa agora mesmo.'
            : 'Os pedreiros começam sozinhos assim que houver recursos e fila livre, mesmo com você longe.',
          value: true,
        },
        {
          icon: 'bookmark',
          label: 'Só deixar na lista',
          detail: 'A obra espera a sua ordem, com o custo à vista.',
          value: false,
        },
      ],
      selected: startsNow ? 1 : 0,
    });
  };

  const planConstruction = async () => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const planned = new Set(view.constructions.planned.map((plan) => plan.building));
    type Upgrade = ViewState['constructions']['available'][number];
    type Choice = { building: BuildingId; upgrade: Upgrade | null };
    const items: PickItem<Choice>[] = [
      ...view.constructions.planned.map((plan) => ({
        icon: 'close',
        label: `Tirar da lista: ${plan.label} → Nv${plan.targetLevel}`,
        description: formatCost(plan.cost),
        value: { building: plan.building, upgrade: null },
      })),
      ...view.constructions.available
        .filter((upgrade) => !planned.has(upgrade.building))
        .map((upgrade) => ({
          icon: 'add',
          label: `Planejar: ${upgrade.label} → Nv${upgrade.targetLevel}`,
          description: `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`,
          ...(upgrade.effect === null ? {} : { detail: upgrade.effect }),
          value: { building: upgrade.building, upgrade },
        })),
    ];
    const picked = await dialogs.pick({
      title: 'Obras planejadas',
      placeholder: 'Planejar não gasta nada: a obra fica na lista, com o custo à vista.',
      items,
    });
    if (picked === undefined) {
      return;
    }
    if (picked.upgrade === null) {
      await controller.order('unplanConstruction', { building: picked.building });
      return;
    }
    const autoStart = await askAutoStart(picked.upgrade);
    if (autoStart !== undefined) {
      // A ordem leva o nível que a lista mostrou: se outra aba passou na frente, o servidor
      // recusa em vez de planejar (e, na automática, pagar) o nível seguinte.
      await controller.order('planConstruction', {
        building: picked.building,
        autoStart,
        targetLevel: picked.upgrade.targetLevel,
      });
    }
  };

  /** O que a lista da marca diz de cada planejada: o que o clique faz e o que a obra espera. */
  const autoStartItem = (plan: PlannedRow): PickItem<PlannedRow> => ({
    icon: plan.autoStart ? 'bookmark' : 'play-circle',
    label: `${plan.autoStart ? 'Esperar a sua ordem' : 'Iniciar quando houver recursos'}: ${upgradeName(plan)}`,
    description: formatCost(plan.cost),
    detail: `${plan.autoStart ? 'Hoje começa sozinha.' : 'Hoje espera a sua ordem.'} ${capitalize(planWaiting(plan, elapsed()))}.`,
    value: plan,
  });

  /**
   * Liga ou desliga a marca "iniciar quando houver recursos" de uma planejada. Vindo de uma
   * linha da árvore, troca a marca daquela obra; pela paleta, pergunta de qual.
   */
  const toggleAutoStart = async (arg?: unknown) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const { planned } = view.constructions;
    if (planned.length === 0) {
      controller.toast({
        kind: 'info',
        text: 'Não há obras planejadas. Planeje uma obra para ela poder começar sozinha.',
        actions: [
          { label: 'Planejar obras', run: () => controller.runCommand('lords.planConstruction') },
        ],
      });
      return;
    }
    const requested = buildingOf(arg, 'planned:');
    const plan =
      planned.find((entry) => entry.building === requested) ??
      (await dialogs.pick({
        title: 'Início automático das planejadas',
        placeholder:
          'As marcadas começam sozinhas, na ordem da lista, quando houver recursos e fila livre.',
        items: planned.map(autoStartItem),
      }));
    if (plan !== undefined) {
      await controller.order('setAutoStart', {
        building: plan.building,
        autoStart: !plan.autoStart,
        targetLevel: plan.targetLevel,
      });
    }
  };

  const recruit = async () => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const { recruitment, population } = view;
    const max = recruitment.maxQuantity;
    const answer = await dialogs.input({
      title: 'Recrutar aldeões',
      prompt: [
        `Cada aldeão custa ${formatCost(recruitment.cost)} e leva ${formatDuration(recruitment.secondsPerVillager)}.`,
        recruitment.durationNote,
        `Vagas: ${population.vacancies} de ${population.capacity}.`,
        // O que chamar gente agora custa à moral, como o servidor disse.
        recruitment.moraleNote,
      ]
        .filter((line) => line !== null)
        .join(' '),
      placeholder: max > 0 ? `de 1 a ${max}` : 'sem vaga agora',
      value: max > 0 ? '1' : '',
      confirmLabel: 'Recrutar',
      validate: (value) => {
        const quantity = Number(value);
        if (value.trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
          return { message: 'Digite quantos aldeões recrutar.', severity: 'error' };
        }
        return quantity > max && max > 0
          ? { message: `Agora cabem no máximo ${max}.`, severity: 'error' }
          : null;
      },
    });
    if (answer !== undefined) {
      await controller.order('recruitVillagers', { quantity: Number(answer) });
    }
  };

  // --- Conselho ------------------------------------------------------------------

  /** A carta ainda espera resposta na visão de agora. */
  const stillPending = (card: CouncilCard) =>
    controller.view?.council.pending.some((entry) => entry.instanceId === card.instanceId) === true;

  /**
   * A carta saiu da mesa com a lista aberta, ou a sessão acabou: nada é enviado, e a tela diz
   * por quê. Cada caso tem a sua frase: o prazo que acabou (`expiresAt` é o instante, no relógio
   * desta página, em que o prazo dela vence), a resposta dada em outro lugar e a sessão encerrada.
   */
  const explainGone = (card: CouncilCard, expiresAt: number) => {
    if (controller.account.state.kind === 'signedOut' || controller.view === null) {
      controller.toast({
        kind: 'warning',
        text: `A sessão terminou com "${card.title}" aberta: nada foi enviado ao conselho. Entre de novo para decidir.`,
      });
      return;
    }
    const expired = controller.now() >= expiresAt - EXPIRY_SLACK_MS;
    controller.toast({
      kind: 'warning',
      text: expired
        ? `O prazo de "${card.title}" acabou antes da sua resposta, e o conselho decidiu sozinho. Nada foi enviado: a Crônica conta o que ele fez.`
        : `"${card.title}" saiu da mesa antes da sua resposta: foi respondida em outra aba ou em outro navegador. Nada foi enviado.`,
      actions: [{ label: 'Ver o Conselho', run: () => controller.navigate('council') }],
    });
  };

  /**
   * A lista das opções de uma carta, para quem decide pelo teclado: o texto da carta no alto, com
   * o prazo e o que o conselho faz sozinho, e cada opção com o custo e a consequência conhecida,
   * a pista e, se houver, o que a impede. O que já vem marcado é a opção que o conselho aplicaria
   * sem resposta, que nunca custa nada: `Enter` sem ler não gasta. A lista fecha sozinha, sem
   * enviar nada, se a carta sair da mesa com ela aberta. `null` é "nada a enviar".
   */
  const pickOption = async (card: CouncilCard): Promise<string | null> => {
    const expiresAt = controller.now() + cardSecondsLeft(card, elapsed()) * 1000;
    const gone = new AbortController();
    const stop = controller.onChange(() => {
      if (!stillPending(card)) {
        gone.abort();
      }
    });
    try {
      const optionId = await dialogs.pick<string>({
        title: `Carta do Conselho: ${card.title}`,
        placeholder: 'O que você decide?',
        detail: [
          ...(card.followsFrom === null ? [] : [card.followsFrom.text]),
          card.text,
          `${capitalize(cardDeadline(card, elapsed()))}. ${card.expiryNote}`,
        ],
        items: card.options.map((option) => {
          const block = optionBlock(option);
          return {
            // Cadeado ou alerta: a opção não pode ser escolhida agora, e o detalhe diz por quê.
            icon: block === null ? 'check' : block.kind === 'locked' ? 'lock' : 'warning',
            label: option.label,
            description: option.effectsText,
            detail: [
              block?.text,
              option.hint,
              option.id === card.defaultOptionId
                ? 'É o que o conselho faz sozinho, se o prazo acabar.'
                : null,
            ]
              .filter((line) => line !== null && line !== undefined)
              .join(' '),
            value: option.id,
          };
        }),
        selected: Math.max(
          0,
          card.options.findIndex((option) => option.id === card.defaultOptionId),
        ),
        signal: gone.signal,
      });
      if (gone.signal.aborted || (optionId !== undefined && !stillPending(card))) {
        explainGone(card, expiresAt);
        return null;
      }
      return optionId ?? null;
    } finally {
      stop();
    }
  };

  /**
   * "Decidir carta do Conselho": o único caminho da resposta (GDD §13.6). O painel já mostrou a
   * carta inteira e manda a carta e a opção do botão clicado; a árvore manda a carta da linha, e
   * a lista pergunta a opção; a paleta pergunta a carta (quando há mais de uma) e depois a opção.
   * Mesmo trancada ou sem recursos, a opção escolhida segue: quem recusa é o servidor, com o
   * motivo atualizado.
   */
  const answerCard = async (arg?: unknown) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const request = cardRequest(arg);
    if (request.instanceId !== undefined && request.optionId !== undefined) {
      await controller.answerCard(request.instanceId, request.optionId);
      return;
    }
    const { pending } = view.council;
    if (pending.length === 0) {
      controller.toast({
        kind: 'info',
        text: `O conselho não tem nada a tratar agora. ${nextAudience(view.council, elapsed())}`,
        actions: [{ label: 'Ver o Conselho', run: () => controller.navigate('council') }],
      });
      return;
    }
    let card = pending.find((entry) => entry.instanceId === request.instanceId);
    if (card === undefined && request.instanceId !== undefined) {
      // A linha da árvore era de uma carta que já saiu da mesa.
      controller.toast({
        kind: 'warning',
        text: 'Esta carta já não espera resposta: foi respondida, ou o prazo acabou.',
        actions: [{ label: 'Ver o Conselho', run: () => controller.navigate('council') }],
      });
      return;
    }
    if (card === undefined) {
      const opened = controller.now();
      const since = elapsed();
      card =
        pending.length === 1
          ? pending[0]
          : await dialogs.pick<CouncilCard>({
              title: 'Decidir carta do Conselho',
              placeholder: 'Qual carta?',
              items: pending.map((entry) => ({
                icon: 'law',
                label: entry.title,
                description: cardDeadline(entry, since),
                detail: entry.text,
                value: entry,
              })),
            });
      if (card !== undefined && !stillPending(card)) {
        explainGone(card, opened + cardSecondsLeft(card, since) * 1000);
        return;
      }
    }
    if (card === undefined) {
      return;
    }
    const optionId = await pickOption(card);
    if (optionId !== null) {
      await controller.answerCard(card.instanceId, optionId);
    }
  };

  // --- Guilda ------------------------------------------------------------------

  const seeTavern = {
    label: 'Ver a Taverna',
    run: () => controller.runCommand('lords.openPanel', TAVERN_SECTION),
  };
  const seeGuild = { label: 'Ver a Guilda', run: () => controller.navigate('guild') };

  /**
   * Um fluxo por vez (roadmap da v0.3, §11.1, lição 9): enquanto um diálogo espera, ou a ordem
   * está a caminho, um segundo acionamento do mesmo comando **para o mesmo alvo** (duplo clique,
   * `Enter` repetido na paleta) não abre outro fluxo. Sem a trava, dois fluxos se intercalariam na fila de diálogos
   * e a segunda resposta contrataria, ou dispensaria, outra vez.
   */
  const oneAtATime = (
    flow: (arg?: unknown) => Promise<void>,
    /**
     * O alvo que o acionamento já traz (o candidato ou o herói da linha clicada). A trava é por
     * alvo: com a ordem de um a caminho, o clique em outro não some em silêncio. Sem alvo (a
     * paleta, que pergunta), a trava é a do fluxo.
     */
    targetOf: (arg?: unknown) => string | undefined = () => undefined,
  ) => {
    const running = new Set<string>();
    return async (arg?: unknown) => {
      const key = targetOf(arg) ?? '';
      if (running.has(key)) {
        return;
      }
      running.add(key);
      try {
        await flow(arg);
      } finally {
        running.delete(key);
      }
    };
  };

  /**
   * A partida em que um fluxo começou. Depois de qualquer espera (um diálogo aberto), o fluxo lê
   * de novo a conta e a visão: se a sessão acabou ou o feudo é outro, nada é enviado.
   */
  const sameGame = (gameId: string | null) =>
    gameId !== null &&
    controller.account.state.kind !== 'signedOut' &&
    controller.session.gameId === gameId &&
    controller.view !== null;

  const sessionEnded = (what: string) =>
    controller.toast({
      kind: 'warning',
      text: `A sessão terminou, ou o feudo mudou, com ${what} em aberto: nada foi enviado.`,
    });

  /** O candidato ainda está à mesa na visão de agora. */
  const offerNow = (offerId: string) =>
    controller.view?.tavern.offers.find((entry) => entry.offerId === offerId);

  const offerGone = () =>
    controller.toast({
      kind: 'warning',
      text: 'Este candidato já não está à mesa da Taverna: foi contratado, ou a lista trocou. Nada foi enviado.',
      actions: [seeTavern],
    });

  /**
   * A lista dos candidatos, para quem contrata pela paleta: cada um com o preço de agora e o
   * soldo, os traços com a explicação e, se houver, o que impede a contratação. A lista fecha
   * sozinha, sem enviar nada, se os candidatos mudarem com ela aberta.
   */
  const pickOffer = async (view: ViewState): Promise<TavernOffer | undefined> => {
    const listed = view.tavern.offers.map((offer) => offer.offerId).join(',');
    const changed = new AbortController();
    const stop = controller.onChange(() => {
      const now = controller.view?.tavern.offers.map((offer) => offer.offerId).join(',');
      if (now !== listed) {
        changed.abort();
      }
    });
    try {
      const rotation = rotationLine(view.tavern, elapsed());
      const offer = await dialogs.pick<TavernOffer>({
        title: 'Contratar herói',
        placeholder: rotation === null ? 'Quem?' : `Quem? A lista ${rotation}.`,
        items: view.tavern.offers.map((entry) => ({
          // Cadeado: a contratação está bloqueada, e o detalhe diz por quê.
          icon: entry.blockedReason === null ? 'check' : 'lock',
          label: `${entry.name} · ${sheetLine(entry)}`,
          description: offerTerms(entry),
          detail: [
            ...traitLines(entry.traits),
            ...(entry.blockedReason === null ? [] : [entry.blockedReason]),
          ].join(' '),
          value: entry,
        })),
        signal: changed.signal,
      });
      if (changed.signal.aborted) {
        controller.toast({
          kind: 'warning',
          text: 'A lista de candidatos da Taverna mudou com a escolha aberta: nada foi enviado.',
          actions: [seeTavern],
        });
        return undefined;
      }
      return offer;
    } finally {
      stop();
    }
  };

  /**
   * "Contratar herói": o único caminho da contratação. O painel e a árvore já mostraram o preço
   * e mandam o candidato; a paleta pergunta qual. Mesmo bloqueada, a ordem segue: quem recusa é
   * o servidor, com o motivo atualizado.
   */
  const hireHero = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const requested = guildRequest(arg, 'offerId', OFFER_NODE);
      if (requested !== undefined) {
        if (offerNow(requested) === undefined) {
          offerGone();
          return;
        }
        await controller.hireHero(requested);
        return;
      }
      if (view.tavern.offers.length === 0) {
        const rotation = rotationLine(view.tavern, elapsed());
        controller.toast({
          kind: 'info',
          // Sem Taverna, a frase do servidor diz como erguê-la.
          text:
            view.tavern.level === 0
              ? view.tavern.text
              : `Nenhum candidato à mesa da Taverna agora${rotation === null ? '' : `: a lista ${rotation}`}.`,
          actions: [seeTavern],
        });
        return;
      }
      const gameId = controller.session.gameId;
      const offer = await pickOffer(view);
      if (offer === undefined) {
        return;
      }
      // Depois da espera: a conta e a visão de agora.
      if (!sameGame(gameId)) {
        sessionEnded('a contratação');
        return;
      }
      if (offerNow(offer.offerId) === undefined) {
        offerGone();
        return;
      }
      await controller.hireHero(offer.offerId);
    },
    (arg) => guildRequest(arg, 'offerId', OFFER_NODE),
  );

  /** O herói ainda serve ao feudo na visão de agora. */
  const heroNow = (heroId: string) =>
    controller.view?.guild.heroes.find((entry) => entry.id === heroId);

  const heroGone = () =>
    controller.toast({
      kind: 'warning',
      text: 'Este herói já não serve ao feudo: partiu ou foi dispensado. Nada foi enviado.',
      actions: [seeGuild],
    });

  /** A visão diz que este herói não pode ser dispensado agora: o motivo é a frase dela. */
  const cannotDismiss = (hero: Hero) =>
    controller.toast({ kind: 'info', text: hero.dismissText, actions: [seeGuild] });

  /**
   * "Dispensar herói": sempre com confirmação, porque não há volta; a frase do que se perde é a
   * do servidor, a daquele herói (`hero.dismissText`: desistir de um cativo custa outra coisa).
   * O painel e a árvore mandam o herói; a paleta pergunta qual (com um só, é ele). Quem a visão
   * diz que não pode ser dispensado agora (`canDismiss`) só recebe o motivo, sem confirmação.
   */
  const dismissHero = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const { heroes } = view.guild;
      const requested = guildRequest(arg, 'heroId', HERO_NODE);
      if (requested !== undefined && heroNow(requested) === undefined) {
        heroGone();
        return;
      }
      if (heroes.length === 0) {
        controller.toast({ kind: 'info', text: view.guild.text, actions: [seeGuild] });
        return;
      }
      const gameId = controller.session.gameId;
      const hero =
        heroes.find((entry) => entry.id === requested) ??
        (heroes.length === 1
          ? heroes[0]
          : await dialogs.pick<Hero>({
              title: 'Dispensar herói',
              placeholder: 'Quem? A dispensa ainda pede confirmação.',
              items: heroes.map((entry) => ({
                // Cadeado: a visão diz que ele não pode ser dispensado agora, e o detalhe, por quê.
                icon: !entry.canDismiss ? 'lock' : entry.discontent ? 'warning' : 'person',
                label: `${entry.name} · ${sheetLine(entry)}`,
                description: `soldo de ${wageOf(entry.wagePerHour)}${entry.discontent ? ' · descontente' : ''}`,
                detail: [
                  ...(entry.canDismiss ? [] : [entry.dismissText]),
                  ...traitLines(entry.traits),
                ].join(' '),
                value: entry,
              })),
            }));
      if (hero === undefined) {
        return;
      }
      if (!hero.canDismiss) {
        cannotDismiss(hero);
        return;
      }
      const confirmed = await dialogs.confirm({
        title: `Dispensar ${hero.name}?`,
        detail: [
          `${hero.name} · ${sheetLine(hero)} · soldo de ${wageOf(hero.wagePerHour)}.`,
          // O que a dispensa custa a este herói, na frase do servidor: a de um cativo é outra.
          hero.dismissText,
        ],
        confirmLabel: `Dispensar ${hero.name}`,
        cancelLabel: `Manter ${hero.name}`,
      });
      if (!confirmed) {
        return;
      }
      // Depois da espera: a conta e a visão de agora.
      if (!sameGame(gameId)) {
        sessionEnded('a dispensa');
        return;
      }
      const now = heroNow(hero.id);
      if (now === undefined) {
        heroGone();
        return;
      }
      if (!now.canDismiss) {
        cannotDismiss(now);
        return;
      }
      await controller.dismissHero(hero.id);
    },
    (arg) => guildRequest(arg, 'heroId', HERO_NODE),
  );

  /**
   * "Dar um festival". O painel tem o custo e o efeito ao lado do botão e manda a ordem já
   * confirmada; pela paleta e pela árvore, a confirmação mostra os dois antes de gastar.
   */
  const holdFestival = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    if ((arg as { confirmed?: unknown } | undefined)?.confirmed === true) {
      await controller.holdFestival();
      return;
    }
    const blocked = (tavern: ViewState['tavern']) =>
      controller.toast({
        kind: 'info',
        text: tavern.festival.blockedReason ?? tavern.text,
        actions: [seeTavern],
      });
    if (!view.tavern.festival.available) {
      blocked(view.tavern);
      return;
    }
    const gameId = controller.session.gameId;
    const confirmed = await dialogs.confirm({
      title: 'Dar um festival na Taverna?',
      detail: [`Custa ${festivalCost(view.tavern)}.`, view.tavern.festival.effectText],
      confirmLabel: 'Dar o festival',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    // Depois da espera: a conta e a visão de agora.
    if (!sameGame(gameId)) {
      sessionEnded('o festival');
      return;
    }
    const now = controller.view?.tavern;
    if (now !== undefined && !now.festival.available) {
      blocked(now);
      return;
    }
    await controller.holdFestival();
  });

  // --- Ferreiro ---------------------------------------------------------------------

  const seeSmithy = {
    label: 'Ver o Ferreiro',
    run: () => controller.runCommand('lords.openPanel', SMITHY_SECTION),
  };

  /**
   * "Forjar armas": o painel já mostrou o custo e o prazo do lote e manda a ordem conferida
   * (`confirmed`); a árvore e a paleta perguntam o tamanho do lote e confirmam com o custo e o
   * prazo que a visão traz. **Depois de cada diálogo a visão é lida de novo**: o Ferreiro, a
   * forja livre e o estoque que paga o lote. O que mudou não vira ordem.
   */
  const forgeWeapons = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const record = typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};
    const asked = typeof record.amount === 'number' ? record.amount : undefined;
    if (record.confirmed === true && asked !== undefined) {
      await controller.forgeWeapons(asked);
      return;
    }
    const blocked = (smithy: ViewState['smithy']): boolean => {
      if (!smithy.built || smithy.forge !== null || smithy.offer.blockedReason !== null) {
        controller.toast({
          kind: 'info',
          text: !smithy.built
            ? smithy.text
            : smithy.forge !== null
              ? `Já há um lote na forja: ${forgeEndsLine(smithy.forge, 0)}. É um lote por vez.`
              : (smithy.offer.blockedReason ?? smithy.text),
          actions: [seeSmithy],
        });
        return true;
      }
      return false;
    };
    if (blocked(view.smithy)) {
      return;
    }
    const gameId = controller.session.gameId;
    const amount =
      asked ??
      (await dialogs.pick<number>({
        title: 'Forjar armas',
        placeholder: `Quantas armas? ${view.smithy.offer.costText}.`,
        items: view.smithy.offer.options.map((entry) => ({
          icon: entry.affordable ? SMITHY_ICON : 'lock',
          label: `${entry.amount}`,
          description: `${entry.costText} · ${formatDuration(entry.seconds)}`,
          detail: entry.affordable ? '' : 'O estoque não paga este lote.',
          value: entry.amount,
        })),
      }));
    if (amount === undefined) {
      return;
    }
    const option = batchOption(view.smithy, amount);
    if (option === undefined) {
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `${forgeLine(view.smithy, option)}?`,
      detail: ['O custo é cobrado agora; é um lote por vez.'],
      confirmLabel: 'Forjar',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('a forja');
      return;
    }
    const now = controller.view?.smithy;
    const nowOption = now === undefined ? undefined : batchOption(now, amount);
    if (now === undefined || blocked(now) || nowOption === undefined || !nowOption.affordable) {
      if (now !== undefined && nowOption !== undefined && !nowOption.affordable) {
        controller.toast({
          kind: 'warning',
          text: 'O estoque já não paga este lote. Nada foi enviado.',
          actions: [seeSmithy],
        });
      }
      return;
    }
    await controller.forgeWeapons(amount);
  });

  /**
   * "Cancelar a forja": o painel mostra o que o cancelamento devolve ao lado do botão e manda a
   * ordem já confirmada; a árvore e a paleta confirmam com a mesma frase.
   */
  const cancelForge = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    if ((arg as { confirmed?: unknown } | undefined)?.confirmed === true) {
      await controller.cancelForge();
      return;
    }
    const none = () =>
      controller.toast({
        kind: 'info',
        text: 'Não há lote na forja para cancelar.',
        actions: [seeSmithy],
      });
    const forge = view.smithy.forge;
    if (forge === null) {
      none();
      return;
    }
    if (!forge.cancelable) {
      // Um reparo não se cancela: a frase da visão diz por quê.
      controller.toast({ kind: 'info', text: forge.refundText, actions: [seeSmithy] });
      return;
    }
    const gameId = controller.session.gameId;
    const confirmed = await dialogs.confirm({
      title: `Cancelar o ${forge.label.charAt(0).toLowerCase()}${forge.label.slice(1)}?`,
      detail: [forge.refundText],
      confirmLabel: forge.cancelLabel,
      cancelLabel: 'Manter o lote',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('o cancelamento');
      return;
    }
    const now = controller.view?.smithy.forge;
    if (now == null) {
      none();
      return;
    }
    // A ordem não leva o lote: se ele terminou e outro entrou com a pergunta aberta, cancelar
    // agora seria cancelar o que o jogador não viu (revisão da Fase B da v0.4, achado 5).
    if (
      now.kind !== forge.kind ||
      now.label !== forge.label ||
      now.totalSeconds !== forge.totalSeconds
    ) {
      controller.toast({
        kind: 'info',
        text: 'O lote da forja mudou com a pergunta aberta: nada foi enviado. Confira de novo.',
        actions: [seeSmithy],
      });
      return;
    }
    await controller.cancelForge();
  });

  // --- Muralha ----------------------------------------------------------------------

  const seeWall = {
    label: 'Ver a muralha',
    run: () => controller.runCommand('lords.openPanel', THREAT_SECTION),
  };

  /**
   * "Reparar a muralha": o painel da Ameaça já mostrou o custo e o prazo e manda a ordem conferida
   * (`confirmed`); a árvore e a paleta confirmam com a frase da visão (`repairOffer.text`).
   * **Depois do diálogo a oferta é lida de novo**: se o custo ou o prazo mudaram, ou o reparo já
   * começou, nada é enviado.
   */
  const repairWall = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    if ((arg as { confirmed?: unknown } | undefined)?.confirmed === true) {
      await controller.repairWall();
      return;
    }
    const offer = view.threat.defense.wall.repairOffer;
    if (!offer.canRepair) {
      controller.toast({
        kind: 'info',
        text: offer.blockedText ?? offer.text,
        actions: [seeWall],
      });
      return;
    }
    const gameId = controller.session.gameId;
    const confirmed = await dialogs.confirm({
      title: 'Reparar a muralha?',
      detail: [offer.text],
      confirmLabel: 'Reparar a muralha',
      cancelLabel: 'Deixar como está',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('o reparo');
      return;
    }
    const now = controller.view?.threat.defense.wall.repairOffer;
    if (now === undefined || !now.canRepair) {
      controller.toast({
        kind: 'info',
        text: now?.blockedText ?? 'O reparo não pode mais começar: nada foi enviado.',
        actions: [seeWall],
      });
      return;
    }
    if (now.stone !== offer.stone || now.gold !== offer.gold || now.seconds !== offer.seconds) {
      controller.toast({
        kind: 'info',
        text: 'O custo do reparo mudou com a pergunta aberta: nada foi enviado. Confira de novo.',
        actions: [seeWall],
      });
      return;
    }
    await controller.repairWall();
  });

  // --- Cerco ------------------------------------------------------------------------

  const seeSiege = {
    label: 'Ver o Cerco',
    run: () => controller.runCommand('lords.openPanel', SIEGE_SECTION),
  };
  const changedSiege = () =>
    controller.toast({
      kind: 'warning',
      text: 'O Cerco mudou ou o prazo acabou: nada foi enviado. Confira a próxima onda.',
      actions: [seeSiege],
    });

  const setBattlePlan = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view?.siege === null || view === null) return;
      const gameId = controller.session.gameId;
      const year = view.siege.year;
      const record = (typeof arg === 'object' && arg !== null ? arg : {}) as {
        wave?: unknown;
        formationId?: unknown;
      };
      const wave =
        view.siege.waves.find((entry) => entry.number === record.wave)?.number ??
        (await dialogs.pick<Wave>({
          title: 'Plano de Batalha',
          placeholder: 'Escolha a onda',
          items: view.siege.waves.map((entry) => ({
            label: `${entry.number} · ${entry.title}`,
            value: entry.number,
          })),
        }));
      if (wave === undefined) return;
      if (!sameGame(gameId)) {
        sessionEnded('o Plano de Batalha');
        return;
      }
      const current = controller.view;
      if (
        current?.siege?.year !== year ||
        current.siege.current > 0 ||
        current.siege.result !== null ||
        remainingNow(current.siege.scheduledInSeconds, elapsed()) <= 0
      ) {
        changedSiege();
        return;
      }
      const previous = current.siege.plan[wave];
      const formationId =
        typeof record.formationId === 'string' || record.formationId === null
          ? record.formationId
          : await dialogs.pick<string | null>({
              title: `Plano · onda ${wave}`,
              placeholder: 'Escolha a formação',
              items: [
                { label: planFormation(current, null), value: null },
                ...current.army.formations.map((entry) => ({
                  label: entry.name,
                  detail: entry.shortfallText,
                  value: entry.id,
                })),
              ],
              selected: Math.max(
                0,
                [null, ...current.army.formations.map((entry) => entry.id)].indexOf(previous),
              ),
            });
      if (formationId === undefined) return;
      if (!sameGame(gameId)) {
        sessionEnded('o Plano de Batalha');
        return;
      }
      const now = controller.view;
      if (
        now?.siege?.year !== year ||
        now.siege.current > 0 ||
        now.siege.result !== null ||
        now.siege.plan[wave] !== previous ||
        remainingNow(now.siege.scheduledInSeconds, elapsed()) <= 0 ||
        (formationId !== null && !now.army.formations.some((entry) => entry.id === formationId))
      ) {
        changedSiege();
        return;
      }
      await controller.setBattlePlan(wave, formationId);
    },
    (arg) => String((arg as { wave?: unknown } | undefined)?.wave ?? 'pick'),
  );

  const swapWaveFormation = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) return;
    const decision = waveDecision(view);
    if (decision === undefined || remainingNow(decision.expiresInSeconds, elapsed()) <= 0) {
      changedSiege();
      return;
    }
    const gameId = controller.session.gameId;
    const record = (typeof arg === 'object' && arg !== null ? arg : {}) as {
      decisionId?: unknown;
      formationId?: unknown;
    };
    if (record.decisionId !== undefined && record.decisionId !== decision.id) {
      changedSiege();
      return;
    }
    const selection = JSON.stringify(decision.options);
    const gone = new AbortController();
    const stillOpen = () => {
      const now = controller.view === null ? undefined : waveDecision(controller.view);
      return (
        sameGame(gameId) &&
        now?.id === decision.id &&
        remainingNow(now.expiresInSeconds, elapsed()) > 0 &&
        JSON.stringify(now.options) === selection
      );
    };
    const stop = controller.onChange(() => {
      if (!stillOpen()) gone.abort();
    });
    try {
      const formationId =
        typeof record.formationId === 'string' || record.formationId === null
          ? record.formationId
          : await dialogs.pick<string | null>({
              title: `Trocar formação · onda ${decision.wave}`,
              placeholder: 'Escolha a formação',
              detail: [
                waveDeadline(decision, elapsed()),
                'Sem nova ordem, vale a formação marcada no Plano de Batalha.',
              ],
              items: decision.options.map((option) => ({
                label: option.label,
                value: option.formationId,
              })),
              selected: Math.max(
                0,
                decision.options.findIndex((option) => option.selected),
              ),
              signal: gone.signal,
            });
      if (!sameGame(gameId)) {
        if (gone.signal.aborted || formationId !== undefined) sessionEnded('a troca de formação');
        return;
      }
      if (gone.signal.aborted || !stillOpen()) {
        changedSiege();
        return;
      }
      if (formationId === undefined) return;
      if (!decision.options.some((option) => option.formationId === formationId)) {
        changedSiege();
        return;
      }
      await controller.swapWaveFormation(decision.wave, formationId);
    } finally {
      stop();
    }
  });

  const emergencyRepair = oneAtATime(async () => {
    const view = requireView();
    if (view === null) return;
    const decision = waveDecision(view);
    if (decision === undefined || remainingNow(decision.expiresInSeconds, elapsed()) <= 0) {
      changedSiege();
      return;
    }
    const offer = view.threat.defense.wall.repairOffer;
    if (!offer.canRepair) {
      controller.toast({
        kind: 'info',
        text: offer.blockedText ?? offer.text,
        actions: [seeSiege],
      });
      return;
    }
    const gameId = controller.session.gameId;
    const confirmed = await dialogs.confirm({
      title: 'Reparo de emergência?',
      detail: [emergencyTerms(offer), waveDeadline(decision, elapsed())],
      confirmLabel: 'Confirmar o reparo',
      cancelLabel: 'Manter a muralha',
    });
    if (!confirmed) return;
    if (!sameGame(gameId)) {
      sessionEnded('o reparo de emergência');
      return;
    }
    const now = controller.view;
    const next = now === null ? undefined : waveDecision(now);
    if (
      now === null ||
      next === undefined ||
      remainingNow(next.expiresInSeconds, elapsed()) <= 0 ||
      !now.threat.defense.wall.repairOffer.canRepair ||
      emergencySignature(next, now.threat.defense.wall.repairOffer) !==
        emergencySignature(decision, offer)
    ) {
      changedSiege();
      return;
    }
    await controller.emergencyRepair(decision.wave);
  });

  const callMilitia = oneAtATime(async () => {
    const view = requireView();
    const offer = view?.siege?.militiaOffer;
    if (offer === undefined) return;
    if (!offer.canCall || !offer.termsText || offer.targetId == null) {
      controller.toast({
        kind: 'info',
        text: offer.blockedReason ?? 'Atualize a oferta da milícia.',
        actions: [seeSiege],
      });
      return;
    }
    const gameId = controller.session.gameId;
    const valid = () => {
      const now = controller.view?.siege?.militiaOffer;
      return (
        sameGame(gameId) &&
        now?.canCall === true &&
        now.targetId === offer.targetId &&
        now.maxCount === offer.maxCount &&
        now.termsText === offer.termsText &&
        now.untilInSeconds !== null &&
        remainingNow(now.untilInSeconds, elapsed()) > 0
      );
    };
    const gone = new AbortController();
    const stop = controller.onChange(() => {
      if (!valid()) gone.abort();
    });
    try {
      const countText = await dialogs.input({
        title: 'Convocar milícia',
        prompt: `Quantos aldeões? Até ${formatNumber(offer.maxCount)} disponíveis. ${offer.termsText}`,
        value: String(offer.maxCount),
        confirmLabel: 'Conferir convocação',
        validate: (value) =>
          Number.isSafeInteger(Number(value)) &&
          Number(value) > 0 &&
          Number(value) <= offer.maxCount
            ? null
            : {
                message: `Informe uma quantidade inteira até ${formatNumber(offer.maxCount)}.`,
                severity: 'error',
              },
        signal: gone.signal,
      });
      if (!valid()) {
        changedSiege();
        return;
      }
      if (countText === undefined) return;
      const count = Number(countText);
      if (!Number.isSafeInteger(count) || count <= 0 || count > offer.maxCount) return;
      const confirmed = await dialogs.confirm({
        title: 'Conferir a milícia',
        detail: [
          `Convocar ${formatNumber(count)} ${count === 1 ? 'aldeão' : 'aldeões'}.`,
          offer.termsText,
        ],
        confirmLabel: 'Confirmar convocação',
        cancelLabel: 'Manter os aldeões no trabalho',
        signal: gone.signal,
      });
      if (!valid()) {
        changedSiege();
        return;
      }
      if (confirmed) await controller.callMilitia(count);
    } finally {
      stop();
    }
  });

  // --- Quartel ----------------------------------------------------------------------

  const seeArmy = {
    label: 'Ver o Exército',
    run: () => controller.runCommand('lords.openPanel', ARMY_SECTION),
  };

  /** A unidade e a quantidade que o painel manda já conferidas (`confirmed`). */
  const armyArg = (
    arg: unknown,
  ): { unit?: UnitId; amount?: number; lotKey?: string; confirmed: boolean } => {
    const record = typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};
    return {
      ...(typeof record.unit === 'string' ? { unit: record.unit as UnitId } : {}),
      ...(typeof record.amount === 'number' ? { amount: record.amount } : {}),
      ...(typeof record.lotKey === 'string' ? { lotKey: record.lotKey } : {}),
      confirmed: record.confirmed === true,
    };
  };

  /**
   * "Treinar soldados": o painel já mostrou o custo e o prazo e manda a ordem conferida
   * (`confirmed`); a árvore e a paleta perguntam a unidade e o lote e confirmam com a mesma
   * frase. **Depois de cada diálogo a visão é lida de novo**: o Quartel, o pátio livre e o que o
   * estoque paga. O que mudou não vira ordem.
   */
  const trainSoldiers = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked = armyArg(arg);
    if (asked.confirmed && asked.unit !== undefined && asked.amount !== undefined) {
      await controller.trainSoldiers(asked.unit, asked.amount);
      return;
    }
    const blocked = (army: ViewState['army']): boolean => {
      if (!army.built || army.training !== null) {
        controller.toast({
          kind: 'info',
          text:
            army.training !== null
              ? `Já há um lote no pátio: ${trainingEndsLine(army.training, 0)}. É um lote por vez.`
              : army.text,
          actions: [seeArmy],
        });
        return true;
      }
      return false;
    };
    if (blocked(view.army)) {
      return;
    }
    const gameId = controller.session.gameId;
    const unitId =
      asked.unit ??
      (await dialogs.pick<UnitId>({
        title: 'Treinar soldados',
        placeholder: 'Qual soldado?',
        items: view.army.units.map((entry) => {
          const offer = offerOf(view.army, entry.id);
          return {
            icon: offer !== undefined && offer.maxAmount > 0 ? ARMY_ICON : 'lock',
            label: entry.label,
            description: `${entry.costText} · ${formatDuration(entry.secondsEach)} cada`,
            detail: offer?.blockedReason ?? entry.counters,
            value: entry.id,
          };
        }),
      }));
    if (unitId === undefined) {
      return;
    }
    const unit = unitOf(view.army, unitId);
    const offer = offerOf(view.army, unitId);
    if (unit === undefined || offer === undefined) {
      return;
    }
    if (offer.maxAmount <= 0) {
      controller.toast({
        kind: 'info',
        text: offer.blockedReason ?? 'O estoque não paga este soldado agora.',
        actions: [seeArmy],
      });
      return;
    }
    const amount =
      asked.amount ??
      (await dialogs.pick<number>({
        title: `Treinar ${unit.label}`,
        placeholder: `Quantos? ${unit.costText}, cada um.`,
        items: Array.from({ length: offer.maxAmount }, (_, index) => ({
          icon: ARMY_ICON,
          label: `${index + 1}`,
          description: trainLine(view.army, unit, index + 1),
          value: index + 1,
        })),
      }));
    if (amount === undefined) {
      return;
    }
    const checked = batchAmount(view.army, unitId, amount);
    if (checked === null) {
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `${trainLine(view.army, unit, checked)}?`,
      detail: ['O custo é cobrado agora; é um lote por vez.'],
      confirmLabel: 'Treinar',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('o treino');
      return;
    }
    const now = controller.view?.army;
    if (now === undefined || blocked(now)) {
      return;
    }
    if (batchAmount(now, unitId, checked) === null) {
      controller.toast({
        kind: 'warning',
        text: 'O estoque já não paga este lote. Nada foi enviado.',
        actions: [seeArmy],
      });
      return;
    }
    await controller.trainSoldiers(unitId, checked);
  });

  /**
   * "Cancelar o treino": o painel mostra o que o cancelamento devolve ao lado do botão e manda a
   * ordem já confirmada; a árvore e a paleta confirmam com a mesma frase.
   */
  const cancelTraining = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked = armyArg(arg);
    if (asked.confirmed && asked.lotKey !== undefined) {
      await controller.cancelTraining(asked.lotKey);
      return;
    }
    const none = () =>
      controller.toast({
        kind: 'info',
        text: 'Não há lote em treino para cancelar.',
        actions: [seeArmy],
      });
    const training = view.army.training;
    if (training === null) {
      none();
      return;
    }
    const gameId = controller.session.gameId;
    const confirmed = await dialogs.confirm({
      title: `Cancelar o treino de ${training.label}?`,
      detail: [training.cancelRefundText],
      confirmLabel: 'Cancelar o treino',
      cancelLabel: 'Manter o lote',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('o cancelamento');
      return;
    }
    const now = controller.view?.army.training;
    if (now == null) {
      none();
      return;
    }
    // A ordem não leva o lote: se ele terminou e outro entrou com a pergunta aberta, cancelar
    // agora seria cancelar o que o jogador não viu (como na forja).
    if (now.lotKey !== training.lotKey) {
      controller.toast({
        kind: 'info',
        text: 'O lote do pátio mudou com a pergunta aberta: nada foi enviado. Confira de novo.',
        actions: [seeArmy],
      });
      return;
    }
    await controller.cancelTraining(training.lotKey);
  });

  /**
   * "Dispensar soldados": sempre confirma (os soldados voltam à lavoura e o que custaram não
   * volta). O painel confirma na própria tela e manda a ordem conferida; a árvore e a paleta
   * perguntam a unidade (com quantos há) e a quantidade.
   */
  const disbandSoldiers = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked = armyArg(arg);
    if (asked.confirmed && asked.unit !== undefined && asked.amount !== undefined) {
      await controller.disbandSoldiers(asked.unit, asked.amount);
      return;
    }
    const gameId = controller.session.gameId;
    const withSoldiers = view.army.units.filter((entry) => entry.count > 0);
    if (withSoldiers.length === 0) {
      controller.toast({
        kind: 'info',
        text: 'Não há soldados para dispensar.',
        actions: [seeArmy],
      });
      return;
    }
    const unitId =
      asked.unit ??
      (await dialogs.pick<UnitId>({
        title: 'Dispensar soldados',
        placeholder: 'Qual soldado?',
        items: withSoldiers.map((entry) => ({
          icon: ARMY_ICON,
          label: entry.label,
          description: `${entry.count} no exército`,
          value: entry.id,
        })),
      }));
    if (unitId === undefined) {
      return;
    }
    const unit = unitOf(view.army, unitId);
    if (unit === undefined || unit.count <= 0) {
      return;
    }
    const amount =
      asked.amount ??
      (await dialogs.pick<number>({
        title: `Dispensar ${unit.label}`,
        placeholder: `Quantos? Há ${unit.count}.`,
        items: Array.from({ length: unit.count }, (_, index) => ({
          icon: ARMY_ICON,
          label: `${index + 1}`,
          description: disbandLine(unit, index + 1),
          value: index + 1,
        })),
      }));
    if (amount === undefined || amount < 1 || amount > unit.count) {
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `${disbandLine(unit, amount)}?`,
      detail: ['Eles voltam à lavoura como aldeões; o que custaram não volta.'],
      confirmLabel: 'Dispensar',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('a dispensa');
      return;
    }
    const now = controller.view?.army.units.find((entry) => entry.id === unitId);
    if (now === undefined || now.count < amount) {
      controller.toast({
        kind: 'warning',
        text: `Já não há ${amount} de ${unit.label}. Nada foi enviado.`,
        actions: [seeArmy],
      });
      return;
    }
    await controller.disbandSoldiers(unitId, amount);
  });

  /**
   * As formações (V4C-T3.3). Salvar e ativar chegam do painel já montados (`confirmed`: o painel
   * conferiu na tela); apagar sempre confirma, aqui. Pela paleta, "Ativar formação…" pergunta qual.
   */
  const formationArg = (arg: unknown): Record<string, unknown> =>
    typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};

  const saveFormation = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const record = formationArg(arg);
      if (record.confirmed !== true || typeof record.name !== 'string') {
        // A montagem é da tela: pela paleta só se leva ao editor.
        controller.runCommand('lords.openPanel', ARMY_SECTION);
        return;
      }
      await controller.saveFormation({
        id: typeof record.id === 'string' ? record.id : null,
        name: record.name,
        posts: record.posts as never,
        commanders: record.commanders as never,
      });
    },
    (arg) => `save:${String(formationArg(arg).id ?? 'new')}`,
  );

  const setActiveFormation = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const record = formationArg(arg);
    if (record.confirmed === true && (typeof record.id === 'string' || record.id === null)) {
      await controller.setActiveFormation(record.id);
      return;
    }
    const gameId = controller.session.gameId;
    const saved = view.army.formations;
    if (saved.length === 0) {
      controller.toast({
        kind: 'info',
        text: 'Não há formação salva. Monte uma no editor do Exército.',
        actions: [seeArmy],
      });
      return;
    }
    const id = await dialogs.pick<string>({
      title: 'Ativar como Defesa',
      placeholder: 'Qual formação?',
      items: saved.map((entry) => ({
        icon: ARMY_ICON,
        label: entry.name,
        description: entry.isActive ? 'Defesa ativa' : entry.shortfallText,
        value: entry.id,
      })),
    });
    if (id === undefined) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('a escolha da Defesa');
      return;
    }
    if (!(controller.view?.army.formations ?? []).some((entry) => entry.id === id)) {
      controller.toast({
        kind: 'info',
        text: 'A formação já não existe. Nada foi enviado.',
        actions: [seeArmy],
      });
      return;
    }
    await controller.setActiveFormation(id);
  });

  /**
   * "Simular defesa do feudo…" (V4D-T4): a prévia defensiva de uma formação salva. O painel
   * manda o `id`; a paleta pergunta qual. A formação é conferida de novo depois do diálogo.
   */
  const simulateBattle = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const gameId = controller.session.gameId;
      const record = formationArg(arg);
      const siegeWave = view.siege?.waves.find((wave) => wave.number === record.siegeWave)?.number;
      if (record.siegeWave !== undefined && siegeWave === undefined) return;
      if (view.army.formations.length === 0) {
        controller.toast({
          kind: 'info',
          text: 'Não há formação salva para simular. Monte uma no editor do Exército.',
          actions: [seeArmy],
        });
        return;
      }
      const id =
        typeof record.id === 'string'
          ? record.id
          : await dialogs.pick<string>({
              title: 'Simular defesa do feudo',
              placeholder: 'Qual formação?',
              items: view.army.formations.map((entry) => ({
                icon: ARMY_ICON,
                label: entry.name,
                description: entry.isActive ? 'Defesa ativa' : entry.shortfallText,
                value: entry.id,
              })),
            });
      if (id === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a prévia da batalha');
        return;
      }
      if (!(controller.view?.army.formations ?? []).some((entry) => entry.id === id)) {
        controller.toast({
          kind: 'info',
          text: 'A formação já não existe. Nada foi enviado.',
          actions: [seeArmy],
        });
        return;
      }
      await controller.simulateBattle(id, siegeWave);
    },
    (arg) => `simulate:${String(formationArg(arg).id ?? '')}`,
  );

  /** A disponibilidade de marcha é relida depois de cada diálogo, inclusive a confirmação. */
  const marchReady = (formationId: string) => {
    const army = controller.view?.army;
    if (army === undefined) {
      return null;
    }
    const formation = army.formations.find((entry) => entry.id === formationId);
    if (formation === undefined) {
      controller.toast({
        kind: 'info',
        text: 'A formação já não existe. Nada foi enviado.',
        actions: [seeArmy],
      });
      return null;
    }
    const offer = army.campAssault.formations.find((entry) => entry.formationId === formationId);
    if (army.campaign !== null || offer?.canAttack !== true) {
      controller.toast({
        kind: 'warning',
        text:
          army.campaign?.text ??
          offer?.blockedReason ??
          army.campAssault.blockedReason ??
          'Esta formação não pode marchar agora. Nada foi enviado.',
        actions: [seeArmy],
      });
      return null;
    }
    return { army, formation };
  };

  /** Só a formação e a viagem conferidas; outras mudanças do feudo não invalidam a revisão. */
  const assaultReview = ({ army, formation }: NonNullable<ReturnType<typeof marchReady>>) =>
    JSON.stringify({
      name: formation.name,
      posts: formation.posts,
      commanders: formation.commanders,
      total: formation.total,
      shortfall: formation.shortfall,
      travelSeconds: army.campAssault.travelSeconds,
      totalSeconds: army.campAssault.totalSeconds,
    });

  /**
   * "Atacar o Acampamento…" (V4F-T3): a campanha ofensiva contra os saqueadores. O painel manda a
   * formação; a paleta pergunta qual, com a lista das que podem marchar. A confirmação avisa por
   * quanto tempo os esquadrões ficam fora.
   */
  const attackCamp = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const gameId = controller.session.gameId;
      const { army } = view;
      if (army.campaign !== null) {
        controller.toast({
          kind: 'warning',
          text: army.campaign.text,
          actions: [seeArmy],
        });
        return;
      }
      if (
        army.campAssault.blockedReason !== null &&
        army.campAssault.formations.every((f) => !f.canAttack)
      ) {
        controller.toast({
          kind: 'warning',
          text: army.campAssault.blockedReason,
          actions: [seeArmy],
        });
        return;
      }

      const rawId =
        typeof arg === 'object' && arg !== null
          ? ((arg as Record<string, unknown>).formationId ?? (arg as Record<string, unknown>).id)
          : undefined;
      let formationId = typeof rawId === 'string' ? rawId : undefined;

      if (formationId === undefined) {
        if (army.formations.length === 0) {
          controller.toast({
            kind: 'info',
            text: 'Não há formação salva para marchar. Monte uma no editor do Exército.',
            actions: [seeArmy],
          });
          return;
        }
        const picked = await dialogs.pick<{ formationId: string }>({
          title: 'Atacar o Acampamento',
          placeholder: 'Com qual formação?',
          detail: [army.campAssault.text],
          items: army.formations.map((f) => {
            const assault = army.campAssault.formations.find((entry) => entry.formationId === f.id);
            const can = assault?.canAttack ?? false;
            return {
              icon: can ? 'sword' : 'lock',
              label: f.name,
              description: can ? 'Pronta para marchar' : (assault?.blockedReason ?? 'Indisponível'),
              value: { formationId: f.id },
            };
          }),
        });
        if (picked === undefined) {
          return;
        }
        formationId = picked.formationId;
      }

      if (!sameGame(gameId)) {
        sessionEnded('o ataque ao Acampamento');
        return;
      }

      const current = marchReady(formationId);
      if (current === null) {
        return;
      }
      const reviewed = assaultReview(current);
      const durationText = formatApprox(current.army.campAssault.totalSeconds);
      const confirmed = await dialogs.confirm({
        title: 'Atacar o Acampamento?',
        detail: [
          `O feudo fica sem estes esquadrões por ${durationText}.`,
          `Formação: ${current.formation.name}.`,
          ...current.formation.posts.map(
            (post) => `${post.wingLabel}, ${post.lineLabel}: ${post.text}`,
          ),
          ...current.formation.commanders
            .filter((commander) => commander.heroId !== null)
            .map((commander) => `${commander.wingLabel}: ${commander.heroName}`),
        ],
        confirmLabel: 'Atacar o Acampamento',
        cancelLabel: 'Desistir',
      });
      if (!confirmed) {
        return;
      }

      if (!sameGame(gameId)) {
        sessionEnded('o ataque ao Acampamento');
        return;
      }

      const latest = marchReady(formationId);
      if (latest === null) {
        return;
      }
      if (assaultReview(latest) !== reviewed) {
        controller.toast({
          kind: 'warning',
          text: 'A formação ou o prazo da campanha mudou enquanto você decidia. Nada foi enviado: confira o ataque de novo.',
          actions: [seeArmy],
        });
        return;
      }
      await controller.attackCamp(formationId);
    },
    () => 'campaign',
  );

  const deleteFormation = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const gameId = controller.session.gameId;
      const record = formationArg(arg);
      const id =
        typeof record.id === 'string'
          ? record.id
          : await dialogs.pick<string>({
              title: 'Apagar formação',
              placeholder: 'Qual formação?',
              items: view.army.formations.map((entry) => ({
                icon: ARMY_ICON,
                label: entry.name,
                description: entry.canDelete ? entry.shortfallText : 'não pode ser apagada agora',
                value: entry.id,
              })),
            });
      if (id === undefined) {
        return;
      }
      const target = view.army.formations.find((entry) => entry.id === id);
      if (target === undefined) {
        return;
      }
      const confirmed = await dialogs.confirm({
        title: `Apagar a formação "${target.name}"?`,
        detail: ['A formação some da lista; os soldados continuam no exército.'],
        confirmLabel: 'Apagar',
        cancelLabel: 'Agora não',
      });
      if (!confirmed) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a exclusão da formação');
        return;
      }
      if (!(controller.view?.army.formations ?? []).some((entry) => entry.id === id)) {
        controller.toast({
          kind: 'info',
          text: 'A formação já não existe. Nada foi enviado.',
          actions: [seeArmy],
        });
        return;
      }
      await controller.deleteFormation(id);
    },
    (arg) => `delete:${String(formationArg(arg).id ?? '')}`,
  );

  /**
   * "Reparar…": o painel do Arsenal já mostrou o custo e o prazo e manda a ordem conferida
   * (`confirmed`); a árvore, o Retorno e a paleta perguntam qual item (os travados aparecem com o
   * motivo da visão) e confirmam com a mesma frase. **A visão é lida de novo depois de cada
   * diálogo**: a fila, o ferro e o lugar do item podem ter mudado, e o que mudou não vira ordem.
   */
  const repairItem = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const record = typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};
    const asked = typeof record.itemId === 'string' ? record.itemId : undefined;
    if (record.confirmed === true && asked !== undefined) {
      await controller.repairItem(asked);
      return;
    }
    const refuse = (text: string) => controller.toast({ kind: 'info', text, actions: [seeSmithy] });
    if (!view.smithy.built) {
      refuse(view.smithy.text);
      return;
    }
    if (view.smithy.repairOffer.items.length === 0) {
      refuse('Nenhum item precisa de reparo.');
      return;
    }
    const gameId = controller.session.gameId;
    const itemId =
      asked ??
      (await dialogs.pick<string>({
        title: 'Reparar um item',
        placeholder: 'Qual item o Ferreiro refaz?',
        items: view.smithy.repairOffer.items.map((entry) => ({
          icon: entry.canRepair ? SMITHY_ICON : 'lock',
          label: entry.label,
          description: `${entry.condition} de ${entry.durability} · ${entry.costText} · ${formatDuration(entry.seconds)}`,
          detail: entry.blockedReason ?? '',
          value: entry.itemId,
        })),
      }));
    if (itemId === undefined) {
      return;
    }
    const repair = repairFor(view.smithy, itemId);
    if (repair === undefined) {
      return;
    }
    if (!repair.canRepair) {
      refuse(repair.blockedReason ?? view.smithy.text);
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `${repairLine(repair)}?`,
      detail: [
        'O ferro é cobrado agora; um reparo não se cancela, e a forja fica ocupada até ele acabar.',
      ],
      confirmLabel: 'Reparar',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('o reparo');
      return;
    }
    const now = controller.view?.smithy;
    const nowRepair = now === undefined ? undefined : repairFor(now, itemId);
    if (nowRepair === undefined || !nowRepair.canRepair) {
      refuse(nowRepair?.blockedReason ?? 'O reparo já não está disponível. Nada foi enviado.');
      return;
    }
    await controller.repairItem(itemId);
  });

  // --- Mercado, caravanas e Mestres ----------------------------------------------

  const seeMarket = {
    label: 'Ver o Mercado',
    run: () => controller.runCommand('lords.openPanel', MARKET_SECTION),
  };

  /** O que um acionamento de `lords.trade` já traz: o painel manda tudo, o atalho "Vender" quase. */
  const tradeRequest = (arg: unknown) => {
    const record = typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};
    const resource = typeof record.resource === 'string' ? record.resource : undefined;
    const direction: TradeDirection | undefined =
      record.direction === 'buy' || record.direction === 'sell' ? record.direction : undefined;
    const amount = typeof record.amount === 'number' ? record.amount : undefined;
    const quoteDay = typeof record.quoteDay === 'number' ? record.quoteDay : undefined;
    return { resource, direction, amount, quoteDay, confirmed: record.confirmed === true };
  };

  /** O recurso é o que a trava do fluxo usa: o duplo clique em "Vender madeira" vale uma ordem. */
  const tradeTarget = (arg?: unknown) => tradeRequest(arg).resource;

  /**
   * "Comprar ou vender no Mercado": o único caminho da negociação. O painel já mostrou o total e
   * mandou a ordem conferida (`confirmed`, com o dia da cotação que o jogador viu); o atalho
   * "Vender" manda o recurso, o sentido e a quantidade e pede só a confirmação; a paleta
   * pergunta o recurso, o sentido e a quantidade, e confirma com o total. **Depois de qualquer
   * diálogo o fluxo lê a visão de novo**: se o dia da cotação mudou enquanto o jogador decidia, o
   * preço novo é dito e nada é enviado, para ele conferir de novo. O total é `quantidade × preço
   * de hoje`, a conta exata que o servidor cobra (`ui/market.ts`).
   */
  const trade = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked = tradeRequest(arg);
    if (
      asked.confirmed &&
      asked.resource !== undefined &&
      asked.direction !== undefined &&
      asked.amount !== undefined &&
      asked.quoteDay !== undefined
    ) {
      await controller.trade(
        asked.resource as Parameters<typeof controller.trade>[0],
        asked.direction,
        asked.amount,
        asked.quoteDay,
      );
      return;
    }
    if (!hasMarket(view.market)) {
      controller.toast({ kind: 'info', text: view.market.text, actions: [seeMarket] });
      return;
    }
    const gameId = controller.session.gameId;
    const quoteDay = view.market.quoteDay;
    const picked =
      asked.resource === undefined
        ? await dialogs.pick({
            title: 'Comprar ou vender no Mercado',
            placeholder: 'Qual recurso?',
            items: view.market.prices.map((entry) => ({
              icon: TRENDS[entry.trend].icon,
              label: entry.label,
              description: `compra ${entry.buyText} · venda ${entry.sellText} · ${TRENDS[entry.trend].word}`,
              detail: `${remainingLine(entry)} ${entry.breakdown}`,
              value: entry.resource,
            })),
          })
        : asked.resource;
    if (picked === undefined) {
      return;
    }
    const direction: TradeDirection | undefined =
      asked.direction ??
      (await dialogs.pick<TradeDirection>({
        title: 'Comprar ou vender no Mercado',
        placeholder: 'Comprar ou vender?',
        items: (['buy', 'sell'] as const).map((side) => {
          const row = priceOf(view.market, picked);
          return {
            icon: row !== undefined && blockedFor(row, side) !== null ? 'lock' : 'check',
            label: directionVerb(side),
            description:
              row === undefined
                ? ''
                : `a ${side === 'buy' ? row.buyText : row.sellText} · cabem até ${formatNumber(maxFor(row, side))}`,
            detail: row === undefined ? '' : (blockedFor(row, side) ?? ''),
            value: side,
          };
        }),
      }));
    if (direction === undefined) {
      return;
    }
    const row = priceOf(view.market, picked);
    if (row === undefined) {
      controller.toast({
        kind: 'warning',
        text: 'O Mercado não negocia este recurso. Nada foi enviado.',
        actions: [seeMarket],
      });
      return;
    }
    const max = maxFor(row, direction);
    const answer =
      asked.amount !== undefined
        ? String(asked.amount)
        : await dialogs.input({
            title: `${directionVerb(direction)} ${row.label.toLowerCase()}`,
            prompt: [
              `${direction === 'buy' ? 'Compra' : 'Venda'} a ${direction === 'buy' ? row.buyText : row.sellText} de ouro por unidade.`,
              remainingLine(row),
              blockedFor(row, direction),
            ]
              .filter((line) => line !== null)
              .join(' '),
            placeholder: max > 0 ? `de 1 a ${max}` : 'nada cabe agora',
            value: max > 0 ? String(max) : '',
            confirmLabel: 'Conferir',
            // A cada tecla: o total da ordem, antes de confirmar.
            validate: (value) => {
              const amount = parseAmount(value);
              const total = tradeTotal(row, direction, amount);
              if (amount === null || total === null) {
                return { message: 'Digite quantas unidades, de 1 em diante.', severity: 'error' };
              }
              return {
                message: `Total: ${goldText(total)} de ouro.${max > 0 && amount > max ? ` Mais do que cabe agora (${formatNumber(max)}): o servidor deve recusar.` : ''}`,
                severity: 'info',
              };
            },
          });
    const amount = answer === undefined ? null : parseAmount(answer);
    if (amount === null) {
      return;
    }
    const total = tradeTotal(row, direction, amount);
    if (total === null) {
      return;
    }
    const confirmed = await dialogs.confirm({
      title: `${tradeLine(row, direction, amount, total)}?`,
      detail: [
        `Preço de hoje: ${direction === 'buy' ? row.buyText : row.sellText} de ouro por unidade (${TRENDS[row.trend].word}).`,
        row.breakdown,
        ...[
          stockLeftLine(view, row, direction, amount),
          direction === 'sell' ? row.surplusText : null,
        ].filter((line): line is string => line !== null && line !== ''),
      ],
      confirmLabel: directionVerb(direction),
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    // Depois da espera: a conta, a visão de agora e o dia da cotação que o jogador conferiu.
    if (!sameGame(gameId)) {
      sessionEnded('a negociação');
      return;
    }
    const now = controller.view?.market;
    const nowRow = now === undefined ? undefined : priceOf(now, row.resource);
    if (now === undefined || nowRow === undefined || !hasMarket(now)) {
      controller.toast({
        kind: 'warning',
        text: 'O Mercado já não negocia assim. Nada foi enviado.',
        actions: [seeMarket],
      });
      return;
    }
    if (now.quoteDay !== quoteDay) {
      controller.toast({
        kind: 'warning',
        text: `O dia virou e o preço do Mercado mudou enquanto você decidia: agora ${row.label.toLowerCase()} está a ${direction === 'buy' ? nowRow.buyText : nowRow.sellText} de ouro. Nada foi enviado: confira de novo.`,
        actions: [
          {
            label: 'Negociar de novo',
            run: () =>
              controller.runCommand('lords.trade', {
                resource: row.resource,
                direction,
                amount,
              }),
          },
        ],
      });
      return;
    }
    await controller.trade(row.resource, direction, amount, quoteDay);
  }, tradeTarget);

  /** O que um acionamento de `lords.sendCaravan` já traz. */
  const caravanRequest = (arg: unknown) => {
    const record = typeof arg === 'object' && arg !== null ? (arg as Record<string, unknown>) : {};
    return {
      resource: typeof record.resource === 'string' ? record.resource : undefined,
      amount: typeof record.amount === 'number' ? record.amount : undefined,
      escortHeroId:
        typeof record.escortHeroId === 'string' || record.escortHeroId === null
          ? record.escortHeroId
          : undefined,
      quoteDay: typeof record.quoteDay === 'number' ? record.quoteDay : undefined,
      confirmed: record.confirmed === true,
    };
  };

  const caravanTarget = (arg?: unknown) => caravanRequest(arg).resource;

  /**
   * "Mandar uma caravana": o único caminho do envio. O painel já mostrou o preço fixado, o que ela
   * rende, a viagem e o risco com a conta, e manda a ordem conferida (`confirmed`, com o dia da
   * cotação que o jogador viu); a árvore e a paleta perguntam a carga, a quantidade e a escolta
   * (só quem a visão diz que pode ir) e confirmam com o preço, a chegada e o risco. **Depois de
   * cada diálogo a visão é lida de novo**: o dia da cotação, o lugar na estrada e a lista das
   * escoltas. O que mudou não vira ordem.
   */
  const sendCaravan = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked = caravanRequest(arg);
    if (
      asked.confirmed &&
      asked.resource !== undefined &&
      asked.amount !== undefined &&
      asked.escortHeroId !== undefined &&
      asked.quoteDay !== undefined
    ) {
      await controller.sendCaravan(
        asked.resource as Parameters<typeof controller.sendCaravan>[0],
        asked.amount,
        asked.escortHeroId,
        asked.quoteDay,
      );
      return;
    }
    const { caravanOffer: offer } = view.market;
    if (!hasMarket(view.market) || !offer.available) {
      controller.toast({
        kind: 'info',
        text: hasMarket(view.market) ? (offer.blockedReason ?? view.market.text) : view.market.text,
        actions: [
          {
            label: 'Ver as caravanas',
            run: () => controller.runCommand('lords.openPanel', CARAVANS_SECTION),
          },
        ],
      });
      return;
    }
    const gameId = controller.session.gameId;
    const quoteDay = view.market.quoteDay;
    const resource =
      asked.resource ??
      (await dialogs.pick({
        title: 'Mandar uma caravana',
        placeholder: `Qual carga? Viagem a ${offer.destination}.`,
        detail: [offer.priceRatioText, offer.riskText, offer.lossText],
        items: offer.resources.map((entry) => ({
          icon: entry.maxSendable > 0 ? 'package' : 'lock',
          label: entry.label,
          description: `a ${entry.unitPriceText} de ouro · até ${formatNumber(entry.maxSendable)}`,
          detail: entry.breakdown,
          value: entry.resource,
        })),
      }));
    if (resource === undefined) {
      return;
    }
    const chosen = caravanResource(offer, resource);
    if (chosen === undefined) {
      return;
    }
    const answer =
      asked.amount !== undefined
        ? String(asked.amount)
        : await dialogs.input({
            title: `Caravana de ${chosen.label.toLowerCase()}`,
            prompt: `Preço fixado no envio: ${chosen.unitPriceText} de ouro por unidade. Cabem até ${formatNumber(chosen.maxSendable)}.`,
            placeholder:
              chosen.maxSendable > 0 ? `de 1 a ${chosen.maxSendable}` : 'sem lugar agora',
            value: chosen.maxSendable > 0 ? String(chosen.maxSendable) : '',
            confirmLabel: 'Seguir',
            validate: (value) => {
              const amount = parseAmount(value);
              return amount === null
                ? { message: 'Digite quantas unidades, de 1 em diante.', severity: 'error' }
                : {
                    message: `Rende ${goldText(caravanGold(chosen, amount))} de ouro se chegar inteira.`,
                    severity: 'info',
                  };
            },
          });
    const amount = answer === undefined ? null : parseAmount(answer);
    if (amount === null) {
      return;
    }
    const escorts = escortHeroes(view);
    const escortId: string | null | undefined =
      asked.escortHeroId !== undefined
        ? asked.escortHeroId
        : escorts.length === 0
          ? null
          : await dialogs.pick<string | null>({
              title: 'Escolta da caravana',
              placeholder: 'Com quem?',
              detail: [offer.riskText, offer.riskBreakdown],
              items: [
                { icon: 'close', label: 'Sem escolta', description: offer.riskText, value: null },
                ...escorts.map((hero) => ({
                  icon: 'person',
                  label: escortLine(hero),
                  description: 'fora do feudo até a caravana chegar',
                  value: hero.id,
                })),
              ],
            });
    if (escortId === undefined) {
      return;
    }
    const escortName = escorts.find((hero) => hero.id === escortId)?.name ?? null;
    const gold = caravanGold(chosen, amount);
    const confirmed = await dialogs.confirm({
      title: `Mandar ${formatNumber(amount)} de ${chosen.label.toLowerCase()} a ${offer.destination}?`,
      detail: [
        `Preço fixado: ${chosen.unitPriceText} de ouro por unidade: ${goldText(gold)} de ouro se chegar inteira.`,
        `Viagem de ${formatDuration(offer.tripSeconds)}. ${escortName === null ? 'Nenhuma escolta.' : `Escolta: ${escortName}.`}`,
        offer.riskText,
        offer.riskBreakdown,
        offer.lossText,
      ],
      confirmLabel: 'Mandar a caravana',
      cancelLabel: 'Agora não',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('a caravana');
      return;
    }
    const now = controller.view?.market;
    if (now === undefined || !now.caravanOffer.available) {
      controller.toast({
        kind: 'warning',
        text: `${now?.caravanOffer.blockedReason ?? 'A estrada não tem lugar agora.'} Nada foi enviado.`,
        actions: [seeMarket],
      });
      return;
    }
    if (now.quoteDay !== quoteDay) {
      const row = caravanResource(now.caravanOffer, chosen.resource);
      controller.toast({
        kind: 'warning',
        text: `O dia virou e o preço mudou enquanto você decidia${row === undefined ? '' : `: a ${chosen.label.toLowerCase()} agora é fixada a ${row.unitPriceText} de ouro`}. Nada foi enviado: confira de novo.`,
        actions: [
          {
            label: 'Mandar de novo',
            run: () =>
              controller.runCommand('lords.sendCaravan', {
                resource: chosen.resource,
                amount,
                escortHeroId: escortId,
              }),
          },
        ],
      });
      return;
    }
    if (
      escortId !== null &&
      !escortHeroes(controller.view ?? view).some((hero) => hero.id === escortId)
    ) {
      controller.toast({
        kind: 'warning',
        text: `${escortName ?? 'O herói da escolta'} já não pode escoltar: partiu, feriu-se ou saiu do feudo. Nada foi enviado.`,
        actions: [seeMarket],
      });
      return;
    }
    await controller.sendCaravan(chosen.resource, amount, escortId, quoteDay);
  }, caravanTarget);

  /** O Mestre e o edifício que quem chamou `lords.assignMaster` já escolheu. */
  const masterRequest = (arg: unknown): { masterId?: string; building?: string | null } => {
    if (typeof arg === 'string') {
      return arg === '' ? {} : { masterId: arg };
    }
    if (typeof arg !== 'object' || arg === null) {
      return {};
    }
    const { id, masterId, building } = arg as Record<string, unknown>;
    const chosen: { building?: string | null } =
      typeof building === 'string' || building === null ? { building } : {};
    if (typeof masterId === 'string') {
      return { masterId, ...chosen };
    }
    return typeof id === 'string' && id.startsWith(MASTER_NODE)
      ? { masterId: id.slice(MASTER_NODE.length), ...chosen }
      : {};
  };

  const masterNow = (masterId: string) =>
    controller.view?.masters.find((entry) => entry.id === masterId);

  const masterGone = () =>
    controller.toast({
      kind: 'warning',
      text: 'Este Mestre já não serve ao feudo. Nada foi enviado.',
      actions: [{ label: 'Ver o feudo', run: () => controller.navigate('fief') }],
    });

  /**
   * "Mover Mestre": o único caminho da alocação de um Mestre. O painel e a árvore mandam o Mestre;
   * a paleta pergunta qual. A lista dos edifícios diz, em cada linha, o que ele passaria a
   * render (durante a adaptação e depois dela) ou por que não pode ir (a frase do servidor, com
   * cadeado), e a confirmação repete as regras do Mestre, a adaptação entre elas: **toda
   * chegada a um edifício paga a adaptação**. Depois dos diálogos, a visão é lida de novo.
   */
  const assignMaster = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const asked = masterRequest(arg);
      if (asked.masterId !== undefined && masterNow(asked.masterId) === undefined) {
        masterGone();
        return;
      }
      if (view.masters.length === 0) {
        controller.toast({
          kind: 'info',
          text: view.workersRules.masterText,
          actions: [{ label: 'Ver o feudo', run: () => controller.navigate('fief') }],
        });
        return;
      }
      const gameId = controller.session.gameId;
      const master =
        view.masters.find((entry) => entry.id === asked.masterId) ??
        (view.masters.length === 1
          ? view.masters[0]
          : await dialogs.pick<ViewState['masters'][number]>({
              title: 'Mover Mestre',
              placeholder: 'Qual Mestre?',
              items: view.masters.map((entry) => ({
                icon: 'star-full',
                label: entry.name,
                description: entry.buildingLabel,
                detail: entry.originText,
                value: entry,
              })),
            }));
      if (master === undefined) {
        return;
      }
      const building =
        asked.building !== undefined
          ? asked.building
          : await dialogs.pick<string | null>({
              title: `Mover ${master.name}`,
              placeholder: 'Para qual edifício?',
              detail: [view.workersRules.masterText],
              items: [
                ...master.options.map((option) => ({
                  icon: option.blockedReason !== null ? 'lock' : option.current ? 'check' : 'tools',
                  label: option.label,
                  description: masterOptionLine(option),
                  value: option.building as string | null,
                })),
                ...(master.building === null
                  ? []
                  : [
                      {
                        icon: 'close',
                        label: 'Deixar sem edifício',
                        description: 'Ele deixa de trabalhar e perde o bônus.',
                        value: null as string | null,
                      },
                    ]),
              ],
            });
      if (building === undefined) {
        return;
      }
      const option =
        building === null ? undefined : master.options.find((entry) => entry.building === building);
      if (option !== undefined && option.blockedReason !== null && !option.current) {
        controller.toast({
          kind: 'info',
          text: option.blockedReason,
          actions: [{ label: 'Ver o feudo', run: () => controller.navigate('fief') }],
        });
        return;
      }
      const confirmed = await dialogs.confirm({
        title:
          building === null
            ? `Tirar ${master.name} do edifício?`
            : `Mover ${master.name} para ${option?.label ?? 'o edifício'}?`,
        detail: [
          ...(option === undefined ? [] : [masterOptionLine(option)]),
          view.workersRules.masterText,
        ],
        confirmLabel: building === null ? 'Tirar' : 'Mover',
        cancelLabel: 'Agora não',
      });
      if (!confirmed) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a alocação do Mestre');
        return;
      }
      const now = masterNow(master.id);
      if (now === undefined) {
        masterGone();
        return;
      }
      const nowOption =
        building === null ? undefined : now.options.find((entry) => entry.building === building);
      if (nowOption !== undefined && nowOption.blockedReason !== null && !nowOption.current) {
        controller.toast({
          kind: 'warning',
          text: `${nowOption.blockedReason} Nada foi enviado.`,
          actions: [{ label: 'Ver o feudo', run: () => controller.navigate('fief') }],
        });
        return;
      }
      await controller.assignMaster(
        master.id,
        building as Parameters<typeof controller.assignMaster>[1],
      );
    },
    (arg) => masterRequest(arg).masterId,
  );

  // --- Expedições ----------------------------------------------------------------

  const seeExpeditions = {
    label: 'Ver as expedições',
    run: () => controller.runCommand('lords.openPanel', EXPEDITIONS_SECTION),
  };

  /** A expedição ainda espera na encruzilhada, na visão de agora. */
  const waitingNow = (expeditionId: string): Expedition | undefined =>
    controller.view?.guild.expeditions.find(
      (entry) => entry.id === expeditionId && entry.crossroads !== null,
    );

  /**
   * A encruzilhada saiu da tela sem a escolha do jogador: diz por quê. Se o prazo que a lista
   * mostrava já venceu (com a folga do relógio), a Postura decidiu; se não, outra aba ou outro
   * navegador escolheu. Nada foi enviado.
   */
  const explainDecided = (expedition: Expedition, decidesAt: number) => {
    const expired = controller.now() >= decidesAt - EXPIRY_SLACK_MS;
    const posture = expedition.crossroads?.postureLabel ?? expedition.postureLabel;
    controller.toast({
      kind: 'warning',
      text: expired
        ? `O prazo da encruzilhada de "${expedition.label}" acabou antes da sua palavra, e a Postura ${posture} decidiu. Nada foi enviado: a Crônica conta o caminho.`
        : `A encruzilhada de "${expedition.label}" já foi decidida: em outra aba ou em outro navegador. Nada foi enviado.`,
      actions: [seeExpeditions],
    });
  };

  /**
   * A lista dos caminhos de uma encruzilhada, para quem decide pelo teclado: a situação no alto,
   * com o prazo real e o que a Postura faz sem resposta (na frase do servidor), e cada opção com
   * a pista e, bloqueada, o requisito. O que já vem marcado é a opção da Postura: `Enter` sem
   * ler faz o que aconteceria de qualquer modo. A lista fecha sozinha, sem enviar nada, se a
   * equipe deixar de esperar com ela aberta (o prazo venceu, ou outra aba escolheu), e também
   * quando a sessão termina: aí o aviso é o da sessão, não o da decisão. `null` é "nada a
   * enviar", já avisado.
   */
  const pickPath = async (
    expedition: Expedition,
    gameId: string | null,
  ): Promise<string | null> => {
    const { crossroads } = expedition;
    if (crossroads === null) {
      return null;
    }
    const decidesAt = controller.now() + crossroadsSecondsLeft(crossroads, elapsed()) * 1000;
    const gone = new AbortController();
    const stop = controller.onChange(() => {
      if (waitingNow(expedition.id) === undefined) {
        gone.abort();
      }
    });
    try {
      const optionId = await dialogs.pick<string>({
        title: `Encruzilhada: ${expedition.label}`,
        placeholder: 'Que caminho a equipe toma?',
        detail: [
          `${crossroads.title} · ${teamLine(expedition.teamNames)}`,
          crossroads.text,
          `${capitalize(crossroadsDeadline(crossroads, elapsed()))}. ${crossroads.postureText}`,
        ],
        items: crossroads.options.map((option) => ({
          // Cadeado: a equipe não pode tomar este caminho, e o detalhe diz o que ele pede.
          icon: option.locked ? 'lock' : 'check',
          label: option.label,
          detail: [
            option.locked ? (option.lockedReason ?? 'A equipe não pode tomar este caminho.') : null,
            option.hint,
            isPostureOption(crossroads, option)
              ? `É o que a Postura ${crossroads.postureLabel} escolhe, se o prazo acabar.`
              : null,
          ]
            .filter((line) => line !== null)
            .join(' '),
          value: option.id,
        })),
        selected: Math.max(
          0,
          crossroads.options.findIndex((option) => isPostureOption(crossroads, option)),
        ),
        signal: gone.signal,
      });
      if (!sameGame(gameId)) {
        // A sessão acabou, ou o feudo é outro: a encruzilhada não foi decidida por ninguém, só
        // deixou de ser a desta tela. Vem antes de `explainDecided`, que diria "em outra aba".
        if (optionId !== undefined || gone.signal.aborted) {
          sessionEnded('a escolha do caminho');
        }
        return null;
      }
      if (
        gone.signal.aborted ||
        (optionId !== undefined && waitingNow(expedition.id) === undefined)
      ) {
        explainDecided(expedition, decidesAt);
        return null;
      }
      return optionId ?? null;
    } finally {
      stop();
    }
  };

  /**
   * "Escolher caminho da expedição": o único caminho da escolha (GDD §13.6). O painel já mostrou
   * a encruzilhada inteira e manda a expedição e a opção do botão clicado; a árvore, o aviso e a
   * aba Hoje mandam a expedição, e a lista pergunta o caminho; a paleta pergunta a expedição
   * (quando há mais de uma esperando) e depois o caminho. Mesmo bloqueada, a opção escolhida
   * segue: quem recusa é o servidor, com o motivo atualizado.
   */
  const chooseExpeditionPath = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const request = expeditionRequest(arg);
      if (request.expeditionId !== undefined && request.optionId !== undefined) {
        await controller.chooseExpeditionPath(request.expeditionId, request.optionId);
        return;
      }
      const waiting = waitingExpeditions(view.guild);
      if (request.expeditionId !== undefined && waitingNow(request.expeditionId) === undefined) {
        // A linha, o aviso ou o botão eram de uma encruzilhada que já foi decidida.
        controller.toast({
          kind: 'warning',
          text: 'Esta equipe já não espera na encruzilhada: o caminho foi escolhido, ou o prazo acabou e a Postura decidiu.',
          actions: [seeExpeditions],
        });
        return;
      }
      if (waiting.length === 0) {
        controller.toast({
          kind: 'info',
          text: 'Nenhuma equipe espera em uma encruzilhada agora.',
          actions: [seeExpeditions],
        });
        return;
      }
      const gameId = controller.session.gameId;
      let expedition = waiting.find((entry) => entry.id === request.expeditionId);
      if (expedition === undefined) {
        const opened = controller.now();
        const since = elapsed();
        expedition =
          waiting.length === 1
            ? waiting[0]
            : await dialogs.pick<Expedition>({
                title: 'Escolher caminho da expedição',
                placeholder: 'Qual equipe?',
                items: waiting.map((entry) => ({
                  icon: CROSSROADS_ICON,
                  label: entry.label,
                  description:
                    entry.crossroads === null ? '' : crossroadsDeadline(entry.crossroads, since),
                  detail: `${teamLine(entry.teamNames)} · ${entry.crossroads?.title ?? entry.nodeTitle}`,
                  value: entry,
                })),
              });
        if (expedition === undefined) {
          return;
        }
        if (!sameGame(gameId)) {
          sessionEnded('a escolha do caminho');
          return;
        }
        if (waitingNow(expedition.id) === undefined) {
          explainDecided(
            expedition,
            opened +
              (expedition.crossroads === null
                ? 0
                : crossroadsSecondsLeft(expedition.crossroads, since) * 1000),
          );
          return;
        }
        // A visão pode ter mudado com a lista aberta: vale a encruzilhada de agora.
        expedition = waitingNow(expedition.id) ?? expedition;
      }
      const optionId = await pickPath(expedition, gameId);
      if (optionId === null) {
        return;
      }
      await controller.chooseExpeditionPath(expedition.id, optionId);
    },
    (arg) => expeditionRequest(arg).expeditionId,
  );

  /** O destino ainda está na lista da Guilda, na visão de agora. */
  const destinationNow = (modelId: string): Destination | undefined =>
    controller.view?.guild.available.find((entry) => entry.modelId === modelId);

  const destinationGone = () =>
    controller.toast({
      kind: 'warning',
      text: 'Este destino já não está na lista da Guilda. Nada foi enviado.',
      actions: [seeExpeditions],
    });

  /**
   * A equipe de um destino, herói por herói: cada lista traz quem ainda pode entrar, com a
   * ficha e o que ele vale contra o primeiro trecho, e, com gente bastante, a opção de partir
   * com quem já foi marcado (com a régua da equipe, nos números da visão). Depois de cada lista
   * a conta e a visão são lidas de novo: quem deixou de poder partir sai da equipe. Quem pode
   * entrar é quem a visão lista para o destino; se ela diz que nenhuma equipe serve, nada é
   * perguntado. Havendo escolha a fazer, a primeira lista abre com a equipe que a visão sugere,
   * pronta para partir. `null` é desistência, ou nada a enviar.
   */
  const pickTeam = async (modelId: string, gameId: string | null): Promise<string[] | null> => {
    const chosen: string[] = [];
    for (;;) {
      const guild = controller.view?.guild;
      const destination = destinationNow(modelId);
      if (guild === undefined || destination === undefined) {
        destinationGone();
        return null;
      }
      if (!canSend(destination)) {
        // Nenhuma equipe serve agora: quem chamou diz o motivo do servidor.
        return null;
      }
      const eligible = eligibleHeroes(guild, destination);
      // Quem saiu do feudo, ou se feriu, com a lista aberta já não está na equipe.
      const team = chosen.filter((heroId) => eligible.some((hero) => hero.id === heroId));
      chosen.splice(0, chosen.length, ...team);
      const remaining = eligible.filter((hero) => !chosen.includes(hero.id));
      const full = chosen.length >= destination.teamMax || remaining.length === 0;
      const enough = chosen.length >= destination.teamMin;
      if (full) {
        return enough ? chosen : null;
      }
      const names = teamLine(
        chosen.map((heroId) => eligible.find((hero) => hero.id === heroId)?.name ?? heroId),
      );
      const fit = teamFit(destination, chosen);
      const DONE = '';
      // A equipe sugerida só é oferta quando há o que escolher além dela.
      const SUGGESTED = ' ';
      const suggested = defaultTeam(destination);
      const offerSuggested =
        chosen.length === 0 && suggested.length > 0 && suggested.length < eligible.length;
      const suggestedFit = teamFit(destination, suggested);
      const picked = await dialogs.pick<string>({
        title: `Enviar expedição: ${destination.label}`,
        placeholder:
          chosen.length === 0
            ? `Quem vai? A equipe leva ${teamSize(destination)}.`
            : `Mais alguém? A equipe leva ${teamSize(destination)}.`,
        detail: [
          destination.requirementsText,
          destination.firstStretchText,
          ...(destination.fit === null ? [] : [destination.fit.text]),
        ],
        items: [
          ...(offerSuggested
            ? [
                {
                  icon: 'check',
                  label: `Partir com ${teamLine(
                    suggested.map(
                      (heroId) => eligible.find((hero) => hero.id === heroId)?.name ?? heroId,
                    ),
                  )}`,
                  description: 'a equipe sugerida',
                  ...(suggestedFit === null ? {} : { detail: suggestedFit.text }),
                  value: SUGGESTED,
                },
              ]
            : []),
          ...(enough
            ? [
                {
                  icon: 'check',
                  label: `Partir com ${names}`,
                  ...(fit === null ? {} : { detail: fit.text }),
                  value: DONE,
                },
              ]
            : []),
          ...remaining.map((hero) => {
            const power = heroFitPower(destination, hero.id);
            return {
              icon: 'person',
              label: `${hero.name} · ${sheetLine(hero)}`,
              description:
                power === null
                  ? `poder ${formatNumber(hero.power)}`
                  : `vale ${formatNumber(power)} contra o primeiro trecho`,
              detail: [...traitLines(hero.traits), hero.equipment.map(slotLine).join(' · ')].join(
                ' ',
              ),
              value: hero.id,
            };
          }),
        ],
      });
      if (picked === undefined) {
        return null;
      }
      if (!sameGame(gameId)) {
        sessionEnded('o envio da expedição');
        return null;
      }
      if (picked === DONE) {
        return chosen;
      }
      if (picked === SUGGESTED) {
        // A sugestão é a da visão de agora: a lista pode ter ficado aberta um bom tempo.
        const now = destinationNow(modelId);
        if (now === undefined || !canSend(now)) {
          continue;
        }
        return defaultTeam(now);
      }
      chosen.push(picked);
    }
  };

  /**
   * "Enviar expedição…": o único caminho do envio (GDD §13.6). O painel já mostrou o destino, a
   * equipe marcada e a Postura, e manda os três; a paleta, a árvore e "Antes de partir"
   * perguntam em listas, uma de cada vez: o destino (com a duração, o risco e o primeiro
   * trecho), a equipe e a Postura (com o que cada uma faz na encruzilhada, na frase do
   * servidor). Depois de cada lista a conta e a visão são lidas de novo: o destino e também a
   * equipe, até a última lista (a da Postura). O envio que o painel já montou segue como veio:
   * quem o recusa é o servidor, com o motivo atualizado.
   */
  const sendExpedition = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const request = sendRequest(arg, view.guild.postures);
      if (
        request.modelId !== undefined &&
        request.heroIds !== undefined &&
        request.posture !== undefined
      ) {
        await controller.sendExpedition(request.modelId, request.heroIds, request.posture);
        return;
      }
      const { guild } = view;
      if (!guild.built || guild.available.length === 0) {
        // Sem a Guilda dos Aventureiros, a frase do servidor diz o que a abre.
        controller.toast({ kind: 'info', text: guild.text, actions: [seeExpeditions] });
        return;
      }
      if (request.modelId !== undefined && destinationNow(request.modelId) === undefined) {
        destinationGone();
        return;
      }
      const gameId = controller.session.gameId;
      let destination = guild.available.find((entry) => entry.modelId === request.modelId);
      if (destination === undefined) {
        if (sendable(guild).length === 0) {
          // Nenhum destino pode partir agora: o motivo é o do servidor, o do primeiro destino.
          const [first] = guild.available;
          controller.toast({
            kind: 'info',
            text: (first === undefined ? null : blockedReason(first)) ?? guild.text,
            actions: [seeExpeditions],
          });
          return;
        }
        destination = await dialogs.pick<Destination>({
          title: 'Enviar expedição',
          placeholder: 'Para onde?',
          detail: [guild.text],
          items: guild.available.map((entry) => {
            const sab = entry.sabotage !== null ? sabotageStatus(entry.sabotage) : null;
            const sabDetail =
              sab === null
                ? null
                : `${sab.attemptsText} ${sab.wavesText}${sab.alertText ? ` ${sab.alertText}` : ''}`;
            return {
              // Cadeado: o destino não pode partir agora, e o detalhe diz por quê.
              icon: canSend(entry) ? 'check' : 'lock',
              label: entry.label,
              description: capitalize(destinationTerms(entry)),
              detail: [
                blockedReason(entry),
                entry.requirementsText,
                entry.firstStretchText,
                sabDetail,
                entry.durationNote === '' ? null : entry.durationNote,
              ]
                .filter((line) => line !== null)
                .join(' '),
              value: entry,
            };
          }),
          selected: Math.max(
            0,
            guild.available.findIndex((entry) => canSend(entry)),
          ),
        });
        if (destination === undefined) {
          return;
        }
        if (!sameGame(gameId)) {
          sessionEnded('o envio da expedição');
          return;
        }
      }
      const { modelId } = destination;
      const heroIds = await pickTeam(modelId, gameId);
      if (heroIds === null) {
        const now = controller.view?.guild;
        const still = destinationNow(modelId);
        if (sameGame(gameId) && now !== undefined && still !== undefined && !canSend(still)) {
          controller.toast({
            kind: 'info',
            text: `"${still.label}": ${blockedReason(still) ?? still.requirementsText}`,
            actions: [seeExpeditions],
          });
        }
        return;
      }
      const postures = controller.view?.guild.postures ?? [];
      const posture = await dialogs.pick<Posture['id']>({
        title: `Enviar expedição: ${destination.label}`,
        placeholder: 'Com que Postura? É ela que decide na encruzilhada, sem a sua palavra.',
        items: postures.map((entry) => ({
          icon: 'compass',
          label: entry.label,
          detail: entry.text,
          value: entry.id,
        })),
        // A do meio já vem marcada: nem a mais segura, nem a mais arriscada.
        selected: Math.max(
          0,
          postures.findIndex((entry) => entry.id === defaultPosture(postures)),
        ),
      });
      if (posture === undefined) {
        return;
      }
      // Depois da espera: a conta e a visão de agora.
      if (!sameGame(gameId)) {
        sessionEnded('o envio da expedição');
        return;
      }
      const still = destinationNow(modelId);
      const guildNow = controller.view?.guild;
      if (still === undefined || guildNow === undefined) {
        destinationGone();
        return;
      }
      // A equipe também é lida de novo: quem a visão de agora já não lista para o destino
      // (partiu em outra aba, feriu-se, foi dispensado) não segue em ordem nenhuma.
      const able = eligibleHeroes(guildNow, still).map((hero) => hero.id);
      const dropped = heroIds.filter((heroId) => !able.includes(heroId));
      if (dropped.length > 0) {
        const names = teamLine(
          dropped.map(
            (heroId) => view.guild.heroes.find((hero) => hero.id === heroId)?.name ?? heroId,
          ),
        );
        controller.toast({
          kind: 'warning',
          text: `${names} já não ${dropped.length === 1 ? 'pode' : 'podem'} partir para "${still.label}": a equipe mudou com a escolha aberta. Nada foi enviado.`,
          actions: [seeExpeditions],
        });
        return;
      }
      await controller.sendExpedition(modelId, heroIds, posture);
    },
    (arg) => sendRequest(arg, []).modelId,
  );

  const itemGone = () =>
    controller.toast({
      kind: 'warning',
      text: 'Este item já não está no arsenal. Nada foi enviado.',
      actions: [
        {
          label: 'Ver o arsenal',
          run: () => controller.runCommand('lords.openPanel', ARSENAL_SECTION),
        },
      ],
    });

  /**
   * "Equipar herói…": o herói recebe um item do arsenal; o espaço é o do item, e o que ele
   * levava nesse espaço volta ao arsenal. O painel manda o herói e o espaço (a lista pergunta o
   * item) ou o item (a lista pergunta o herói); a paleta pergunta os dois. Cada lista diz o que
   * o item soma, na frase do servidor, e o que o herói leva hoje.
   */
  const equipItem = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const request = equipRequest(arg, view.guild.equipmentSlots);
      if (request.heroId !== undefined && request.itemId !== undefined) {
        await controller.equipItem(request.heroId, request.itemId);
        return;
      }
      const { guild } = view;
      if (guild.inventory.length === 0) {
        controller.toast({ kind: 'info', text: guild.inventoryText, actions: [seeGuild] });
        return;
      }
      const heroes = armableHeroes(guild);
      if (heroes.length === 0) {
        controller.toast({
          kind: 'info',
          text:
            guild.heroes.length === 0
              ? guild.text
              : 'Nenhum herói está no feudo agora: quem está fora só troca de equipamento na volta.',
          actions: [seeGuild],
        });
        return;
      }
      const gameId = controller.session.gameId;
      let hero = heroes.find((entry) => entry.id === request.heroId);
      if (request.heroId !== undefined && hero === undefined) {
        heroGone();
        return;
      }
      let item = guild.inventory.find((entry) => entry.id === request.itemId);
      if (request.itemId !== undefined && item === undefined) {
        itemGone();
        return;
      }
      if (item === undefined) {
        const slot = request.slot;
        const candidates =
          slot === undefined
            ? guild.inventory
            : guild.inventory.filter((entry) => entry.slot === slot);
        if (candidates.length === 0) {
          controller.toast({
            kind: 'info',
            text: 'O arsenal não tem item para este espaço.',
            actions: [seeGuild],
          });
          return;
        }
        item = await dialogs.pick<Item>({
          title: hero === undefined ? 'Equipar herói' : `Equipar ${hero.name}`,
          placeholder: 'Qual item do arsenal?',
          detail: [guild.inventoryText],
          items: candidates.map((entry) => ({
            icon: ITEM_ICON,
            label: itemLine(entry),
            description: entry.bonusText,
            detail: entry.text,
            value: entry,
          })),
        });
        if (item === undefined) {
          return;
        }
        if (!sameGame(gameId)) {
          sessionEnded('a troca de equipamento');
          return;
        }
      }
      if (hero === undefined) {
        const chosen = item;
        const now = armableHeroes(controller.view?.guild ?? guild);
        hero =
          now.length === 1
            ? now[0]
            : await dialogs.pick<Hero>({
                title: `Equipar: ${chosen.label}`,
                placeholder: `Quem leva? ${chosen.bonusText}`,
                items: now.map((entry) => {
                  const worn = wornIn(entry, chosen.slot);
                  return {
                    icon: 'person',
                    label: `${entry.name} · ${sheetLine(entry)}`,
                    description: `poder ${formatNumber(entry.power)}`,
                    detail:
                      worn === null
                        ? `${chosen.slotLabel}: vazio.`
                        : `${chosen.slotLabel}: ${worn.label} (${worn.bonusText}), que volta ao arsenal.`,
                    value: entry,
                  };
                }),
              });
        if (hero === undefined) {
          return;
        }
        if (!sameGame(gameId)) {
          sessionEnded('a troca de equipamento');
          return;
        }
      }
      // Depois da espera: o herói e o item de agora.
      if (heroNow(hero.id) === undefined) {
        heroGone();
        return;
      }
      if (controller.view?.guild.inventory.some((entry) => entry.id === item.id) !== true) {
        itemGone();
        return;
      }
      await controller.equipItem(hero.id, item.id);
    },
    (arg) => {
      const request = equipRequest(arg, []);
      return request.heroId ?? request.itemId;
    },
  );

  /**
   * "Desequipar herói…": o item de um espaço volta ao arsenal. O painel manda o herói e o
   * espaço; a paleta pergunta de quem e o quê, em uma lista só (um item por linha).
   */
  const unequipItem = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const request = equipRequest(arg, view.guild.equipmentSlots);
      if (request.heroId !== undefined && request.slot !== undefined) {
        await controller.unequipItem(request.heroId, request.slot);
        return;
      }
      const worn = armableHeroes(view.guild).flatMap((hero) =>
        hero.equipment.flatMap((entry) =>
          entry.item === null ? [] : [{ hero, slot: entry.slot, item: entry.item }],
        ),
      );
      if (worn.length === 0) {
        controller.toast({
          kind: 'info',
          text: 'Nenhum herói no feudo leva item agora.',
          actions: [seeGuild],
        });
        return;
      }
      const gameId = controller.session.gameId;
      const picked = await dialogs.pick<(typeof worn)[number]>({
        title: 'Desequipar herói',
        placeholder: 'O que volta ao arsenal?',
        detail: [view.guild.inventoryText],
        items: worn.map((entry) => ({
          icon: ITEM_ICON,
          label: `${entry.hero.name} · ${entry.item.label}`,
          description: entry.item.bonusText,
          detail: `${entry.item.slotLabel} · ${entry.item.rarityLabel}. ${entry.item.text}`,
          value: entry,
        })),
      });
      if (picked === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a troca de equipamento');
        return;
      }
      if (heroNow(picked.hero.id) === undefined) {
        heroGone();
        return;
      }
      await controller.unequipItem(picked.hero.id, picked.slot);
    },
    (arg) => equipRequest(arg, []).heroId,
  );

  const seeRelics = {
    label: 'Ver a Capela',
    run: () => controller.runCommand('lords.openPanel', RELICS_SECTION),
  };

  const relicNow = (relicId: string) =>
    relicsOf(controller.view ?? { relics: { slots: 0, items: [] } }).items.find(
      (item) => item.relicId === relicId,
    );

  /**
   * Coloca uma relíquia na Capela (`lords.placeRelic`): direto quando o painel ou a árvore já
   * deram a relíquia; por lista na paleta, relendo a visão depois da escolha.
   */
  const placeRelic = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const relics = relicsOf(view);
      const requested = relicRequest(arg);
      if (requested !== undefined) {
        if (relicNow(requested) === undefined) {
          controller.toast({
            kind: 'warning',
            text: 'A relíquia não está mais na lista do feudo: nada foi colocado.',
            actions: [seeRelics],
          });
          return;
        }
        await controller.placeRelic(requested);
        return;
      }
      const candidates = relics.items.filter((item) => !item.placed);
      if (candidates.length === 0) {
        const missing = chapelMissingLine(view, elapsed());
        controller.toast({
          kind: 'info',
          text:
            relics.items.length === 0
              ? (missing ?? 'O feudo ainda não guardou nenhuma relíquia.')
              : 'Todas as relíquias do feudo já estão colocadas na Capela.',
          actions: [seeRelics],
        });
        return;
      }
      const used = placedRelicsCount(relics);
      const missing = chapelMissingLine(view, elapsed());
      const gameId = controller.session.gameId;
      const picked = await dialogs.pick<(typeof candidates)[number]>({
        title: 'Colocar relíquia na Capela',
        placeholder: 'Qual relíquia vai para a Capela?',
        detail: [
          `Espaços na Capela: ${formatNumber(used)}/${formatNumber(relics.slots)}.`,
          ...(missing === null ? [] : [missing]),
        ],
        items: candidates.map((item) => ({
          icon: item.canPlace ? 'check' : 'lock',
          label: item.label,
          description: item.effectText,
          detail: item.blockedReason ?? 'Passa a valer na próxima virada de dia.',
          value: item,
        })),
      });
      if (picked === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a escolha da relíquia');
        return;
      }
      const latest = relicNow(picked.relicId);
      if (latest === undefined || latest.placed) {
        controller.toast({
          kind: 'warning',
          text: 'A Capela mudou enquanto a lista estava aberta: confira as relíquias antes de tentar de novo.',
          actions: [seeRelics],
        });
        return;
      }
      await controller.placeRelic(picked.relicId);
    },
    (arg) => relicRequest(arg),
  );

  /**
   * Retira uma relíquia colocada na Capela (`lords.removeRelic`): direto pelo painel ou pela
   * árvore; por lista na paleta, relendo a visão depois da escolha.
   */
  const removeRelic = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const relics = relicsOf(view);
      const requested = relicRequest(arg);
      if (requested !== undefined) {
        if (relicNow(requested) === undefined) {
          controller.toast({
            kind: 'warning',
            text: 'A relíquia não está mais na lista do feudo: nada foi retirado.',
            actions: [seeRelics],
          });
          return;
        }
        await controller.removeRelic(requested);
        return;
      }
      const placed = relics.items.filter((item) => item.placed);
      if (placed.length === 0) {
        controller.toast({
          kind: 'info',
          text: 'Não há relíquia colocada na Capela agora.',
          actions: [seeRelics],
        });
        return;
      }
      const used = placedRelicsCount(relics);
      const gameId = controller.session.gameId;
      const picked = await dialogs.pick<(typeof placed)[number]>({
        title: 'Retirar relíquia da Capela',
        placeholder: 'Qual relíquia volta a ficar guardada?',
        detail: [`Espaços na Capela: ${formatNumber(used)}/${formatNumber(relics.slots)}.`],
        items: placed.map((item) => ({
          icon: item.active ? 'star-full' : 'watch',
          label: item.label,
          description: item.effectText,
          detail: relicEffectiveLine(item, elapsed()) ?? relicStateBadge(item),
          value: item,
        })),
      });
      if (picked === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a retirada da relíquia');
        return;
      }
      const latest = relicNow(picked.relicId);
      if (latest === undefined || !latest.placed) {
        controller.toast({
          kind: 'warning',
          text: 'A relíquia já não estava na Capela quando você confirmou: nada foi retirado.',
          actions: [seeRelics],
        });
        return;
      }
      await controller.removeRelic(picked.relicId);
    },
    (arg) => relicRequest(arg),
  );

  const seeMap = {
    label: 'Ver o mapa',
    run: () => controller.navigate('map'),
  };

  /**
   * Reivindica um posto avançado (`lords.claimOutpost`, V5F-T3): direto quando a ficha do hexágono
   * já informou a coordenada; por lista de hexágonos elegíveis na paleta, relendo a visão depois
   * da escolha.
   */
  const claimOutpost = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const requested = claimOutpostRequest(arg);
      if (requested !== undefined) {
        await controller.claimOutpost(requested);
        return;
      }
      const candidates = claimableHexes(view.map);
      if (candidates.length === 0) {
        controller.toast({
          kind: 'info',
          text: 'Não há hexágono elegível para reivindicar um posto avançado agora.',
          actions: [seeMap],
        });
        return;
      }
      const gameId = controller.session.gameId;
      const picked = await dialogs.pick<ExploredMapHex>({
        title: 'Reivindicar posto avançado',
        placeholder: 'Em qual hexágono erguer o posto avançado?',
        items: candidates.map((hex) => ({
          icon: TERRAIN_ICONS[hex.terrain],
          label: `${hex.label} (${hex.q}, ${hex.r})`,
          description: hex.terrainLabel,
          detail: hex.detail,
          value: hex,
        })),
      });
      if (picked === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('a reivindicação do posto');
        return;
      }
      const targetKey = hexKey(picked.q, picked.r);
      const stillClaimable =
        controller.view !== null &&
        claimableHexes(controller.view.map).some((hex) => hexKey(hex.q, hex.r) === targetKey);
      if (!stillClaimable) {
        controller.toast({
          kind: 'warning',
          text: 'O mapa mudou enquanto a lista estava aberta: confira os hexágonos antes de tentar de novo.',
          actions: [seeMap],
        });
        return;
      }
      await controller.claimOutpost(targetKey);
    },
    (arg) => claimOutpostRequest(arg),
  );

  /**
   * Repara um posto avançado danificado (`lords.repairOutpost`, V5F-T3): direto quando a ficha, a
   * árvore ou o Relatório de Retorno já deram o `outpostId`; por lista de postos elegíveis na
   * paleta, relendo a visão depois da escolha.
   */
  const repairOutpost = oneAtATime(
    async (arg) => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const requested = repairOutpostRequest(arg);
      if (requested !== undefined) {
        await controller.repairOutpost(requested);
        return;
      }
      const candidates = repairableOutposts(view.map);
      if (candidates.length === 0) {
        const damaged = outpostsOf(view.map).filter((entry) => entry.outpost.status === 'damaged');
        const reason = damaged.length === 1 ? damaged[0]?.outpost.repairBlockedReason : null;
        controller.toast({
          kind: 'info',
          text:
            typeof reason === 'string' && reason !== ''
              ? reason
              : damaged.length > 0
                ? 'Não há posto avançado com reparo liberado agora: confira os recursos na aba Mapa.'
                : 'Não há posto avançado danificado para reparar agora.',
          actions: [seeMap],
        });
        return;
      }
      const gameId = controller.session.gameId;
      const picked = await dialogs.pick<RepairableOutpost>({
        title: 'Reparar posto avançado',
        placeholder: 'Qual posto avançado reparar?',
        items: candidates.map((entry) => ({
          icon: 'tools',
          label: `${entry.hex.label} (${entry.hex.q}, ${entry.hex.r})`,
          description:
            entry.hex.outpost?.repairCost !== undefined && entry.hex.outpost.repairCost.length > 0
              ? `${entry.hex.terrainLabel} · ${formatCost(entry.hex.outpost.repairCost)}`
              : `${entry.hex.terrainLabel} · Danificado`,
          detail: entry.hex.outpost?.detail ?? entry.hex.detail,
          value: entry,
        })),
      });
      if (picked === undefined) {
        return;
      }
      if (!sameGame(gameId)) {
        sessionEnded('o reparo do posto');
        return;
      }
      const stillRepairable =
        controller.view !== null &&
        repairableOutposts(controller.view.map).some(
          (entry) => entry.outpostId === picked.outpostId,
        );
      if (!stillRepairable) {
        controller.toast({
          kind: 'warning',
          text: 'O estado do posto avançado mudou enquanto a lista estava aberta: confira o mapa antes de tentar de novo.',
          actions: [seeMap],
        });
        return;
      }
      await controller.repairOutpost(picked.outpostId);
    },
    (arg) => repairOutpostRequest(arg),
  );

  const seeVows = {
    label: 'Ver os Votos',
    run: () => controller.runCommand('lords.openPanel', VOWS_SECTION),
  };

  /**
   * Firma os Votos do ano (`lords.takeVows`): direto quando o painel já fez a conferência em duas
   * etapas (`confirmed: true`); pela paleta, marca ou desmarca os Votos oferecidos em lista e
   * confirma em segunda etapa com o aviso de irreversibilidade, relendo a visão após cada diálogo.
   */
  const takeVows = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const asked =
      typeof arg === 'object' && arg !== null
        ? (arg as { vows?: unknown; confirmed?: unknown })
        : {};
    const validIds = (raw: unknown): VowId[] | undefined => {
      if (!Array.isArray(raw)) {
        return undefined;
      }
      const offerIds = new Set(vowsOf(controller.view ?? view).offer.map((vow) => vow.id));
      const ids = raw.filter(
        (entry): entry is VowId => typeof entry === 'string' && offerIds.has(entry as VowId),
      );
      return ids.length === raw.length && new Set(ids).size === ids.length ? ids : undefined;
    };
    if (asked.confirmed === true) {
      const ids = validIds(asked.vows);
      if (ids === undefined || !vowsWindowOpen(view, elapsed())) {
        controller.toast({
          kind: 'warning',
          text: 'A janela de Votos mudou ou já fechou: confira os Votos antes de confirmar.',
          actions: [seeVows],
        });
        return;
      }
      await controller.takeVows(ids);
      return;
    }
    if (!vowsWindowOpen(view, elapsed())) {
      const taken = vowsOf(view).taken;
      controller.toast({
        kind: 'info',
        text:
          taken.length > 0
            ? `A janela de Votos deste ano já fechou. Votos ativos: ${taken.map((vow) => vow.label).join(', ')}.`
            : 'A janela de Votos deste ano já está encerrada.',
        actions: [seeVows],
      });
      return;
    }
    const gameId = controller.session.gameId;
    const chosen = new Set<VowId>(validIds(asked.vows) ?? []);
    if (asked.vows === undefined) {
      for (;;) {
        const current = controller.view;
        if (current === null || !vowsWindowOpen(current, elapsed())) {
          controller.toast({
            kind: 'warning',
            text: 'A janela de Votos fechou enquanto a lista estava aberta: nada foi enviado.',
            actions: [seeVows],
          });
          return;
        }
        const offer = vowsOf(current).offer;
        const selectedVows = offer.filter((vow) => chosen.has(vow.id));
        type VowStepChoice = { kind: 'review' } | { kind: 'toggle'; id: VowId };
        const picked = await dialogs.pick<VowStepChoice>({
          title: 'Votos do Ano',
          placeholder: 'Marque os desafios desejados e avance para a conferência',
          detail: [
            `Janela aberta (${vowsDeadlineText(current, elapsed())}). A escolha é única e irreversível no ano; seguir sem nenhum Voto também é uma escolha.`,
          ],
          items: [
            {
              icon: 'check',
              label:
                selectedVows.length === 0
                  ? 'Conferir escolha: nenhum Voto'
                  : `Conferir escolha: ${selectedVows.map((vow) => vow.label).join(', ')}`,
              description: vowsDeadlineText(current, elapsed()),
              detail: 'Avançar para a segunda etapa da conferência.',
              value: { kind: 'review' },
            },
            ...offer.map((vow) => {
              const marked = chosen.has(vow.id);
              return {
                icon: marked ? 'check' : VOW_ICON,
                label: `${marked ? 'Desmarcar' : 'Marcar'}: ${vow.label}`,
                description: vowBonusText(vow),
                detail: vow.description,
                value: { kind: 'toggle' as const, id: vow.id },
              };
            }),
          ],
        });
        if (picked === undefined) {
          return;
        }
        if (!sameGame(gameId)) {
          sessionEnded('a escolha dos Votos');
          return;
        }
        if (picked.kind === 'review') {
          break;
        }
        if (chosen.has(picked.id)) {
          chosen.delete(picked.id);
        } else {
          chosen.add(picked.id);
        }
      }
    }
    const beforeConfirm = controller.view;
    if (beforeConfirm === null || !vowsWindowOpen(beforeConfirm, elapsed())) {
      controller.toast({
        kind: 'warning',
        text: 'A janela de Votos fechou antes da confirmação: nada foi enviado.',
        actions: [seeVows],
      });
      return;
    }
    const offerBefore = vowsOf(beforeConfirm).offer;
    const selectedBefore = offerBefore.filter((vow) => chosen.has(vow.id));
    const sigBefore = vowsReviewSignature(
      offerBefore,
      selectedBefore.map((vow) => vow.id),
    );
    const confirmed = await dialogs.confirm({
      title: 'Confirmar Votos do Ano?',
      detail: [vowsConfirmationText(selectedBefore)],
      confirmLabel: 'Confirmar Votos',
      cancelLabel: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    if (!sameGame(gameId)) {
      sessionEnded('a escolha dos Votos');
      return;
    }
    const afterConfirm = controller.view;
    if (afterConfirm === null || !vowsWindowOpen(afterConfirm, elapsed())) {
      controller.toast({
        kind: 'warning',
        text: 'A janela de Votos fechou enquanto a confirmação estava aberta: nada foi enviado.',
        actions: [seeVows],
      });
      return;
    }
    const offerAfter = vowsOf(afterConfirm).offer;
    const selectedAfter = offerAfter.filter((vow) => chosen.has(vow.id));
    if (
      selectedAfter.length !== selectedBefore.length ||
      vowsReviewSignature(
        offerAfter,
        selectedAfter.map((vow) => vow.id),
      ) !== sigBefore
    ) {
      controller.toast({
        kind: 'warning',
        text: 'A oferta de Votos mudou enquanto a confirmação estava aberta: confira de novo.',
        actions: [seeVows],
      });
      return;
    }
    await controller.takeVows(selectedAfter.map((vow) => vow.id));
  });

  /** "Ver o relatório": a aba Guilda, com a folha dessa expedição aberta e à vista. */
  const openReport = (arg?: unknown) => {
    const expeditionId = typeof arg === 'string' ? arg : expeditionRequest(arg).expeditionId;
    const kept = controller.view?.guild.reports.some(
      (report) => report.expeditionId === expeditionId,
    );
    if (expeditionId === undefined || kept !== true) {
      // O relatório já saiu da lista dos guardados: a linha da Crônica continua valendo sozinha.
      controller.navigate('guild');
      env.reveal(REPORTS_ANCHOR);
      return;
    }
    controller.showReport(expeditionId);
    env.reveal(reportAnchor(expeditionId));
  };

  const renameSettlement = async () => {
    const view = requireView();
    if (view === null) {
      return;
    }
    const name = await dialogs.input({
      title: 'Renomear o feudo',
      prompt: 'De 2 a 24 caracteres.',
      value: view.settlement.name,
      confirmLabel: 'Renomear',
      validate: nameValidation,
    });
    if (name !== undefined && name.trim() !== view.settlement.name) {
      await controller.order('renameSettlement', { name: name.trim() });
    }
  };

  /**
   * Dificuldade, ritmo e cenário do feudo novo, com o padrão do servidor já marcado:
   * `Enter` em cada etapa aceita os padrões. `null` é desistência.
   */
  const chooseNewGame = async (
    options: NewGameOptions,
    legacy: number | null,
  ): Promise<NewGameChoice | null> => {
    const defaults = resolveChoice(options, {}, legacy);
    const difficulty = await dialogs.pick({
      title: 'Nova partida: dificuldade',
      placeholder: 'Fica gravada no feudo e não muda durante o ano.',
      items: options.difficulties.map((option) => ({
        label: difficultyLine(option),
        detail: option.description,
        value: option.id,
      })),
      selected: options.difficulties.findIndex((option) => option.id === defaults.difficulty),
    });
    if (difficulty === undefined) {
      return null;
    }
    const timeScale = await dialogs.pick({
      title: 'Nova partida: ritmo',
      placeholder: 'Fica gravado no feudo e não muda durante o ano.',
      items: options.paces.map((option) => ({
        label: paceLine(option),
        detail: option.hint,
        value: option.timeScale,
      })),
      selected: options.paces.findIndex((option) => option.timeScale === defaults.timeScale),
    });
    if (timeScale === undefined) {
      return null;
    }
    const scenarios = options.scenarios;
    if (scenarios === undefined || scenarios.length === 0) {
      return { difficulty, timeScale };
    }
    const scenario = await dialogs.pick({
      title: 'Nova partida: cenário',
      placeholder: 'Fica gravado no feudo e não muda durante o ano.',
      items: scenarios.map((option) => {
        const locked = isScenarioLocked(option, legacy);
        const reason = scenarioLockedText(option, legacy);
        return {
          ...(locked ? { icon: 'lock', disabled: true } : {}),
          label: scenarioLine(option),
          detail: reason === null ? option.description : `${option.description} ${reason}`,
          value: option.id,
        };
      }),
      selected: Math.max(
        0,
        scenarios.findIndex((option) => option.id === defaults.scenario),
      ),
    });
    return scenario === undefined ? null : { difficulty, timeScale, scenario };
  };

  const seedValidation = (value: string): Validation | null => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    return GameSeedSchema.safeParse(trimmed).success
      ? null
      : { message: 'Até 64 caracteres, sem caracteres de controle.', severity: 'error' };
  };

  const parseNewGameArg = (arg: unknown): { seed: string | null; askSeed: boolean } => {
    if (typeof arg === 'string') {
      const parsed = GameSeedSchema.safeParse(arg);
      return { seed: parsed.success ? parsed.data : null, askSeed: false };
    }
    if (typeof arg === 'object' && arg !== null) {
      const record = arg as { seed?: unknown; askSeed?: unknown };
      const parsed = typeof record.seed === 'string' ? GameSeedSchema.safeParse(record.seed) : null;
      return {
        seed: parsed?.success ? parsed.data : null,
        askSeed: record.askSeed === true,
      };
    }
    return { seed: null, askSeed: false };
  };

  const askAndStartNewGame = async (arg?: unknown) => {
    const { seed: initialSeed, askSeed } = parseNewGameArg(arg);
    // Uma função, para o compilador não supor que a conta é a mesma depois de uma espera.
    const accountNow = () => controller.account.state;
    if (accountNow().kind === 'signedOut') {
      if (initialSeed !== null || askSeed) {
        controller.setPendingSeed(initialSeed, true);
      }
      controller.navigate('welcome');
      return;
    }
    // As opções e o Legado vêm do servidor. Sem catálogo (sem ligação, servidor anterior), nada é
    // perguntado e o feudo nasce com os padrões dele, como na v0.1.
    await Promise.all([controller.loadCatalog(), controller.loadStats(true)]);
    // A conta é lida depois da espera: a sessão pode ter terminado, ou outra aba pode ter
    // fundado ou arquivado o feudo, enquanto as opções não chegavam.
    const state = accountNow();
    if (state.kind === 'signedOut') {
      if (initialSeed !== null || askSeed) {
        controller.setPendingSeed(initialSeed, true);
      }
      controller.navigate('welcome');
      return;
    }
    let chosenSeed: string | undefined = initialSeed ?? undefined;
    if (askSeed) {
      const typedSeed = await dialogs.input({
        title: 'Nova partida: semente',
        prompt: 'Semente da partida (opcional). Deixe em branco para sortear uma nova.',
        value: chosenSeed ?? '',
        confirmLabel: 'Continuar',
        validate: seedValidation,
      });
      if (typedSeed === undefined) {
        return;
      }
      const trimmed = typedSeed.trim();
      chosenSeed = trimmed === '' ? undefined : trimmed;
    }
    const options = controller.newGameOptions;
    const choice =
      options === null ? undefined : await chooseNewGame(options, controller.accountLegacy);
    if (choice === null) {
      return;
    }
    if (state.gameId !== null) {
      const confirmed = await dialogs.confirm({
        title: 'Começar uma nova partida?',
        detail: [
          'O feudo atual é arquivado e não pode mais receber ordens.',
          ...(options === null || choice === undefined
            ? []
            : [
                `O novo feudo nasce assim: ${choiceSummary(options, choice)}. ${choice.scenario === undefined ? 'Os dois' : 'As escolhas'} não mudam durante o ano.`,
              ]),
          ...(chosenSeed === undefined ? [] : [`Semente: ${chosenSeed}.`]),
        ],
        confirmLabel: 'Começar outro feudo',
      });
      if (!confirmed) {
        return;
      }
    }
    const settlementName = await dialogs.input({
      title: 'Nova partida',
      prompt: 'Nome do feudo, de 2 a 24 caracteres.',
      value: 'Pedra Alta',
      confirmLabel: 'Fundar o feudo',
      validate: nameValidation,
    });
    if (settlementName !== undefined) {
      await controller.attempt(async () => {
        await controller.startNewGame(settlementName, choice, chosenSeed);
        controller.navigate('fief');
      });
    }
  };

  /**
   * Um fluxo de nova partida por vez. Enquanto as opções não chegam do servidor não há diálogo
   * na tela, e nada impede um segundo acionamento (duplo clique, ou um clique a mais porque
   * "não aconteceu nada"): sem esta trava, dois fluxos se intercalariam na fila de diálogos e
   * o segundo feudo fundado arquivaria o primeiro.
   */
  let startingNewGame = false;
  const newGame = async (arg?: unknown) => {
    if (startingNewGame) {
      return;
    }
    startingNewGame = true;
    try {
      await askAndStartNewGame(arg);
    } finally {
      startingNewGame = false;
    }
  };

  const downloadChronicle = () =>
    controller.attempt(async () => {
      const view = requireView();
      if (view === null) {
        return;
      }
      const markdown = await controller.loadChronicle();
      if (markdown === null) {
        const failure = controller.chronicleDocument;
        throw new Error(
          failure.status === 'error' ? failure.message : 'A Crônica não pôde ser lida agora.',
        );
      }
      const slug = view.settlement.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      // O arquivo é o texto limpo: as marcas de expedição só servem à aba Crônica.
      env.download(`cronica-${slug || 'feudo'}.md`, stripChronicleLinks(markdown));
    });

  const downloadYearChronicle = oneAtATime(async (arg) => {
    const view = requireView();
    if (view === null) return;
    const years = view.calendar.completedYears ?? [];
    if (years.length === 0) {
      controller.toast({ kind: 'info', text: 'Ainda não há anos encerrados para ler.' });
      return;
    }
    const gameId = controller.session.gameId;
    const year =
      typeof arg === 'number'
        ? arg
        : (controller.selectedChronicleYear ??
          (await dialogs.pick<number>({
            title: 'Baixar a Crônica do Ano',
            placeholder: 'Escolha o ano',
            items: years.map((year) => ({
              label: `Ano ${year}`,
              value: year,
            })),
          })));
    if (
      year === undefined ||
      !sameGame(gameId) ||
      !Number.isSafeInteger(year) ||
      !(controller.view?.calendar.completedYears ?? []).includes(year)
    )
      return;
    const markdown = await controller.loadYearChronicle(year);
    if (!sameGame(gameId)) return;
    if (markdown === null) {
      const failure = controller.yearChronicleDocument;
      if (controller.selectedChronicleYear === year && failure.status === 'error') {
        controller.toast({
          kind: 'warning',
          text: failure.message,
          actions: [{ label: 'Ver a Crônica', run: () => controller.navigate('chronicle') }],
        });
      }
      return;
    }
    const slug = view.settlement.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    env.download(`cronica-${slug || 'feudo'}-ano-${year}.md`, stripChronicleLinks(markdown));
  });

  // --- Conta ---------------------------------------------------------------------

  const chooseConflict = (details: AccountConflictDetails): Promise<ConflictChoice | undefined> =>
    dialogs.pick<ConflictChoice>({
      title: 'Este GitHub já está vinculado a outro feudo',
      placeholder: 'Qual feudo manter? Os dois nunca são misturados.',
      items: conflictOptions(details).map((option) => ({
        label: option.label,
        detail: option.description,
        value: option.choice,
      })),
    });

  const github = () =>
    controller.attempt(async () => {
      if (!controller.githubAvailable) {
        controller.toast({
          kind: 'info',
          text: 'O vínculo com o GitHub não está ligado neste servidor. Use o Código do Reino para continuar em outro navegador.',
        });
        return;
      }
      const wasSignedIn = signedIn();
      const start = await controller.client.startGithubDevice();
      const host = new URL(start.verificationUri).host;
      const handle = dialogs.info({
        title: wasSignedIn ? 'Vincular ao GitHub' : 'Entrar com GitHub',
        paragraphs: [
          'Copie o código abaixo, abra a página do GitHub e cole o código lá. Depois volte: esta página percebe sozinha quando você confirmar.',
          'O jogo só pede ao GitHub a sua identificação. O token passa pelo servidor a caminho da validação e não é guardado.',
        ],
        code: start.userCode,
        link: { href: start.verificationUri, label: `Abrir ${host}` },
        status: 'Aguardando a confirmação no GitHub…',
        closeLabel: 'Cancelar',
      });
      let outcome;
      try {
        outcome = await awaitGithubAuthorization(controller.client, start, {
          sleep: env.sleep,
          now: () => controller.now(),
          cancelled: () => !handle.isOpen(),
        });
      } finally {
        handle.close();
      }
      if (outcome.kind === 'cancelled') {
        return;
      }
      if (outcome.kind !== 'authorized') {
        controller.toast({
          kind: 'warning',
          text:
            outcome.kind === 'expired'
              ? 'O código do GitHub venceu antes da confirmação. Comece de novo para receber outro.'
              : 'O GitHub informou que a autorização foi recusada. Nada mudou na sua conta.',
        });
        return;
      }
      const token = outcome.githubAccessToken;
      const state = await controller.whileBusy(() =>
        controller.account.signInOrLinkGithub(token, chooseConflict),
      );
      if (state !== null) {
        controller.toast({
          kind: 'info',
          text: wasSignedIn
            ? `Conta de ${state.displayName} vinculada ao GitHub. Seu feudo acompanha você em qualquer navegador.`
            : `Bem-vindo de volta, ${state.displayName}.`,
        });
      }
    });

  const generateRecoveryCode = () =>
    controller.attempt(async () => {
      const state = controller.account.state;
      if (state.kind === 'signedOut') {
        return;
      }
      if (state.hasRecoveryCode) {
        const confirmed = await dialogs.confirm({
          title: 'Gerar um Código do Reino novo?',
          detail: ['Você já tem um Código do Reino. Gerar outro invalida o anterior.'],
          confirmLabel: 'Gerar um código novo',
        });
        if (!confirmed) {
          return;
        }
      }
      const code = await controller.account.generateRecoveryCode();
      await dialogs.info({
        title: 'Código do Reino',
        paragraphs: [
          'Guarde em lugar seguro. Ele aparece só desta vez: quem o digitar em outro navegador assume este feudo.',
        ],
        code,
        closeLabel: 'Já guardei',
      }).closed;
    });

  const signInRecoveryCode = async () => {
    const code = await dialogs.input({
      title: 'Entrar com Código do Reino',
      prompt: 'Digite o código gerado no outro navegador.',
      placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
      confirmLabel: 'Entrar',
      validate: (value) => {
        const problem = validateRecoveryCode(value);
        return problem === null ? null : { message: problem, severity: 'error' };
      },
    });
    if (code !== undefined) {
      await controller.attempt(async () => {
        await controller.whileBusy(() => controller.account.signInWithRecoveryCode(code));
      });
    }
  };

  const signOut = async () => {
    const state = controller.account.state;
    if (state.kind === 'signedOut') {
      return;
    }
    const warning =
      state.kind === 'anonymous' && !state.hasRecoveryCode
        ? 'Esta conta é anônima e não tem Código do Reino: ao sair deste navegador, você não poderá mais voltar a este feudo.'
        : 'Você poderá voltar com o GitHub ou com o Código do Reino.';
    const confirmed = await dialogs.confirm({
      title: 'Sair desta máquina?',
      detail: [warning],
      confirmLabel: 'Sair desta máquina',
    });
    if (confirmed) {
      await controller.attempt(() => controller.signOut());
    }
  };

  const deleteAccount = async () => {
    if (controller.account.state.kind === 'signedOut') {
      return;
    }
    const settlement = controller.view?.settlement.name;
    const confirmed = await dialogs.confirm({
      title: 'Excluir a conta e o feudo?',
      detail: [
        'A conta é bloqueada na hora e não pode ser recuperada.',
        'Os dados são removidos do servidor depois de sete dias; cópias de segurança podem guardá-los por até 14 dias após serem geradas.',
      ],
      confirmLabel: 'Excluir a conta',
    });
    if (!confirmed) {
      return;
    }
    if (settlement !== undefined) {
      const typed = await dialogs.input({
        title: 'Confirme a exclusão',
        prompt: `Digite o nome do feudo (${settlement}) para confirmar.`,
        confirmLabel: 'Excluir para sempre',
        validate: (value) =>
          value.trim() === settlement
            ? null
            : { message: 'O nome não confere com o do feudo.', severity: 'error' },
      });
      if (typed === undefined) {
        return;
      }
    }
    await controller.attempt(async () => {
      await controller.deleteAccount();
      controller.toast({
        kind: 'info',
        text: `Conta excluída. ${settlement ?? 'O feudo'} volta ao silêncio.`,
      });
    });
  };

  // --- Geral ---------------------------------------------------------------------

  const go = (route: Route) => () => controller.navigate(route);

  const toggleDiscreetMode = async () => {
    const next = !controller.preferences.discreetMode;
    await controller.setPreferences({ discreetMode: next });
    if (!next) {
      controller.toast({ kind: 'info', text: 'Modo discreto desligado.' });
    }
  };

  const muteNotifications = async () => {
    await controller.muteNotifications();
    controller.toast({ kind: 'info', text: 'Notificações do feudo silenciadas por 2 horas.' });
  };

  const toggleTheme = async () => {
    const theme = nextTheme(env.currentTheme());
    await controller.setPreferences({ theme });
    controller.toast({ kind: 'info', text: `Tema: ${THEME_LABELS[theme]}.` });
  };

  const privacy = () => {
    dialogs.info({
      title: 'Lords of the Guild: privacidade',
      paragraphs: PRIVACY_PARAGRAPHS,
      closeLabel: 'Entendi',
    });
  };

  const anonymous = () => controller.account.state.kind === 'anonymous';
  const hidden = (id: string, run: AppCommand['run']): AppCommand => ({
    id,
    title: id,
    palette: false,
    run,
  });

  return [
    {
      id: 'lords.goToFief',
      title: 'Ir para o Feudo',
      palette: true,
      when: hasGame,
      run: go('fief'),
    },
    {
      id: 'lords.goToToday',
      title: 'Ir para Hoje',
      palette: true,
      when: hasGame,
      run: go('today'),
    },
    {
      id: 'lords.playNow',
      title: 'Jogar agora',
      palette: true,
      when: () => !hasGame(),
      run: go('welcome'),
    },
    {
      id: 'lords.allocateWorkers',
      title: 'Alocar trabalhadores',
      palette: true,
      when: hasGame,
      run: allocate,
    },
    {
      id: 'lords.build',
      title: 'Construir ou melhorar',
      palette: true,
      when: hasGame,
      run: build,
    },
    {
      id: 'lords.cancelConstruction',
      title: 'Cancelar a obra em andamento',
      palette: true,
      when: hasGame,
      run: cancelConstruction,
    },
    {
      id: 'lords.planConstruction',
      title: 'Planejar obras',
      palette: true,
      when: hasGame,
      run: planConstruction,
    },
    {
      id: 'lords.toggleAutoStart',
      title: 'Planejadas: ligar ou desligar o início automático',
      palette: true,
      when: hasGame,
      run: toggleAutoStart,
    },
    { id: 'lords.recruit', title: 'Recrutar aldeões', palette: true, when: hasGame, run: recruit },
    {
      id: 'lords.answerCard',
      title: 'Decidir carta do Conselho',
      palette: true,
      when: hasGame,
      run: answerCard,
    },
    {
      id: 'lords.openCouncil',
      title: 'Ir para o Conselho',
      palette: true,
      when: hasGame,
      run: go('council'),
    },
    {
      id: 'lords.openGuild',
      title: 'Ir para a Guilda',
      palette: true,
      when: hasGame,
      run: go('guild'),
    },
    {
      id: 'lords.openMarket',
      title: 'Ir para o Mercado',
      palette: true,
      when: hasGame,
      run: go('market'),
    },
    {
      id: 'lords.openArmy',
      title: 'Ir para o Exército',
      palette: true,
      when: hasGame,
      run: go('army'),
    },
    {
      id: 'lords.openMap',
      title: 'Ir para o Mapa',
      palette: true,
      when: hasGame,
      run: go('map'),
    },
    {
      id: 'lords.claimOutpost',
      title: 'Reivindicar posto avançado…',
      palette: true,
      when: hasGame,
      run: claimOutpost,
    },
    {
      id: 'lords.repairOutpost',
      title: 'Reparar posto avançado…',
      palette: true,
      when: hasGame,
      run: repairOutpost,
    },
    {
      id: 'lords.trainSoldiers',
      title: 'Treinar soldados…',
      palette: true,
      when: hasGame,
      run: trainSoldiers,
    },
    {
      id: 'lords.cancelTraining',
      title: 'Cancelar o treino…',
      palette: true,
      when: hasGame,
      run: cancelTraining,
    },
    {
      id: 'lords.disbandSoldiers',
      title: 'Dispensar soldados…',
      palette: true,
      when: hasGame,
      run: disbandSoldiers,
    },
    {
      id: 'lords.saveFormation',
      title: 'Salvar formação',
      palette: false,
      when: hasGame,
      run: saveFormation,
    },
    {
      id: 'lords.setActiveFormation',
      title: 'Ativar formação como Defesa…',
      palette: true,
      when: hasGame,
      run: setActiveFormation,
    },
    {
      id: 'lords.simulateBattle',
      title: 'Simular defesa do feudo…',
      palette: true,
      when: hasGame,
      run: simulateBattle,
    },
    {
      id: 'lords.attackCamp',
      title: 'Atacar o Acampamento…',
      palette: true,
      when: hasGame,
      run: attackCamp,
    },
    {
      id: 'lords.deleteFormation',
      title: 'Apagar formação…',
      palette: true,
      when: hasGame,
      run: deleteFormation,
    },
    {
      id: 'lords.forgeWeapons',
      title: 'Forjar armas…',
      palette: true,
      when: hasGame,
      run: forgeWeapons,
    },
    {
      id: 'lords.cancelForge',
      title: 'Cancelar a forja…',
      palette: true,
      when: hasGame,
      run: cancelForge,
    },
    {
      id: 'lords.repairWall',
      title: 'Reparar a muralha…',
      palette: true,
      when: hasGame,
      run: repairWall,
    },
    {
      id: 'lords.setBattlePlan',
      title: 'Salvar Plano de Batalha por onda…',
      palette: true,
      when: hasGame,
      run: setBattlePlan,
    },
    {
      id: 'lords.swapWaveFormation',
      title: 'Trocar formação entre ondas…',
      palette: true,
      when: hasGame,
      run: swapWaveFormation,
    },
    {
      id: 'lords.emergencyRepair',
      title: 'Reparar a muralha entre ondas…',
      palette: true,
      when: hasGame,
      run: emergencyRepair,
    },
    {
      id: 'lords.callMilitia',
      title: 'Convocar milícia…',
      palette: true,
      when: hasGame,
      run: callMilitia,
    },
    {
      id: 'lords.repairItem',
      title: 'Reparar um item…',
      palette: true,
      when: hasGame,
      run: repairItem,
    },
    {
      id: 'lords.trade',
      title: 'Comprar ou vender no Mercado…',
      palette: true,
      when: hasGame,
      run: trade,
    },
    {
      id: 'lords.sendCaravan',
      title: 'Mandar uma caravana…',
      palette: true,
      when: hasGame,
      run: sendCaravan,
    },
    {
      id: 'lords.assignMaster',
      title: 'Mover Mestre…',
      palette: true,
      when: hasGame,
      run: assignMaster,
    },
    {
      id: 'lords.hireHero',
      title: 'Contratar herói…',
      palette: true,
      when: hasGame,
      run: hireHero,
    },
    {
      id: 'lords.dismissHero',
      title: 'Dispensar herói…',
      palette: true,
      when: hasGame,
      run: dismissHero,
    },
    {
      id: 'lords.holdFestival',
      title: 'Dar um festival na Taverna',
      palette: true,
      when: hasGame,
      run: holdFestival,
    },
    {
      id: 'lords.sendExpedition',
      title: 'Enviar expedição…',
      palette: true,
      when: hasGame,
      run: sendExpedition,
    },
    {
      id: 'lords.chooseExpeditionPath',
      title: 'Escolher caminho da expedição…',
      palette: true,
      when: hasGame,
      run: chooseExpeditionPath,
    },
    {
      id: 'lords.equipItem',
      title: 'Equipar herói…',
      palette: true,
      when: hasGame,
      run: equipItem,
    },
    {
      id: 'lords.unequipItem',
      title: 'Desequipar herói…',
      palette: true,
      when: hasGame,
      run: unequipItem,
    },
    {
      id: 'lords.placeRelic',
      title: 'Colocar relíquia na Capela…',
      palette: true,
      when: hasGame,
      run: placeRelic,
    },
    {
      id: 'lords.removeRelic',
      title: 'Retirar relíquia da Capela…',
      palette: true,
      when: hasGame,
      run: removeRelic,
    },
    {
      id: 'lords.takeVows',
      title: 'Firmar Votos do ano…',
      palette: true,
      when: hasGame,
      run: takeVows,
    },
    {
      id: 'lords.renameSettlement',
      title: 'Renomear o feudo',
      palette: true,
      when: hasGame,
      run: renameSettlement,
    },
    { id: 'lords.newGame', title: 'Nova partida', palette: true, when: signedIn, run: newGame },
    {
      id: 'lords.openChronicle',
      title: 'Abrir a Crônica',
      palette: true,
      when: hasGame,
      run: go('chronicle'),
    },
    {
      id: 'lords.downloadChronicle',
      title: 'Baixar Crônica (Markdown)',
      palette: true,
      when: hasGame,
      run: async () => {
        await downloadChronicle();
      },
    },
    {
      id: 'lords.downloadYearChronicle',
      title: 'Baixar a Crônica do Ano',
      palette: true,
      when: hasGame,
      run: downloadYearChronicle,
    },
    {
      id: 'lords.selectChronicleYear',
      palette: false,
      title: 'Escolher ano da Crônica',
      run: async (arg) => {
        if (
          arg === null ||
          (typeof arg === 'number' &&
            Number.isSafeInteger(arg) &&
            (controller.view?.calendar.completedYears ?? []).includes(arg))
        )
          await controller.selectChronicleYear(arg);
      },
    },
    {
      id: 'lords.markRead',
      title: 'Marcar o Relatório de Retorno como lido',
      palette: true,
      when: () => controller.report !== null,
      run: () => controller.markSeen(),
    },
    {
      id: 'lords.refresh',
      title: 'Atualizar agora',
      palette: true,
      when: hasGame,
      run: async () => {
        await controller.attempt(() => controller.session.syncNow());
      },
    },
    {
      id: 'lords.toggleDiscreetMode',
      title: 'Ligar ou desligar o modo discreto',
      palette: true,
      run: toggleDiscreetMode,
    },
    {
      id: 'lords.muteNotifications',
      title: 'Silenciar notificações por 2 horas',
      palette: true,
      run: muteNotifications,
    },
    { id: 'lords.toggleTheme', title: 'Trocar tema', palette: true, run: toggleTheme },
    {
      id: 'lords.linkGithub',
      title: 'Conta: vincular ao GitHub',
      palette: true,
      when: () => anonymous() && controller.githubAvailable,
      run: async () => {
        await github();
      },
    },
    {
      id: 'lords.signInGithub',
      title: 'Conta: entrar com GitHub',
      palette: true,
      when: () => signedOut() && controller.githubAvailable,
      run: async () => {
        await github();
      },
    },
    {
      id: 'lords.generateRecoveryCode',
      title: 'Conta: gerar Código do Reino',
      palette: true,
      when: signedIn,
      run: async () => {
        await generateRecoveryCode();
      },
    },
    {
      id: 'lords.signInRecoveryCode',
      title: 'Conta: entrar com Código do Reino',
      palette: true,
      when: signedOut,
      run: signInRecoveryCode,
    },
    {
      id: 'lords.signOut',
      title: 'Conta: sair desta máquina',
      palette: true,
      when: signedIn,
      run: signOut,
    },
    {
      id: 'lords.deleteAccount',
      title: 'Conta: excluir conta',
      palette: true,
      when: signedIn,
      run: deleteAccount,
    },
    { id: 'lords.privacy', title: 'Privacidade', palette: true, run: privacy },
    { id: 'lords.openSettings', title: 'Preferências', palette: true, run: go('settings') },
    {
      id: 'lords.openNews',
      title: 'Novidades',
      palette: true,
      run: () => {
        controller.navigate('news');
        env.reveal('news-title');
      },
    },
    { id: 'lords.about', title: 'Sobre', palette: true, run: go('about') },
    {
      id: 'lords.openKingdom',
      title: 'Reino: estatísticas e ranking de ouro',
      palette: true,
      when: signedIn,
      run: go('kingdom'),
    },
    // Usados pela árvore, pela barra de status e pelos avisos; não aparecem na paleta.
    hidden('lords.openPanel', (arg) => {
      if (arg === VOWS_SECTION && controller.view !== null && !isYearTurnVows(controller.view)) {
        controller.navigate('army');
        env.reveal(VOWS_ANCHOR);
        return;
      }
      const section = typeof arg === 'string' ? SECTIONS[arg] : undefined;
      if (section !== undefined) {
        // Uma seção de uma aba: a aba abre, e a página e o foco vão até a seção.
        controller.navigate(section.route);
        env.reveal(section.anchor);
        return;
      }
      controller.navigate(
        arg === 'today' ||
          arg === 'fief' ||
          arg === 'council' ||
          arg === 'guild' ||
          arg === 'market' ||
          arg === 'army' ||
          arg === 'map' ||
          arg === 'chronicle'
          ? arg
          : controller.defaultRoute(),
      );
    }),
    hidden('lords.openReport', openReport),
    hidden('lords.refreshKingdom', () => controller.loadStats(true)),

    hidden('lords.openBattleReport', (arg) => {
      const reports = controller.view?.army.reports ?? [];
      const kept = typeof arg === 'string' && reports.some((report) => report.id === arg);
      controller.navigate('army');
      env.reveal(
        kept ? battleReportAnchor(arg) : reports.length > 0 ? BATTLE_REPORTS_ANCHOR : ARMY_ANCHOR,
      );
    }),
    hidden('lords.workersIncrease', step(1)),
    hidden('lords.workersDecrease', step(-1)),
    hidden('lords.showCommands', () => env.openPalette()),
    hidden('lords.reload', () => env.reload()),
  ];
}

/** Liga os comandos ao controlador: `controller.runCommand(id, arg)` passa a funcionar. */
export function bindCommands(controller: Controller, commands: AppCommand[]): void {
  const byId = new Map(commands.map((command) => [command.id, command]));
  const failed = (error: unknown) => {
    controller.toast({
      kind: 'error',
      text: error instanceof Error ? error.message : String(error),
    });
  };
  controller.runCommand = (id, arg) => {
    // O comando roda na hora (navegar é imediato). Uma falha, síncrona ou não, vira aviso.
    try {
      void Promise.resolve(byId.get(id)?.run(arg)).catch(failed);
    } catch (error) {
      failed(error);
    }
  };
}

/** Os comandos que a paleta mostra agora, já com o prefixo. */
export function paletteItems(commands: AppCommand[]): PickItem<AppCommand>[] {
  return commands
    .filter((command) => command.palette && (command.when?.() ?? true))
    .map((command) => ({ label: `${PALETTE_PREFIX}${command.title}`, value: command }));
}
