/**
 * Guardas de forma para o JSON de um estado gravado, escritas à mão: o motor não tem zod.
 *
 * Uma guarda recebe o valor e o caminho dele dentro do estado e devolve a primeira coisa fora do
 * lugar, ou `null` se está tudo certo. A mensagem cita o caminho e o tipo encontrado, **nunca o
 * valor**: ela vai para o log do servidor, e o estado tem o nome que o jogador deu ao feudo.
 */
export type Shape = (value: unknown, path: string) => string | null;

function kindOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'lista';
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? 'inteiro' : 'número não inteiro';
  }
  const names: Record<string, string> = {
    string: 'texto',
    boolean: 'booleano',
    object: 'objeto',
    undefined: 'nada',
  };
  return names[typeof value] ?? typeof value;
}

const problem = (path: string, expected: string, value: unknown) =>
  `${path === '' ? 'estado' : path}: esperado ${expected}, veio ${kindOf(value)}`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const join = (path: string, key: string | number) => (path === '' ? String(key) : `${path}.${key}`);

/** Inteiro com sinal: acumuladores podem ficar negativos. */
export const integer: Shape = (value, path) =>
  Number.isSafeInteger(value) ? null : problem(path, 'inteiro', value);

/** Inteiro a partir de zero: estoques, níveis, contagens e instantes. */
export const natural: Shape = (value, path) =>
  Number.isSafeInteger(value) && (value as number) >= 0
    ? null
    : problem(path, 'inteiro a partir de zero', value);

/** Número finito maior que zero; o único não inteiro do estado é o ritmo da partida. */
export const positiveNumber: Shape = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? null
    : problem(path, 'número maior que zero', value);

export const text: Shape = (value, path) =>
  typeof value === 'string' ? null : problem(path, 'texto', value);

export const boolean: Shape = (value, path) =>
  typeof value === 'boolean' ? null : problem(path, 'booleano', value);

/** Exatamente um valor. */
export function literal(expected: string | number | boolean | null): Shape {
  return (value, path) =>
    value === expected ? null : problem(path, `o valor fixo ${JSON.stringify(expected)}`, value);
}

/** Um texto de uma lista fechada de identificadores. */
export function oneOf(allowed: readonly string[]): Shape {
  return (value, path) =>
    typeof value === 'string' && allowed.includes(value)
      ? null
      : problem(path, `um de ${allowed.join(', ')}`, value);
}

export function nullable(shape: Shape): Shape {
  return (value, path) => (value === null ? null : shape(value, path));
}

export function listOf(item: Shape): Shape {
  return (value, path) => {
    if (!Array.isArray(value)) {
      return problem(path, 'lista', value);
    }
    for (let index = 0; index < value.length; index += 1) {
      const found = item(value[index], join(path, index));
      if (found !== null) {
        return found;
      }
    }
    return null;
  };
}

/** Lista com exatamente `length` itens: as filas de obras, que são sempre as mesmas posições. */
export function listOfLength(length: number, item: Shape): Shape {
  const list = listOf(item);
  return (value, path) =>
    Array.isArray(value) && value.length !== length
      ? `${path === '' ? 'estado' : path}: esperada lista de ${length} itens, veio de ${value.length}`
      : list(value, path);
}

/** Objeto com chaves livres e valores de uma forma só (`stats`, `rng`). */
export function recordOf(item: Shape): Shape {
  return (value, path) => {
    if (!isPlainObject(value)) {
      return problem(path, 'objeto', value);
    }
    for (const key of Object.keys(value)) {
      const found = item(value[key], join(path, key));
      if (found !== null) {
        return found;
      }
    }
    return null;
  };
}

/**
 * Objeto com **exatamente** estas chaves. Uma chave a mais é erro tanto quanto uma a menos: o
 * estado de cada versão só foi escrito por uma versão do motor, então o que sobra é corrupção
 * ou um estado de outra versão com o número errado.
 */
export function exactObject(fields: Readonly<Record<string, Shape>>): Shape {
  const known = Object.keys(fields);
  return (value, path) => {
    if (!isPlainObject(value)) {
      return problem(path, 'objeto', value);
    }
    for (const key of known) {
      if (!Object.hasOwn(value, key)) {
        return `${join(path, key)}: campo ausente`;
      }
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(fields, key)) {
        return `${join(path, key)}: campo desconhecido`;
      }
    }
    for (const key of known) {
      const found = (fields[key] as Shape)(value[key], join(path, key));
      if (found !== null) {
        return found;
      }
    }
    return null;
  };
}
