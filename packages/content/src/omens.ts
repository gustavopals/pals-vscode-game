import type { HordeUnitId } from './ids';

/**
 * As frases dos presságios (GDD §11.1 e Apêndice E; ADR 0020, decisão 18). **Rascunho que o
 * autor não leu** (pendência D-24). Um presságio só diz verdade sobre a onda que será gerada:
 * por isso a frase vaga é escolhida pelo inimigo que domina a onda, e nunca fala de números.
 */
export const omenTexts = {
  /** Nível 1 da Torre: "muitas feras" e semelhantes; uma frase por inimigo dominante. */
  vague: {
    wolf: 'Corvos voam do norte em bandos: a Horda trará muitas feras.',
    raider: 'Fogueiras demais acendem nas colinas: a Horda trará muitos saqueadores.',
    banditArcher: 'Os pastores acham flechas cravadas nas cercas: a Horda trará muitos arqueiros.',
    blackKnight: 'A terra treme ao anoitecer: a Horda trará muitos cavaleiros.',
    ogre: 'Árvores tombam sem machado na serra: a Horda trará gigantes.',
    skeleton: 'Os cães uivam para o cemitério: a Horda trará os mortos.',
    shaman: 'Cantos estranhos descem dos morros: a Horda trará feitiçaria.',
    warlord: 'Um estandarte negro foi visto além do rio: a Horda terá um chefe.',
    troll: 'Pegadas fundas cercam as pontes partidas: a Horda trará muitos trolls.',
  } satisfies Record<HordeUnitId, string>,
  /** Nível 3: `{contagem}`, `{inimigo}` (plural), `{ala}` (com preposição) e `{onda}`. */
  partial:
    'Os vigias contam cerca de {contagem} {inimigo} rumando para o vale, {ala}, na {onda} noite.',
  /** Nível 5: `{onda}` e `{composicao}`. */
  exact: 'Um desertor desenha no chão, para a {onda} onda: {composicao}.',
  post: '{contagem} {inimigo} {linha} {ala}',
  lines: { front: 'na frente', back: 'na retaguarda' },
  /** Os ordinais das ondas, no feminino. */
  waves: { 1: 'primeira', 2: 'segunda', 3: 'terceira' },
  /** Por onde a onda entra. */
  wings: { left: 'pela ala esquerda', center: 'pelo centro', right: 'pela ala direita' },
} as const;
