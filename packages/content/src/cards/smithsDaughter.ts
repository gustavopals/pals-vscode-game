import type { CouncilCard } from '../council';

// Fichas aprovadas pelo autor: docs/content-v0.4.md, §§9–11.
export const smithsDaughter: CouncilCard = {
  "id": "smithsDaughter",
  "title": "A Filha do Ferreiro",
  "text": "A filha do ferreiro, de quinze anos e braço de homem, pediu licença para ficar diante da forja a noite inteira, e o pai, que nunca deixou ninguém lá, olhou para o chão. Ela já sabe bater o ferro em frio. O que quer é aprender a temperá-lo. A aldeia espiou pela janela, e há quem ache que moça não é lugar para fornalha.",
  "weight": 2,
  "requires": {
    "seasons": [
      "summer"
    ],
    "buildings": {
      "smithy": 1
    },
    "notFlags": [
      "smithsDaughter.learning",
      "smithsDaughter.tradition"
    ]
  },
  "autoResolve": {
    "peasant": "tradition",
    "lord": "tradition",
    "ironKing": "tradition"
  },
  "options": [
    {
      "id": "teach",
      "label": "Deixar a moça aprender",
      "cost": {
        "iron": 40
      },
      "effects": [
        {
          "type": "smithySpeed",
          "factor": {
            "num": 6,
            "den": 5
          },
          "durationDays": 12
        },
        {
          "type": "morale",
          "amount": -5,
          "durationDays": 2
        },
        {
          "type": "setFlag",
          "flag": "smithsDaughter.learning"
        },
        {
          "type": "scheduleCard",
          "cardId": "temperingSecret",
          "afterDays": 6
        }
      ],
      "hint": "A moça aprende, a forja corre, e a aldeia fala.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a filha do ferreiro aprender o ofício. A forja varou a noite, e as janelas da vizinhança ficaram acesas até tarde."
    },
    {
      "id": "tradition",
      "label": "Manter a tradição",
      "effects": [
        {
          "type": "morale",
          "amount": 5,
          "durationDays": 3
        },
        {
          "type": "setFlag",
          "flag": "smithsDaughter.tradition"
        }
      ],
      "hint": "O ofício fica onde sempre esteve, e ninguém reclama.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} manteve a tradição da forja. A filha do ferreiro voltou à roca, e a aldeia dormiu em paz.",
      "expiredChronicle": "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} manteve a tradição da forja. A filha do ferreiro voltou à roca, e a aldeia dormiu em paz."
    }
  ]
};

export const temperingSecret: CouncilCard = {
  "id": "temperingSecret",
  "title": "O segredo da têmpera",
  "text": "A filha do ferreiro apareceu na porta do Salão com a cara suja de carvão e um sorriso que nenhum conselheiro soube ler. Descobriu, de tanto errar, que o ferro fica melhor quando esfria em óleo e não em água, e que o óleo certo dá mais peças por fornada. Falta só o ferro para a prova, e o pai fingia que não ouvia.",
  "weight": 0,
  "requires": {
    "flags": [
      "smithsDaughter.learning"
    ]
  },
  "autoResolve": {
    "peasant": "keep",
    "lord": "keep",
    "ironKing": "keep"
  },
  "options": [
    {
      "id": "pay",
      "label": "Pagar o ferro da prova",
      "cost": {
        "iron": 60
      },
      "effects": [
        {
          "type": "smithyBatch",
          "extra": 1,
          "durationDays": 15
        },
        {
          "type": "setFlag",
          "flag": "smithsDaughter.tempered"
        },
        {
          "type": "scheduleCard",
          "cardId": "lordsSword",
          "afterDays": 6
        }
      ],
      "hint": "Um óleo novo, uma arma a mais por lote, e sessenta de ferro a menos.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o ferro da prova de têmpera. A filha do ferreiro encheu o barril de óleo e não dormiu em casa."
    },
    {
      "id": "keep",
      "label": "Guardar o ferro",
      "effects": [
        {
          "type": "morale",
          "amount": 5,
          "durationDays": 2
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.learning"
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.tempered"
        }
      ],
      "hint": "O ferro fica no depósito, e o segredo, na cabeça dela.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} guardou o ferro. A filha do ferreiro baixou os olhos, e o pai disse que ela ainda tinha muito para aprender.",
      "expiredChronicle": "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} guardou o ferro. A filha do ferreiro baixou os olhos, e o pai disse que ela ainda tinha muito para aprender."
    }
  ]
};

export const lordsSword: CouncilCard = {
  "id": "lordsSword",
  "title": "A espada do Senhor",
  "text": "A filha do ferreiro pediu que o senhor viesse à forja e trouxe, enrolada num pano, a primeira lâmina inteira que fez sozinha. Tem o fio limpo e o peso certo, e o pai, ao lado, não disse nada, que é o seu jeito de dizer muito. Ela quer saber o que o feudo faz com o que ela forjou: uma lâmina que merece um nome, ou o ferro de dez outras.",
  "weight": 0,
  "requires": {
    "flags": [
      "smithsDaughter.tempered"
    ],
    "buildings": {
      "smithy": 1
    }
  },
  "autoResolve": {
    "peasant": "arms",
    "lord": "arms",
    "ironKing": "arms"
  },
  "options": [
    {
      "id": "blade",
      "label": "Ficar com a lâmina",
      "effects": [
        {
          "type": "addItem",
          "itemId": "lordsSword"
        },
        {
          "type": "morale",
          "amount": 5,
          "durationDays": 2
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.learning"
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.tempered"
        }
      ],
      "hint": "Uma espada com nome, que a Guilda disputa antes do jantar.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} ficou com a lâmina da filha do ferreiro. A espada ganhou nome antes do pôr do sol, e a forja ficou em silêncio por respeito."
    },
    {
      "id": "arms",
      "label": "Fundir em armas para a tropa",
      "effects": [
        {
          "type": "addWeapons",
          "amount": 8
        },
        {
          "type": "morale",
          "amount": 5,
          "durationDays": 2
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.learning"
        },
        {
          "type": "clearFlag",
          "flag": "smithsDaughter.tempered"
        }
      ],
      "hint": "O ferro volta a ser o que o Quartel gasta: espadas simples, em número.",
      "chronicle": "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou fundir a lâmina em armas para a tropa. A filha do ferreiro empilhou as peças uma a uma, de cabeça erguida.",
      "expiredChronicle": "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou fundir a lâmina em armas para a tropa. A filha do ferreiro empilhou as peças uma a uma, de cabeça erguida."
    }
  ]
};

