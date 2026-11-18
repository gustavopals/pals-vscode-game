import type { ExpeditionModelDef } from '../expeditions';

/** Expedição especial aprovada em §6.5; grafo proposto em §6.6 e pendência H-11. */
export const whiteWolfHunt: ExpeditionModelDef = {
  id: 'whiteWolfHunt',
  label: 'A caçada do Lobo Branco',
  riskLabel: 'Médio',
  durationMs: 7200000,
  requires: {
    guildLevel: 1,
    teamMin: 1,
    teamMax: 2,
    minHeroLevel: 1,
    classes: [],
  },
  access: {
    kind: 'council',
  },
  variants: [
    {
      start: 'tracks',
      nodes: {
        tracks: {
          kind: 'hazard',
          title: 'As pegadas no leito seco',
          durationMs: 2700000,
          trial: {
            difficulty: 48,
            xp: 20,
            weights: {
              skill: {
                num: 1,
                den: 1,
              },
            },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria lido as pegadas antes que a neve as apagasse.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} seguiu as pegadas pelo leito seco e encontrou a passagem para o bosque fechado. A equipe de {feudo} avançou sem perder tempo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} seguiu as pegadas pelo leito seco e encontrou a passagem para o bosque fechado. O bosque não deu outro sinal.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro entre as pedras do leito seco. A equipe de {feudo} procurou até escurecer.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro entre as pedras do leito seco. A equipe de {feudo} abriu caminho entre os espinhos sem saber onde pisava.',
            },
          },
          rewards: {
            resources: {
              food: {
                min: 10,
                max: 15,
              },
            },
          },
          next: 'whiteWolf',
        },
        whiteWolf: {
          kind: 'encounter',
          title: 'O lobo na clareira',
          durationMs: 2700000,
          trial: {
            difficulty: 44,
            xp: 30,
            weights: {
              skill: {
                num: 1,
                den: 2,
              },
            },
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria sustentado a linha quando o lobo avançou.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco na clareira e desferiu o golpe antes do salto. A fera caiu na neve sem erguer a cabeça.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco na clareira e sustentou a linha até o golpe final. O bosque ficou quieto.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco na clareira, mas a fera rompeu a linha. A equipe de {feudo} deixou a clareira antes que escurecesse.',
              disaster:
                'No {dia}º dia {daEstacao}, o Lobo Branco saltou sobre a linha de {heroi} e desapareceu no bosque. A equipe de {feudo} recuou antes que a fera voltasse.',
            },
          },
          rewards: { relic: { from: ['wolfBone'], consolationGold: 100 } },
          next: 'home',
        },
        home: {
          kind: 'return',
          title: 'A volta pela orla do bosque',
          durationMs: 1800000,
          text: 'No {dia}º dia {daEstacao}, a equipe da caçada voltou a {feudo} pela orla do bosque. O que aconteceu entre as árvores ficou no relato de quem foi.',
        },
      },
    },
    {
      start: 'tracks',
      nodes: {
        tracks: {
          kind: 'hazard',
          title: 'O rastro entre os pinheiros',
          durationMs: 2700000,
          trial: {
            difficulty: 49,
            xp: 20,
            weights: {
              skill: {
                num: 1,
                den: 1,
              },
            },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria lido as pegadas antes que a neve as apagasse.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} leu as marcas entre os pinheiros e encontrou a passagem para o bosque fechado. A equipe de {feudo} avançou sem perder tempo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} leu as marcas entre os pinheiros e encontrou a passagem para o bosque fechado. O bosque não deu outro sinal.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro sob as agulhas dos pinheiros. A equipe de {feudo} procurou até escurecer.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro sob as agulhas dos pinheiros. A equipe de {feudo} abriu caminho entre os espinhos sem saber onde pisava.',
            },
          },
          rewards: {
            resources: {
              food: {
                min: 10,
                max: 15,
              },
            },
          },
          next: 'whiteWolf',
        },
        whiteWolf: {
          kind: 'encounter',
          title: 'O lobo junto ao rochedo',
          durationMs: 2700000,
          trial: {
            difficulty: 43,
            xp: 30,
            weights: {
              skill: {
                num: 1,
                den: 2,
              },
            },
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria sustentado a linha quando o lobo avançou.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco junto ao rochedo e desferiu o golpe antes do salto. A fera caiu na neve sem erguer a cabeça.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco junto ao rochedo e sustentou a linha até o golpe final. O bosque ficou quieto.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco junto ao rochedo, mas a fera rompeu a linha. A equipe de {feudo} deixou a clareira antes que escurecesse.',
              disaster:
                'No {dia}º dia {daEstacao}, o Lobo Branco saltou sobre a linha de {heroi} e desapareceu no bosque. A equipe de {feudo} recuou antes que a fera voltasse.',
            },
          },
          rewards: { relic: { from: ['wolfBone'], consolationGold: 100 } },
          next: 'home',
        },
        home: {
          kind: 'return',
          title: 'A volta pela orla do bosque',
          durationMs: 1800000,
          text: 'No {dia}º dia {daEstacao}, a equipe da caçada voltou a {feudo} pela orla do bosque. O que aconteceu entre as árvores ficou no relato de quem foi.',
        },
      },
    },
    {
      start: 'tracks',
      nodes: {
        tracks: {
          kind: 'hazard',
          title: 'A trilha sob a geada',
          durationMs: 2700000,
          trial: {
            difficulty: 47,
            xp: 20,
            weights: {
              skill: {
                num: 1,
                den: 1,
              },
            },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria lido as pegadas antes que a neve as apagasse.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} seguiu a trilha sob a geada e encontrou a passagem para o bosque fechado. A equipe de {feudo} avançou sem perder tempo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} seguiu a trilha sob a geada e encontrou a passagem para o bosque fechado. O bosque não deu outro sinal.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro onde a geada escondia o chão. A equipe de {feudo} procurou até escurecer.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o rastro onde a geada escondia o chão. A equipe de {feudo} abriu caminho entre os espinhos sem saber onde pisava.',
            },
          },
          rewards: {
            resources: {
              food: {
                min: 10,
                max: 15,
              },
            },
          },
          next: 'whiteWolf',
        },
        whiteWolf: {
          kind: 'encounter',
          title: 'O lobo à margem do riacho',
          durationMs: 2700000,
          trial: {
            difficulty: 45,
            xp: 30,
            weights: {
              skill: {
                num: 1,
                den: 2,
              },
            },
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria sustentado a linha quando o lobo avançou.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco à margem do riacho e desferiu o golpe antes do salto. A fera caiu na neve sem erguer a cabeça.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco à margem do riacho e sustentou a linha até o golpe final. O bosque ficou quieto.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} cercou o Lobo Branco à margem do riacho, mas a fera rompeu a linha. A equipe de {feudo} deixou a clareira antes que escurecesse.',
              disaster:
                'No {dia}º dia {daEstacao}, o Lobo Branco saltou sobre a linha de {heroi} e desapareceu no bosque. A equipe de {feudo} recuou antes que a fera voltasse.',
            },
          },
          rewards: { relic: { from: ['wolfBone'], consolationGold: 100 } },
          next: 'home',
        },
        home: {
          kind: 'return',
          title: 'A volta pela orla do bosque',
          durationMs: 1800000,
          text: 'No {dia}º dia {daEstacao}, a equipe da caçada voltou a {feudo} pela orla do bosque. O que aconteceu entre as árvores ficou no relato de quem foi.',
        },
      },
    },
  ],
};
