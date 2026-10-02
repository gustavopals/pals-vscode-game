import { RESOURCE_IDS } from '@lotg/content';
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
    }),
  ),
  counts: z.strictObject({
    daysPassed: z.number().int().nonnegative(),
    constructionsFinished: z.number().int().nonnegative(),
    villagersArrived: z.number().int().nonnegative(),
    objectivesCompleted: z.number().int().nonnegative(),
  }),
  famine: z.enum(['none', 'started', 'ended', 'ongoing']),
  /** Frases da Crônica dos fatos notáveis, da mais antiga para a mais nova. */
  highlights: z.array(z.string()),
});
export type ReturnReport = z.infer<typeof ReturnReportSchema>;
