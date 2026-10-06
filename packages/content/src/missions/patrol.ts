import type { ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Patrulha dos Arredores" (GDD §9.3; ADR 0018, decisão 12): 15 minutos de jogo, dois nós, um
 * herói, risco baixo. **Grafo provisório de V3D-T1**: três variantes mínimas, sem encruzilhada,
 * para a máquina das expedições ter um percurso curto de ponta a ponta. A dificuldade fica em
 * volta de 30, a que o ADR 0017 recomenda para um herói de nível 1 sozinho. Do Sucesso em
 * diante a patrulha acha o caminho das Ruínas de Vel'Thar (com um Rastreador, também no Revés;
 * V3D-T2). Os textos são de V3D-T3. Rascunho que o autor não leu.
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
            difficulty: 30,
            xp: 12,
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a patrulha de {feudo} deu a volta nas cercas e pôs para correr dois ladrões de galinha, que largaram a bolsa.',
              success:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} deu a volta nas cercas e achou o que os ladrões deixaram cair na fuga.',
              setback:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} chegou tarde às cercas: os ladrões já iam longe, e só ficou parte do que levavam.',
              disaster:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} caiu na emboscada dos ladrões junto às cercas e voltou sem nada.',
            },
          },
          rewards: { resources: { gold: { min: 15, max: 25 } }, reveals: 'ruins' },
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
            difficulty: 28,
            xp: 12,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a patrulha de {feudo} atravessou o vau de pé enxuto e achou na outra margem a carga de um mascate afogado.',
              success:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} atravessou o vau e recolheu o que a enchente tinha deixado na margem.',
              setback:
                'No {dia}º dia {daEstacao}, o riacho levou metade do que a patrulha de {feudo} tinha recolhido no vau.',
              disaster:
                'No {dia}º dia {daEstacao}, a correnteza derrubou a patrulha de {feudo} no vau, e o riacho ficou com tudo.',
            },
          },
          rewards: { resources: { gold: { min: 12, max: 22 } }, reveals: 'ruins' },
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
            difficulty: 32,
            xp: 12,
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a patrulha de {feudo} seguiu os rastros da estrada velha até um acampamento vazio, com o cofre ainda lá.',
              success:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} seguiu os rastros da estrada velha e voltou com o que os salteadores esqueceram.',
              setback:
                'No {dia}º dia {daEstacao}, a patrulha de {feudo} perdeu os rastros na estrada velha e trouxe pouco.',
              disaster:
                'No {dia}º dia {daEstacao}, os rastros da estrada velha levaram a patrulha de {feudo} a quem os tinha deixado. Voltou de mãos vazias.',
            },
          },
          rewards: { resources: { gold: { min: 18, max: 28 } }, reveals: 'ruins' },
          next: 'home',
        },
        home,
      },
    },
  ],
};
