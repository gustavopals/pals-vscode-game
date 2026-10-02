import { Emitter } from '../services/store';

/** Resultado da validação de um campo: um erro impede confirmar; uma informação, não. */
export type Validation = { message: string; severity: 'error' | 'info' };

export type PickItem<T> = {
  label: string;
  /** Texto curto ao lado do rótulo. */
  description?: string;
  /** Linha de detalhe abaixo do rótulo. */
  detail?: string;
  /** Nome de um codicon. */
  icon?: string;
  value: T;
};

export type ConfirmOptions = {
  title: string;
  detail?: string[];
  confirmLabel: string;
  cancelLabel?: string;
};

export type InputOptions = {
  title: string;
  prompt?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Chamada a cada tecla. */
  validate?: (value: string) => Validation | null;
};

export type PickOptions<T> = {
  title: string;
  placeholder?: string;
  items: PickItem<T>[];
  /**
   * Posição do item que já vem marcado (o padrão de uma escolha): `Enter` sem mexer em nada o
   * escolhe. Sem isto, o primeiro.
   */
  selected?: number;
  /**
   * O que ler antes de escolher, em parágrafos, acima do campo de busca: a situação de uma carta
   * do Conselho, com o prazo e o que acontece sem resposta.
   */
  detail?: string[];
  /**
   * Fecha a lista sozinha, como desistência, quando o sinal dispara: o que ela oferecia deixou
   * de existir com ela aberta (a carta expirou, ou foi respondida em outra aba).
   */
  signal?: AbortSignal;
};

export type InfoOptions = {
  title: string;
  paragraphs: string[];
  /** Um texto para copiar (Código do Reino, código do GitHub), com o botão "Copiar". */
  code?: string;
  link?: { href: string; label: string };
  /** Linha de andamento, anunciada a leitores de tela quando muda. */
  status?: string;
  closeLabel?: string;
};

export type DialogState =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'input' } & InputOptions)
  | ({ kind: 'pick' } & PickOptions<unknown>)
  | ({ kind: 'info' } & InfoOptions);

type Entry = { id: number; state: DialogState; resolve: (value: unknown) => void };

export type InfoHandle = {
  /** Troca partes do diálogo enquanto ele está aberto. */
  update(patch: Partial<InfoOptions>): void;
  close(): void;
  /** Resolve quando o diálogo fecha, pelo jogador ou por `close()`. */
  closed: Promise<void>;
  isOpen(): boolean;
};

/** O que os comandos precisam para conversar com o jogador. Os testes usam um substituto. */
export type Dialogs = {
  confirm(options: ConfirmOptions): Promise<boolean>;
  input(options: InputOptions): Promise<string | undefined>;
  pick<T>(options: PickOptions<T>): Promise<T | undefined>;
  info(options: InfoOptions): InfoHandle;
};

/**
 * Os diálogos do app, um de cada vez, em fila. Aqui fica só o estado; quem desenha é
 * `DialogHost.tsx`, que chama `resolve` com a resposta do jogador.
 */
export class DialogService implements Dialogs {
  private queue: Entry[] = [];
  private nextId = 1;
  private readonly changes = new Emitter<void>();
  readonly onChange = this.changes.on;

  /** O diálogo à vista, ou `null`. */
  get current(): { id: number; state: DialogState } | null {
    const entry = this.queue[0];
    return entry === undefined ? null : { id: entry.id, state: entry.state };
  }

  private open<T>(state: DialogState): { id: number; result: Promise<T> } {
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise<T>((resolve) => {
      this.queue.push({ id, state, resolve: resolve as (value: unknown) => void });
    });
    this.changes.emit();
    return { id, result };
  }

  /** Fecha um diálogo com a resposta dada. `undefined` é desistência. */
  resolve(id: number, value: unknown): void {
    const index = this.queue.findIndex((entry) => entry.id === id);
    const entry = this.queue[index];
    if (entry === undefined) {
      return;
    }
    this.queue.splice(index, 1);
    entry.resolve(value);
    this.changes.emit();
  }

  /** `Esc` ou clique fora: desiste do diálogo à vista. */
  cancel(): void {
    const entry = this.queue[0];
    if (entry !== undefined) {
      this.resolve(entry.id, undefined);
    }
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return (await this.open<boolean | undefined>({ kind: 'confirm', ...options }).result) === true;
  }

  input(options: InputOptions): Promise<string | undefined> {
    return this.open<string | undefined>({ kind: 'input', ...options }).result;
  }

  pick<T>(options: PickOptions<T>): Promise<T | undefined> {
    const { signal } = options;
    if (signal?.aborted === true) {
      return Promise.resolve(undefined);
    }
    const { id, result } = this.open<T | undefined>({ kind: 'pick', ...options } as DialogState);
    // Fechar um diálogo que já fechou não faz nada: o sinal pode disparar depois da escolha.
    signal?.addEventListener('abort', () => this.resolve(id, undefined), { once: true });
    return result;
  }

  info(options: InfoOptions): InfoHandle {
    const { id, result } = this.open<unknown>({ kind: 'info', ...options });
    let open = true;
    const closed = result.then(() => {
      open = false;
    });
    return {
      closed,
      isOpen: () => open,
      close: () => this.resolve(id, undefined),
      update: (patch) => {
        const entry = this.queue.find((candidate) => candidate.id === id);
        if (entry !== undefined && entry.state.kind === 'info') {
          entry.state = { ...entry.state, ...patch };
          this.changes.emit();
        }
      },
    };
  }
}

/** Índice do próximo elemento focável ao apertar `Tab` dentro de um diálogo (foco preso). */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) {
    return -1;
  }
  if (current < 0) {
    return backwards ? count - 1 : 0;
  }
  return (current + (backwards ? count - 1 : 1)) % count;
}

/** Filtra uma lista de escolha pelo texto digitado: todas as palavras precisam aparecer. */
export function filterItems<T>(items: PickItem<T>[], query: string): PickItem<T>[] {
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return items;
  }
  return items.filter((item) => {
    const haystack = fold(`${item.label} ${item.description ?? ''} ${item.detail ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Índice selecionado em uma lista depois de uma tecla de navegação. */
export function moveSelection(count: number, current: number, key: string): number {
  if (count === 0) {
    return -1;
  }
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'PageDown':
      return Math.min(count - 1, current + 8);
    case 'PageUp':
      return Math.max(0, current - 8);
    default:
      return Math.min(Math.max(current, 0), count - 1);
  }
}
