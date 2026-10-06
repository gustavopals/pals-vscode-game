import { preparedFor } from './economico';
import { guildPolicies } from './explorador';
import { enviarExpedicoesOusado, escolherTodoCaminho } from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot ousado (revisão da Fase D, M-R2): o explorador que arrisca. Cuida do feudo, ergue a
 * Guilda, contrata, dá festival e equipa como ele; muda **como envia e como responde**:
 *
 * - **enviar expedições (ousado)**: manda o Resgate quando há alguém em cativeiro, faz a
 *   Patrulha até ela revelar um caminho novo e, no resto, vai ao destino mais rico em que a
 *   equipe fica **entre o risco e a folga**, alternando as três Posturas;
 * - **escolher todo caminho**: responde a toda encruzilhada que encontra na visita.
 *
 * Existe para a matriz medir o que o explorador, sempre com folga e sempre na Equilibrada, nunca
 * vê: o Desastre, a captura, a morte em Rei de Ferro, o Resgate e a equipe que não volta. **Não
 * tem faixa de balanceamento**: roda a pedido (`--strategy ousado`, `--matrix --profile ousado`
 * e `--expeditions`), como o explorador começou. Como todo bot, só lê o `ViewState`.
 */
export const ousadoPolicies: readonly Policy[] = guildPolicies(
  escolherTodoCaminho,
  enviarExpedicoesOusado,
);

export const ousado = botOf(ousadoPolicies);

/** O ousado de quem volta em `awayHours` horas reais. */
export function ousadoFor(awayHours: number): Bot {
  return botOf(preparedFor(ousadoPolicies, awayHours));
}
