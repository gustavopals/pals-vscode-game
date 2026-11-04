import { trainForSiege, siegeTrainingPolicy } from './siegePreparation';
import { economicoPolicies, preparedFor } from './economico';
import { erguerFerreiro, forjarArmas } from './policies';
import { montarFormacao } from './policies';
import { prepararFinta } from './finta';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot militar (V4C-T1.8; GDD §15.3, ADR 0019 decisão 25): o econômico que, além da política
 * mínima de guerra que já vem nele (erguer o Quartel e treinar Lanceiros e Arqueiros), **ergue
 * o Ferreiro** depois do Quartel, **forja** com o ferro que houver e treina também Espadachins
 * com as armas forjadas. A cada visita o lote é o que o ferro, as armas e a comida permitem
 * (`army.offer` e o saldo da comida na visão).
 *
 * **Monta uma formação com o que tem e a ativa** (V4C-T2; `montarFormacao`), sem comandante: desde
 * a V4E-T2.7 a política vem do econômico, logo depois do treino.
 * Na V4E-T3, usa uma isca de arqueiros em incursão forte visível do outono e volta à
 * defesa no inverno. Na V4G-T2.10, herda o Plano e a resposta entre ondas. **Não tem faixa de balanceamento** (a rodada padrão
 * continua com os três perfis do econômico); roda a pedido (`--strategy militar`,
 * `--matrix --profile militar`), como o `ousado`. Como todo bot, só lê o `ViewState`.
 */
export const militarPolicies: readonly Policy[] = [
  erguerFerreiro,
  forjarArmas,
  ...economicoPolicies.map((policy) =>
    policy === trainForSiege
      ? siegeTrainingPolicy(['swordsman', 'spearman', 'archer'])
      : policy === montarFormacao
        ? prepararFinta
        : policy,
  ),
];

export const militar = botOf(militarPolicies);

/** O militar de quem volta em `awayHours` horas reais. */
export function militarFor(awayHours: number): Bot {
  return botOf(preparedFor(militarPolicies, awayHours));
}
