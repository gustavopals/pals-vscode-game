import type { ExpeditionModelDef, ExpeditionVariant } from '../expeditions';

/** ADR 0022, D-6/D-7; ficha e consolo em docs/content-v0.5.md. */
const hoard = {
  relic: {
    from: ['ancestralHorn', 'watchersEye', 'ancientKingsSeal', 'saltStone'],
    consolationGold: 100,
  },
} as const;
const MINUTE = 60_000;

function variant(
  difficulty: number,
  arrival: string,
  passage: string,
  boldTitle: string,
  boldGuard: string,
  balancedTitle: string,
  balancedGuard: string,
): ExpeditionVariant {
  return {
    start: 'approach',
    nodes: {
      approach: {
        kind: 'hazard',
        title: arrival,
        durationMs: 60 * MINUTE,
        trial: {
          difficulty,
          xp: 90,
          weights: { skill: { num: 1, den: 1 } },
          onDisaster: 'injury',
          helps: 'archer',
          lesson: 'Um Arqueiro teria encontrado os apoios firmes antes da travessia.',
          outcomes: {
            full: `No {dia}º dia {daEstacao}, {heroi} examinou ${passage} apoio por apoio e guiou a expedição de {feudo} até o abrigo com os sacos cheios.`,
            success: `No {dia}º dia {daEstacao}, {heroi} encontrou como atravessar ${passage}, e a expedição de {feudo} alcançou o abrigo.`,
            setback: `No {dia}º dia {daEstacao}, o chão cedeu sob ${passage} diante de {heroi}, e a expedição de {feudo} salvou só parte do que juntara.`,
            disaster: `No {dia}º dia {daEstacao}, {heroi} perdeu o equilíbrio ao atravessar ${passage}, e a expedição de {feudo} alcançou o abrigo sem os sacos.`,
          },
        },
        rewards: { resources: { stone: { min: 20, max: 30 } } },
        next: 'threshold',
      },
      threshold: {
        kind: 'crossroads',
        title: 'A porta e a passagem lateral',
        text: 'Uma porta coberta de sinais fecha o caminho mais fundo. Ao lado, uma passagem estreita leva a uma guarda menor. A estrada de volta ainda está livre.',
        options: [
          {
            id: 'breakSeal',
            label: 'Romper o selo da porta',
            hint: 'Tesouro maior sob um encanto antigo; vontade firme vence, mas quem cai pode ficar em cativeiro.',
            next: 'sealedGuardian',
          },
          {
            id: 'faceKeeper',
            label: 'Enfrentar a guarda lateral',
            hint: 'Menos moedas e uma guarda menor, com tesouro ao alcance; pede quem sustente os golpes.',
            requires: { heroClass: 'warrior' },
            next: 'sideKeeper',
          },
          {
            id: 'returnHome',
            label: 'Voltar com o que já têm',
            hint: 'Sem risco; levam apenas o que juntaram na chegada.',
            next: 'home',
          },
        ],
        posture: { cautious: 'returnHome', balanced: 'faceKeeper', bold: 'breakSeal' },
      },
      sealedGuardian: {
        kind: 'boss',
        title: boldTitle,
        durationMs: 60 * MINUTE,
        trial: {
          difficulty: difficulty + 50,
          xp: 150,
          weights: { will: { num: 3, den: 2 } },
          onDisaster: 'capture',
          helps: 'mage',
          lesson: 'Um Mago teria desfeito o encanto antes que ele fechasse a saída.',
          outcomes: {
            full: `No {dia}º dia {daEstacao}, {heroi} desfez o encanto e venceu ${boldGuard}; a expedição de {feudo} abriu o tesouro intacto.`,
            success: `No {dia}º dia {daEstacao}, {heroi} resistiu ao encanto até superar ${boldGuard} e abrir o tesouro para a expedição de {feudo}.`,
            setback: `No {dia}º dia {daEstacao}, ${boldGuard} resistiu a {heroi}; a expedição de {feudo} recolheu moedas junto à porta e recuou.`,
            disaster: `No {dia}º dia {daEstacao}, ${boldGuard} fechou a saída diante de {heroi}; a expedição de {feudo} perdeu o caminho do tesouro.`,
          },
        },
        rewards: { ...hoard, resources: { gold: { min: 140, max: 180 } } },
        next: 'home',
      },
      sideKeeper: {
        kind: 'encounter',
        title: balancedTitle,
        durationMs: 60 * MINUTE,
        trial: {
          difficulty,
          xp: 120,
          onDisaster: 'injury',
          helps: 'warrior',
          outcomes: {
            full: `No {dia}º dia {daEstacao}, {heroi} derrubou ${balancedGuard} e abriu o tesouro para a expedição de {feudo}.`,
            success: `No {dia}º dia {daEstacao}, {heroi} suportou cada golpe que ${balancedGuard} desferiu até a expedição de {feudo} alcançar o tesouro.`,
            setback: `No {dia}º dia {daEstacao}, ${balancedGuard} conteve {heroi}; a expedição de {feudo} voltou com as moedas espalhadas pelo chão.`,
            disaster: `No {dia}º dia {daEstacao}, ${balancedGuard} repeliu {heroi}, e a expedição de {feudo} recuou sem abrir o tesouro.`,
          },
        },
        rewards: { ...hoard, resources: { gold: { min: 80, max: 100 } } },
        next: 'home',
      },
      home: {
        kind: 'return',
        title: 'A estrada de volta ao feudo',
        durationMs: 60 * MINUTE,
        text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} deixou o abrigo para trás e tomou a estrada de casa.',
      },
    },
  };
}

export const ancestralVault: ExpeditionModelDef = {
  id: 'ancestralVault',
  label: 'Câmara dos Ancestrais',
  riskLabel: 'Médio',
  durationMs: 180 * MINUTE,
  requires: { guildLevel: 4, chapel: true, teamMin: 2, teamMax: 3, minHeroLevel: 2, classes: [] },
  access: { kind: 'open' },
  variants: [
    variant(
      89,
      'A ponte caída',
      'a ponte caída',
      'O salão dos escudos',
      'o espírito dos escudos',
      'A sentinela do nicho',
      'a sentinela do nicho',
    ),
    variant(
      90,
      'A escadaria dos reis',
      'a escadaria dos reis',
      'O trono sem nome',
      'o vulto do trono',
      'A guarda do pórtico',
      'a guarda do pórtico',
    ),
    variant(
      91,
      'O pátio das colunas',
      'o pátio das colunas',
      'O túmulo dos juramentos',
      'a sombra dos juramentos',
      'A estátua do limiar',
      'a estátua do limiar',
    ),
  ],
};
