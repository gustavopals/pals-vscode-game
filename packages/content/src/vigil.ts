/** Hora da Vigília (GDD §4.3; ADR 0019, decisões 12 e 13). */
export const vigilRules = {
  minimumDelayMs: 6 * 3_600_000,
  fallbackDelayMs: 12 * 3_600_000,
  windowMs: 24 * 3_600_000,
} as const;

export const vigilTexts = {
  about:
    'A Hora da Vigília vale para os acontecimentos ainda não marcados. Os já anunciados mantêm o horário. O deslocamento do fuso fica fixo até você mudar a preferência, sem ajuste de horário de verão.',
  unresolved:
    'Não foi possível resolver este fuso. A Vigília usa UTC (deslocamento zero); escolha um fuso válido nas Preferências.',
};
