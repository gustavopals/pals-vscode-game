import { MORALE_BAND_IDS, RESOURCE_IDS } from '@lotg/content';
import { z } from 'zod';

/**
 * Relatório de Retorno: o que aconteceu enquanto o jogador esteve fora (GDD §2.3). É montado
 * pelo cliente, a partir da visão guardada, da visão atual e dos eventos da ausência.
 */
export const ReturnReportSchema = z.strictObject({
  awaySeconds: z.number().int().nonnegative(),
  /**
   * Diferença de estoque entre a última visita e agora, em unidades. Vazia quando o cliente não
   * tem a visão da última visita para comparar (o cache era de outra versão do app).
   */
  resources: z.array(
    z.strictObject({
      id: z.enum(RESOURCE_IDS),
      label: z.string(),
      before: z.number(),
      after: z.number(),
      delta: z.number(),
      /**
       * A variação de estoque separada pelo que os eventos da ausência contam, em unidades: o
       * que foi pago em obras e recrutamento (`spent_<recurso>`), o que entrou por recompensa e
       * devolução (`gained_<recurso>`), o que não coube no depósito e se perdeu
       * (`wasted_<recurso>`, do evento `storageWasted`) e o saldo da produção e do consumo, que
       * é a variação menos o recebido mais o gasto. Opcionais: quem monta o relatório os
       * preenche quando tem os eventos; nenhum é calculado com regra de jogo.
       */
      spent: z.number().optional(),
      received: z.number().optional(),
      wasted: z.number().optional(),
      produced: z.number().optional(),
      /**
       * A parte das recompensas e devoluções que não coube no depósito (`lost_<recurso>`, nos
       * eventos do próprio ganho). Não está em `received`, que é só o que entrou, e **está** em
       * `wasted`: é o que diz, dentro do perdido, o que não foi produção. Opcional, como os
       * outros.
       */
      cut: z.number().optional(),
    }),
  ),
  counts: z.strictObject({
    daysPassed: z.number().int().nonnegative(),
    constructionsFinished: z.number().int().nonnegative(),
    villagersArrived: z.number().int().nonnegative(),
    objectivesCompleted: z.number().int().nonnegative(),
    /**
     * A população que a moral e a fome moveram, pelos eventos da ausência: colonos que
     * chegaram sozinhos (`villagerArrived`), aldeões que partiram com a moral baixa
     * (`villagerLeft`) e os que desertaram na fome longa (`villagerDeserted`). Opcionais: quem
     * monta o relatório os preenche quando conhece esses eventos. `villagersArrived`, acima,
     * continua sendo o dos recrutados.
     */
    settlersArrived: z.number().int().nonnegative().optional(),
    villagersLeft: z.number().int().nonnegative().optional(),
    villagersDeserted: z.number().int().nonnegative().optional(),
  }),
  /**
   * A moral na volta (a da visão atual) e a da última visita, quando o cliente a tem: o
   * Relatório diz a faixa em que o feudo está e se ela mudou. Opcional, como as contagens.
   */
  morale: z
    .strictObject({
      value: z.number(),
      band: z.enum(MORALE_BAND_IDS),
      bandLabel: z.string(),
      before: z
        .strictObject({ value: z.number(), band: z.enum(MORALE_BAND_IDS), bandLabel: z.string() })
        .optional(),
    })
    .optional(),
  famine: z.enum(['none', 'started', 'ended', 'ongoing']),
  /** Frases da Crônica dos fatos notáveis, da mais antiga para a mais nova. */
  highlights: z.array(z.string()),
});
export type ReturnReport = z.infer<typeof ReturnReportSchema>;
