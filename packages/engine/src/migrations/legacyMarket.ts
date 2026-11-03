import type { StoredState } from './step';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * As trilhas v39/v40 nasceram antes da correção intradiária do Mercado da base.
 * Só a entrada desses passos admite a variante sem fromMs. Conserva o prazo
 * publicado e adota a fronteira como início, tal como o passo 36 → 37.
 * A guarda do estado atual continua exigindo o campo; retratos e hashes não mudam.
 */
export function legacyMarketEffects(value: unknown): unknown {
  if (!object(value) || !object(value.market) || !Array.isArray(value.market.effects)) return value;
  return {
    ...value,
    market: {
      ...value.market,
      effects: value.market.effects.map((effect) =>
        object(effect) && !Object.hasOwn(effect, 'fromMs')
          ? { ...effect, fromMs: value.lastProcessedAt }
          : effect,
      ),
    },
  };
}
