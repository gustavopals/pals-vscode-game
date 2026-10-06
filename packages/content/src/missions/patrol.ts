import type { ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Patrulha dos Arredores" (GDD §9.3; ADR 0018, decisão 12): 15 minutos de jogo, dois nós, um
 * herói, risco baixo. É a primeira jornada de todo feudo: sem encruzilhada, uma prova e a volta.
 * Do Sucesso em diante acha o caminho das Ruínas de Vel'Thar (com um Rastreador, também no
 * Revés).
 *
 * **As três variantes pedem coisas diferentes**, e é isso que a Patrulha ensina: a ronda pelas
 * cercas é de braço (Guerreiro), o vau é de perícia (Arqueiro) e a estrada velha, de vontade
 * (Mago). Um Guerreiro de nível 1 passa em mais de nove de cada dez (ADR 0017); um Clérigo
 * sozinho, em metade. Ninguém chega ao Desastre aqui.
 *
 * **É a porta de entrada, não a mina de ouro** (revisão da Fase D, B10): rende umas poucas
 * moedas e quase nenhuma experiência, de propósito. Por hora de herói fica abaixo de todos os outros destinos
 * (o teste da calibragem confere); o que ela dá de único é a segurança e o caminho das Ruínas.
 *
 * A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A volta ao portão',
  durationMs: 5 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a patrulha de {feudo} tomou o caminho de casa.',
};

export const patrol: ExpeditionModelDef = {
  id: 'patrol',
  label: 'Patrulha dos Arredores',
  riskLabel: 'Baixo',
  durationMs: 15 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 1, teamMax: 1, minHeroLevel: 1, classes: [] },
  access: { kind: 'open' },
  variants: [
    {
      start: 'fences',
      nodes: {
        fences: {
          kind: 'encounter',
          title: 'A ronda pelas cercas',
          durationMs: 10 * MINUTE_MS,
          trial: {
            difficulty: 36,
            xp: 2,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria feito os ladrões largarem a bolsa só de chegar perto.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} deu a volta nas cercas de {feudo} e pôs dois ladrões de galinha para correr. A bolsa deles ficou no chão.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} deu a volta nas cercas de {feudo} e recolheu o que os ladrões deixaram cair na fuga.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} chegou tarde às cercas de {feudo}: os ladrões já iam longe, e só ficou parte do que levavam.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} caiu na emboscada dos ladrões junto às cercas de {feudo} e voltou sem nada.',
            },
          },
          rewards: { resources: { gold: { min: 1, max: 3 } }, reveals: 'ruins' },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'ford',
      nodes: {
        ford: {
          kind: 'hazard',
          title: 'O vau do riacho',
          durationMs: 10 * MINUTE_MS,
          trial: {
            difficulty: 40,
            xp: 2,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria lido a correnteza antes de pôr o pé na água.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} atravessou o vau de pé enxuto e achou, na outra margem, umas moedas da carga que a enchente tirou de um mascate.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} atravessou o vau e recolheu o que a enchente tinha deixado na margem.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} escorregou no vau, e o riacho levou metade do que já estava recolhido.',
              disaster:
                'No {dia}º dia {daEstacao}, a correnteza derrubou {heroi} no meio do vau, e o riacho ficou com tudo.',
            },
          },
          rewards: { resources: { gold: { min: 1, max: 2 } }, reveals: 'ruins' },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'oldRoad',
      nodes: {
        oldRoad: {
          kind: 'encounter',
          title: 'Rastros na estrada velha',
          durationMs: 10 * MINUTE_MS,
          trial: {
            difficulty: 42,
            xp: 2,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'mage',
            lesson: 'Um Mago não teria perdido o rastro quando a luz baixou e o medo subiu.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} seguiu os rastros da estrada velha, sem se deixar enganar, até um acampamento vazio. Uma bolsa esquecida ainda estava lá.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} seguiu os rastros da estrada velha e voltou com o que os salteadores esqueceram.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} perdeu os rastros da estrada velha ao cair da tarde e trouxe pouco.',
              disaster:
                'No {dia}º dia {daEstacao}, os rastros da estrada velha levaram {heroi} direto a quem os tinha deixado. Não sobrou nada para trazer.',
            },
          },
          rewards: { resources: { gold: { min: 2, max: 3 } }, reveals: 'ruins' },
          next: 'home',
        },
        home,
      },
    },
  ],
};
