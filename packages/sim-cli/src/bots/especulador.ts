import { economicoPolicies, preparedFor } from './economico';
import { especular, mandarCaravana, venderExcedente } from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot especulador (revisão da Fase E, R6): o econômico que, em vez de mandar o excedente a Porto
 * do Rio e de vendê-lo no balcão, **compra no balcão para revender por caravana** (`especular`).
 *
 * Existe para a matriz medir duas coisas que os outros bots não tentam: a **arbitragem do mesmo
 * dia** (comprar madeira ou pedra e enviar na mesma visita), que tem de dar prejuízo desde que a
 * caravana paga menos do que a compra cobra (resposta do autor de 2026-10-07); e a **especulação
 * sazonal** da comida (comprar no verão, enviar no outono e no inverno), que o GDD §5.9 chama de
 * intencional e limitada. **Não tem faixa de balanceamento**: roda a pedido (`--strategy
 * especulador`, `--matrix --profile especulador`), como o `ousado`. Como todo bot, só lê o
 * `ViewState`.
 */
export const especuladorPolicies: readonly Policy[] = economicoPolicies.flatMap((policy) =>
  policy === mandarCaravana ? [especular] : policy === venderExcedente ? [] : [policy],
);

export const especulador = botOf(especuladorPolicies);

/** O especulador de quem volta em `awayHours` horas reais. */
export function especuladorFor(awayHours: number): Bot {
  return botOf(preparedFor(especuladorPolicies, awayHours));
}
