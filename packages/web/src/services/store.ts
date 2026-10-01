/**
 * Armazenamento de chave e valor que os serviços usam. No navegador é o `localStorage`
 * (`browserStore.ts`); nos testes, a memória. Declarar só isto permite testá-los sem navegador.
 */
export type KeyValueStore = {
  keys(): readonly string[];
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
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
        // Como o armazenamento do navegador: guarda uma cópia serializável, não a referência.
        data[key] = JSON.parse(JSON.stringify(value));
      }
    },
  };
}

/** Emissor de eventos mínimo, sem depender de nada da plataforma. */
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
