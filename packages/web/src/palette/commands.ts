import { type AccountConflictDetails, DisplayNameSchema, type ViewState } from '@lotg/protocol';

import { awaitGithubAuthorization } from '../account/githubDevice';
import { type ConflictChoice, conflictOptions } from '../account/githubLink';
import { validateRecoveryCode } from '../account/recoveryCode';
import type { Controller } from '../app/controller';
import type { Dialogs, PickItem, Validation } from '../app/dialogs';
import type { Route } from '../app/router';
import {
  choiceSummary,
  difficultyLine,
  type NewGameChoice,
  type NewGameOptions,
  paceLine,
  resolveChoice,
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
  formatCost,
  formatDuration,
  formatNumber,
  formatRemaining,
  planWaiting,
  refundSentence,
  remainingNow,
  upgradeName,
} from '../ui/format';
import type { TreeNode } from '../ui/treeModel';
import { allocationMessage, nextWorkerGain, workersCount } from '../ui/workers';

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
/** O id da linha "Ameaça" da árvore: o botão dela ordena a obra da Torre de Vigia. */
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
  // mais rende em cada edifício, agora e depois da adaptação.
  const pickWorker = (view: ViewState) =>
    dialogs.pick<WorkerRow>({
      title: 'Alocar trabalhadores',
      placeholder: `${view.population.free} ${view.population.free === 1 ? 'aldeão livre' : 'aldeões livres'}. ${view.workersRules.adaptationText}`,
      items: view.workers.map((row) => ({
        label: `${row.label} Nv${row.level}`,
        description: [
          `${workersCount(row.assigned)} · ${formatNumber(row.grossPerHour)}/h`,
          row.adapting > 0 ? `${row.adapting} em adaptação` : null,
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
    // Vindo da linha "Ameaça" da árvore, a obra é a da Torre de Vigia: é o que tira a névoa.
    const requested =
      (arg as TreeNode | undefined)?.id === THREAT_NODE
        ? view.threat.watchtower.building
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
   * Dificuldade e ritmo do feudo novo, em duas listas com o padrão do servidor já marcado:
   * `Enter`, `Enter` aceita os dois. `null` é desistência.
   */
  const chooseNewGame = async (options: NewGameOptions): Promise<NewGameChoice | null> => {
    const defaults = resolveChoice(options);
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
    return timeScale === undefined ? null : { difficulty, timeScale };
  };

  const askAndStartNewGame = async () => {
    // Uma função, para o compilador não supor que a conta é a mesma depois de uma espera.
    const accountNow = () => controller.account.state;
    if (accountNow().kind === 'signedOut') {
      controller.navigate('welcome');
      return;
    }
    // As opções vêm do servidor. Sem elas (sem ligação, servidor de uma versão anterior), nada é
    // perguntado e o feudo nasce com os padrões dele, como na v0.1.
    await controller.loadCatalog();
    // A conta é lida depois da espera: a sessão pode ter terminado, ou outra aba pode ter
    // fundado ou arquivado o feudo, enquanto as opções não chegavam.
    const state = accountNow();
    if (state.kind === 'signedOut') {
      controller.navigate('welcome');
      return;
    }
    const options = controller.newGameOptions;
    const choice = options === null ? undefined : await chooseNewGame(options);
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
                `O novo feudo nasce assim: ${choiceSummary(options, choice)}. Os dois não mudam durante o ano.`,
              ]),
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
        await controller.startNewGame(settlementName, choice);
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
  const newGame = async () => {
    if (startingNewGame) {
      return;
    }
    startingNewGame = true;
    try {
      await askAndStartNewGame();
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
      env.download(`cronica-${slug || 'feudo'}.md`, markdown);
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
    { id: 'lords.about', title: 'Sobre', palette: true, run: go('about') },
    // Usados pela árvore, pela barra de status e pelos avisos; não aparecem na paleta.
    hidden('lords.openPanel', (arg) => {
      controller.navigate(
        arg === 'today' || arg === 'fief' || arg === 'council' ? arg : controller.defaultRoute(),
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
