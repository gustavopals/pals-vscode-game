import { economicoPolicies, preparedFor } from './economico';
import { erguerFerreiro, forjarArmas, treinarMinimo, treinarSoldados } from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot militar (V4C-T1.8; GDD §15.3, ADR 0019 decisão 25): o econômico que, além da política
 * mínima de guerra que já vem nele (erguer o Quartel e treinar Lanceiros e Arqueiros), **ergue
 * o Ferreiro** depois do Quartel, **forja** com o ferro que houver e treina também Espadachins
 * com as armas forjadas. A cada visita o lote é o que o ferro, as armas e a comida permitem
 * (`army.offer` e o saldo da comida na visão).
 *
 * Ainda não há formação, Plano, finta, sabotagem nem milícia: entram com a V4C-T2 e as fases
 * seguintes, e este bot as ganha então. **Não tem faixa de balanceamento** (a rodada padrão
 * continua com os três perfis do econômico); roda a pedido (`--strategy militar`,
 * `--matrix --profile militar`), como o `ousado`. Como todo bot, só lê o `ViewState`.
 */
export const militarPolicies: readonly Policy[] = [
  erguerFerreiro,
  forjarArmas,
  ...economicoPolicies.map((policy) =>
    policy === treinarMinimo ? treinarSoldados(['swordsman', 'spearman', 'archer']) : policy,
  ),
];

export const militar = botOf(militarPolicies);

/** O militar de quem volta em `awayHours` horas reais. */
export function militarFor(awayHours: number): Bot {
  return botOf(preparedFor(militarPolicies, awayHours));
}
