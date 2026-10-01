/**
 * O mínimo do `Memento` do VS Code (`globalState`) que os serviços usam. Declarar só isto
 * permite testá-los sem o editor.
 */
export type KeyValueStore = {
  keys(): readonly string[];
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
};

/** O mínimo do `SecretStorage` do VS Code. */
export type SecretStore = {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
};

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore & {
  data: Record<string, unknown>;
} {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    keys: () => Object.keys(data),
    get: <T>(key: string) => data[key] as T | undefined,
    update: async (key, value) => {
      if (value === undefined) {
        delete data[key];
      } else {
        // Como o globalState: guarda uma cópia serializável, não a referência.
        data[key] = JSON.parse(JSON.stringify(value));
      }
    },
  };
}

export function memorySecrets(): SecretStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key),
    store: async (key, value) => {
      data.set(key, value);
    },
    delete: async (key) => {
      data.delete(key);
    },
  };
}

/** Emissor de eventos mínimo, para os serviços não dependerem do `EventEmitter` do VS Code. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  on = (listener: (value: T) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }
}
