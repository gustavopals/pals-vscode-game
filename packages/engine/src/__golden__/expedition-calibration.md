# Calibragem do catálogo de expedições

Gerado por `expeditions.calibration.test.ts`; não edite à mão. As equipes de referência, a régua e o que a conta não vê estão descritos no teste.

## Por modelo, equipe e Postura

| Modelo | Risco | Equipe | Cautelosa: passa | Equilibrada: passa / Revés / Desastre | Ousada: passa / Revés / Desastre | Captura (Equilibrada / Ousada) |
|---|---|---|---:|---|---|---|
| Patrulha dos Arredores | Baixo | Fraca: Clérigo Nv1 | 51% | 51% / 49% / 0% | 51% / 49% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Mínima: Guerreiro Nv1 | 99% | 99% / 1% / 0% | 99% / 1% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Com folga: Guerreiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Fraca: Clérigo Nv1 | 100% | 34% / 62% / 3% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Mínima: Guerreiro Nv1 | 100% | 76% / 24% / 0% | 33% / 46% / 20% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Covil dos Lobos | Médio | Fraca: Clérigo + Clérigo Nv1 | 52% | 19% / 77% / 3% | 6% / 59% / 34% | 0% / 0% |
| Covil dos Lobos | Médio | Mínima: Guerreiro + Arqueiro Nv1 | 89% | 45% / 55% / 0% | 17% / 83% / 0% | 0% / 0% |
| Covil dos Lobos | Médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 94% / 6% / 0% | 63% / 37% / 0% | 0% / 0% |
| Resgate | Alto | Fraca: Clérigo + Clérigo Nv1 | 8% | 0% / 100% / 0% | 7% / 71% / 22% | 0% / 22% |
| Resgate | Alto | Mínima: Guerreiro + Arqueiro Nv1 | 65% | 47% / 53% / 0% | 22% / 74% / 4% | 0% / 4% |
| Resgate | Alto | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 100% / 0% / 0% | 53% / 47% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Fraca: Clérigo + Clérigo Nv2 | 82% | 34% / 59% / 6% | 35% / 56% / 10% | 6% / 10% |
| Ruínas de Vel'Thar | Médio | Mínima: Guerreiro + Arqueiro Nv2 | 100% | 18% / 82% / 0% | 38% / 62% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Com folga: Guerreiro + Arqueiro + Mago Nv4 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Pântano Nebuloso | Alto | Fraca: Mago + Clérigo + Clérigo Nv1 | 59% | 6% / 94% / 0% | 16% / 69% / 15% | 0% / 15% |
| Pântano Nebuloso | Alto | Mínima: Mago + Guerreiro + Arqueiro Nv1 | 80% | 20% / 80% / 0% | 53% / 44% / 2% | 0% / 2% |
| Pântano Nebuloso | Alto | Com folga: Mago + Guerreiro + Arqueiro Nv3 | 100% | 78% / 22% / 0% | 74% / 26% / 0% | 0% / 0% |

## Cada prova, para as três equipes

Em 31 sortes:

| Modelo | Var. | Nó | Dif. | Pesa | Favorece | Desastre | Fraca P/S/R/D | Mínima P/S/R/D | Com folga P/S/R/D |
|---|---|---|---:|---|---|---|---|---|---|
| Patrulha dos Arredores | A | A ronda pelas cercas | 36 | o padrão | Guerreiro | fere | 0/3/28/0 | 4/26/1/0 | 19/12/0/0 |
| Patrulha dos Arredores | B | O vau do riacho | 40 | perícia ×1 | Arqueiro | fere | 0/16/15/0 | 7/24/0/0 | 22/9/0/0 |
| Patrulha dos Arredores | C | Rastros na estrada velha | 42 | vontade ×1 | Mago | fere | 2/26/3/0 | 6/25/0/0 | 21/10/0/0 |
| Floresta Antiga | A | O javali da mata fechada | 55 | o padrão | Guerreiro | fere | 0/0/0/31 | 0/0/24/7 | 31/0/0/0 |
| Floresta Antiga | A | As pedras do riacho | 46 | perícia ×1 | Arqueiro | fere | 0/1/30/0 | 0/20/11/0 | 31/0/0/0 |
| Floresta Antiga | B | Os lenhadores sem senhor | 58 | o padrão | Guerreiro | fere | 0/0/0/31 | 0/0/19/12 | 31/0/0/0 |
| Floresta Antiga | C | O ninho no alto | 50 | perícia ×1,5 | Arqueiro | fere | 0/2/29/0 | 0/17/14/0 | 31/0/0/0 |
| Floresta Antiga | C | O fundo do barranco | 40 | o padrão | Guerreiro | fere | 0/0/28/3 | 0/20/11/0 | 31/0/0/0 |
| Covil dos Lobos | A | A subida pela pedreira solta | 84 | perícia ×1 | Arqueiro | fere | 0/11/20/0 | 4/26/1/0 | 19/12/0/0 |
| Covil dos Lobos | A | O lobo velho no fundo da toca | 90 | o padrão | Guerreiro | fere | 0/0/17/14 | 0/0/31/0 | 0/16/15/0 |
| Covil dos Lobos | A | A matilha na fumaça | 86 | perícia ×0,5 | Guerreiro | fere | 0/0/31/0 | 0/18/13/0 | 6/25/0/0 |
| Covil dos Lobos | B | As sentinelas da garganta | 70 | o padrão | Guerreiro | fere | 0/6/25/0 | 0/26/5/0 | 15/16/0/0 |
| Covil dos Lobos | B | A matilha sob o penedo | 104 | perícia ×1,5 | Arqueiro | fere | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| Covil dos Lobos | B | A toca apertada | 80 | o padrão | Guerreiro | fere | 0/0/28/3 | 0/13/18/0 | 1/26/4/0 |
| Covil dos Lobos | B | O fogo no mato | 60 | perícia ×0,5 | Guerreiro | fere | 7/24/0/0 | 27/4/0/0 | 31/0/0/0 |
| Covil dos Lobos | C | A noite na serra | 76 | vontade ×1,5, ataque ×0,5 | Clérigo | fere | 20/11/0/0 | 1/26/4/0 | 16/15/0/0 |
| Covil dos Lobos | C | A loba e a cria | 94 | o padrão | Guerreiro | fere | 0/0/13/18 | 0/0/31/0 | 0/12/19/0 |
| Covil dos Lobos | C | A matilha de volta da caça | 94 | vontade ×1 | Mago | fere | 0/18/13/0 | 0/16/15/0 | 3/26/2/0 |
| Resgate | A | A trilha dos captores | 90 | perícia ×1 | Arqueiro | fere | 0/3/28/0 | 0/24/7/0 | 13/18/0/0 |
| Resgate | A | O bando ao meio-dia | 96 | o padrão | Guerreiro | captura | 0/0/11/20 | 0/0/29/2 | 0/9/22/0 |
| Resgate | A | As cordas no escuro | 96 | perícia ×1 | Arqueiro | captura | 0/0/31/0 | 0/18/13/0 | 6/25/0/0 |
| Resgate | A | A troca da guarda | 78 | perícia ×0,5 | Guerreiro | captura | 0/7/24/0 | 0/27/4/0 | 16/15/0/0 |
| Resgate | B | O vau vigiado | 72 | o padrão | Guerreiro | fere | 0/3/28/0 | 0/23/8/0 | 12/19/0/0 |
| Resgate | B | A guarda atrás da porta | 96 | o padrão | Guerreiro | captura | 0/0/11/20 | 0/0/29/2 | 0/9/22/0 |
| Resgate | B | A parede dos fundos | 104 | perícia ×1,5 | Arqueiro | captura | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| Resgate | B | A fresta ao pé da torre | 84 | vontade ×1 | Mago | captura | 2/26/3/0 | 0/26/5/0 | 15/16/0/0 |
| Resgate | C | A noite sem fogo | 78 | vontade ×1,5, ataque ×0,5 | Clérigo | fere | 17/14/0/0 | 0/25/6/0 | 14/17/0/0 |
| Resgate | C | O duelo com o chefe do bando | 92 | o padrão | Guerreiro | captura | 0/0/15/16 | 0/0/31/0 | 0/14/17/0 |
| Resgate | C | Os cavalos soltos | 106 | velocidade ×1, perícia ×0,5 | Arqueiro | captura | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| Resgate | C | A vala até a gaiola | 80 | perícia ×0,5 | Guerreiro | captura | 0/4/27/0 | 0/25/6/0 | 14/17/0/0 |
| Ruínas de Vel'Thar | A | O Corredor das Inscrições | 110 | perícia ×1,5 | Arqueiro | fere | 0/0/31/0 | 0/21/10/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | A | A Galeria Inundada | 72 | o padrão | Guerreiro | fere | 0/11/20/0 | 4/26/1/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | A | O Guardião de Pedra | 92 | o padrão | Guerreiro | captura | 0/0/22/9 | 0/6/25/0 | 30/1/0/0 |
| Ruínas de Vel'Thar | B | Os saqueadores no portão caído | 70 | o padrão | Guerreiro | fere | 0/14/17/0 | 7/24/0/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | B | O ossário que canta | 104 | vontade ×1,5, ataque ×0,5 | Clérigo | fere | 0/22/9/0 | 0/4/27/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | B | O salão das lajes falsas | 84 | perícia ×1 | Arqueiro | fere | 0/18/13/0 | 12/19/0/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | B | O guardião da cripta | 116 | vontade ×1 | Mago | captura | 0/4/27/0 | 0/1/30/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | C | Os selos da torre | 104 | vontade ×1,5 | Mago | fere | 4/26/1/0 | 0/21/10/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | C | O ninho na cisterna | 64 | o padrão | Guerreiro | fere | 0/23/8/0 | 17/14/0/0 | 31/0/0/0 |
| Ruínas de Vel'Thar | C | A sentinela sem rosto | 112 | perícia ×1 | Arqueiro | captura | 0/0/25/6 | 0/10/21/0 | 31/0/0/0 |
| Pântano Nebuloso | A | O atoleiro | 130 | perícia ×1 | Arqueiro | fere | 0/12/19/0 | 0/25/6/0 | 14/17/0/0 |
| Pântano Nebuloso | A | As luzes do charco | 140 | o padrão | Guerreiro | captura | 0/0/17/14 | 0/0/29/2 | 0/9/22/0 |
| Pântano Nebuloso | A | A margem dos salgueiros | 132 | vontade ×1 | Mago | fere | 0/26/5/0 | 0/24/7/0 | 13/18/0/0 |
| Pântano Nebuloso | A | A bruxa do charco | 170 | vontade ×1,5 | Mago | captura | 0/16/15/0 | 0/10/21/0 | 0/24/7/0 |
| Pântano Nebuloso | B | A balsa podre | 140 | velocidade ×1, perícia ×0,5 | Arqueiro | fere | 0/15/16/0 | 1/26/4/0 | 17/14/0/0 |
| Pântano Nebuloso | B | A noite da febre | 120 | vontade ×1,5, ataque ×0,5 | Clérigo | fere | 12/19/0/0 | 0/26/5/0 | 15/16/0/0 |
| Pântano Nebuloso | B | A toca do que arrasta as redes | 138 | o padrão | Guerreiro | captura | 0/0/18/13 | 0/0/30/1 | 0/10/21/0 |
| Pântano Nebuloso | B | A capela debaixo da água | 128 | perícia ×1 | Arqueiro | fere | 0/13/18/0 | 0/26/5/0 | 15/16/0/0 |
| Pântano Nebuloso | B | O afogado que anda | 120 | o padrão | Guerreiro | captura | 0/0/31/0 | 0/9/22/0 | 0/24/7/0 |
| Pântano Nebuloso | C | O nevoeiro que chama pelo nome | 128 | vontade ×1 | Mago | fere | 2/26/3/0 | 1/26/4/0 | 17/14/0/0 |
| Pântano Nebuloso | C | A maldição dos enforcados | 150 | vontade ×1,5, ataque ×0,5 | Clérigo | captura | 0/16/15/0 | 0/4/27/0 | 0/19/12/0 |
| Pântano Nebuloso | C | O canal escuro | 104 | o padrão | Guerreiro | fere | 0/10/21/0 | 0/23/8/0 | 12/19/0/0 |
| Pântano Nebuloso | C | A serpente do lodo | 134 | perícia ×0,5 | Guerreiro | captura | 0/0/31/0 | 0/11/20/0 | 0/25/6/0 |

## Cada opção de encruzilhada

| Modelo | Var. | Opção | Postura | Requisito | Razoável para | Ruim para | Melhor para (equipes do painel) |
|---|---|---|---|---|---|---|---:|
| Floresta Antiga | A | Abrir caminho pela mata fechada | Ousada | Guerreiro | Guerreiro + Arqueiro Nv2 (passa em 100%) | Guerreiro Nv1 (passa em 0%) | 17 de 52 |
| Floresta Antiga | A | Seguir o riacho | Equilibrada | — | Arqueiro + Arqueiro Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv2 (passa em 100%) | 34 de 52 |
| Floresta Antiga | A | Voltar com o que já têm | Cautelosa | — | Clérigo Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv2 (passa em 100%) | 1 de 52 |
| Floresta Antiga | B | Abrir caminho pela mata fechada | Ousada | Guerreiro | Guerreiro + Arqueiro Nv3 (passa em 100%) | Guerreiro Nv1 (passa em 0%) | 16 de 52 |
| Floresta Antiga | B | Seguir o riacho | Equilibrada | — | Guerreiro Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv3 (passa em 100%) | 36 de 52 |
| Floresta Antiga | B | Voltar com o que já têm | Cautelosa | — | — | Guerreiro + Arqueiro Nv3 (passa em 100%) | 0 de 52 |
| Floresta Antiga | C | Subir ao ninho | Ousada | Arqueiro | Arqueiro Nv1 (passa em 90%) | Guerreiro + Arqueiro Nv1 (passa em 100%) | 4 de 52 |
| Floresta Antiga | C | Descer o barranco | Equilibrada | — | Guerreiro + Guerreiro Nv1 (passa em 100%) | Arqueiro Nv1 (passa em 13%) | 45 de 52 |
| Floresta Antiga | C | Dar meia-volta | Cautelosa | — | Clérigo Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv1 (passa em 100%) | 3 de 52 |
| Covil dos Lobos | A | Entrar na toca atrás do lobo velho | Ousada | — | Guerreiro + Guerreiro Nv5 (passa em 100%) | Arqueiro + Arqueiro Nv2 (passa em 0%) | 3 de 36 |
| Covil dos Lobos | A | Enfumaçar a toca e esperar na saída | Equilibrada | — | Arqueiro + Arqueiro Nv2 (passa em 74%) | Guerreiro + Guerreiro Nv5 (passa em 100%) | 31 de 36 |
| Covil dos Lobos | A | Recuar com o que têm | Cautelosa | — | Clérigo + Clérigo Nv1 (passa em 100%) | Guerreiro + Guerreiro Nv5 (passa em 100%) | 2 de 36 |
| Covil dos Lobos | B | Flechar a matilha do alto do penedo | Ousada | Arqueiro | Arqueiro + Arqueiro Nv2 (passa em 100%) | Guerreiro + Guerreiro Nv1 (não pode) | 16 de 36 |
| Covil dos Lobos | B | Fechar uma boca com pedras e entrar pela outra | Equilibrada | — | Guerreiro + Guerreiro Nv5 (passa em 100%) | Arqueiro + Arqueiro Nv1 (passa em 13%) | 16 de 36 |
| Covil dos Lobos | B | Queimar o mato em volta e descer | Cautelosa | — | Clérigo + Clérigo Nv1 (passa em 100%) | Arqueiro + Arqueiro Nv5 (passa em 100%) | 4 de 36 |
| Covil dos Lobos | C | Matar a loba antes que a matilha volte | Ousada | — | Guerreiro + Guerreiro Nv5 (passa em 100%) | Clérigo + Clérigo Nv3 (passa em 0%) | 3 de 36 |
| Covil dos Lobos | C | Espantar a matilha serra acima | Equilibrada | — | Mago + Clérigo Nv3 (passa em 100%) | Guerreiro + Guerreiro Nv5 (passa em 100%) | 33 de 36 |
| Covil dos Lobos | C | Recuar com o que têm | Cautelosa | — | — | Guerreiro + Guerreiro Nv5 (passa em 100%) | 0 de 36 |
| Resgate | A | Atacar ao meio-dia e levar também o cofre | Ousada | — | Guerreiro + Guerreiro Nv5 (passa em 94%) | Arqueiro + Arqueiro Nv1 (passa em 0%) | 1 de 36 |
| Resgate | A | Entrar à noite e cortar as cordas | Equilibrada | — | Arqueiro + Arqueiro Nv5 (passa em 100%) | Guerreiro + Clérigo Nv1 (passa em 19%) | 11 de 36 |
| Resgate | A | Esperar a troca da guarda | Cautelosa | — | Guerreiro + Clérigo Nv1 (passa em 61%) | Guerreiro + Guerreiro Nv5 (passa em 100%) | 24 de 36 |
| Resgate | B | Arrombar a porta | Ousada | Guerreiro | Guerreiro + Guerreiro Nv5 (passa em 94%) | Guerreiro + Clérigo Nv1 (passa em 0%) | 1 de 36 |
| Resgate | B | Escalar a parede dos fundos | Equilibrada | — | Arqueiro + Arqueiro Nv2 (passa em 100%) | Clérigo + Clérigo Nv1 (passa em 0%) | 12 de 36 |
| Resgate | B | Passar a lima pela fresta e esperar | Cautelosa | — | Clérigo + Clérigo Nv1 (passa em 90%) | Guerreiro + Guerreiro Nv5 (passa em 100%) | 23 de 36 |
| Resgate | C | Desafiar o chefe do bando | Ousada | traço brave | Guerreiro + Guerreiro Nv5, com brave (passa em 100%) | Arqueiro + Arqueiro Nv1, com brave (passa em 0%) | 3 de 72 |
| Resgate | C | Soltar os cavalos e entrar na confusão | Equilibrada | — | Arqueiro + Arqueiro Nv1 (passa em 74%) | Guerreiro + Guerreiro Nv5, com brave (passa em 100%) | 29 de 72 |
| Resgate | C | Rastejar pela vala até a gaiola | Cautelosa | — | Guerreiro + Guerreiro Nv1 (passa em 87%) | Guerreiro + Guerreiro Nv5, com brave (passa em 100%) | 40 de 72 |
| Ruínas de Vel'Thar | A | Seguir pelo Corredor das Inscrições | Ousada | — | Arqueiro + Mago + Clérigo Nv6 (passa em 100%) | Clérigo + Clérigo Nv2 (passa em 0%) | 51 de 60 |
| Ruínas de Vel'Thar | A | Atravessar a Galeria Inundada | Equilibrada | Guerreiro | Guerreiro + Clérigo Nv2 (passa em 0%) | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) | 8 de 60 |
| Ruínas de Vel'Thar | A | Recuar com o que têm | Cautelosa | — | Clérigo + Clérigo Nv2 (passa em 100%) | Guerreiro + Arqueiro + Mago Nv6 (passa em 100%) | 1 de 60 |
| Ruínas de Vel'Thar | B | Descer ao ossário | Ousada | — | Clérigo + Clérigo Nv4 (passa em 58%) | Arqueiro + Arqueiro Nv2 (passa em 0%) | 46 de 60 |
| Ruínas de Vel'Thar | B | Atravessar o salão das lajes falsas | Equilibrada | — | Arqueiro + Arqueiro Nv2 (passa em 0%) | Clérigo + Clérigo Nv4 (passa em 58%) | 14 de 60 |
| Ruínas de Vel'Thar | B | Recuar com o que têm | Cautelosa | — | — | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) | 0 de 60 |
| Ruínas de Vel'Thar | C | Romper os selos da torre | Ousada | Mago | Mago + Clérigo Nv2 (passa em 0%) | Guerreiro + Arqueiro Nv2 (não pode) | 32 de 60 |
| Ruínas de Vel'Thar | C | Descer à cisterna | Equilibrada | — | Guerreiro + Arqueiro + Clérigo Nv6 (passa em 100%) | Mago + Clérigo Nv2 (passa em 0%) | 27 de 60 |
| Ruínas de Vel'Thar | C | Catar a pedra do pátio e voltar | Cautelosa | — | Clérigo + Clérigo Nv2 (passa em 100%) | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) | 1 de 60 |
| Pântano Nebuloso | A | Atravessar o charco, direto à ilha | Ousada | — | Guerreiro + Guerreiro + Mago Nv5 (passa em 84%) | Mago + Clérigo + Clérigo Nv1 (passa em 0%) | 6 de 20 |
| Pântano Nebuloso | A | Contornar pela margem dos salgueiros | Equilibrada | — | Mago + Clérigo + Clérigo Nv1 (passa em 43%) | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | 14 de 20 |
| Pântano Nebuloso | A | Recuar com o que têm | Cautelosa | — | — | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | 0 de 20 |
| Pântano Nebuloso | B | Seguir o rastro na lama | Ousada | traço tracker | Guerreiro + Guerreiro + Mago Nv5, com tracker (passa em 90%) | Mago + Clérigo + Clérigo Nv1, com tracker (passa em 0%) | 5 de 40 |
| Pântano Nebuloso | B | Mergulhar até a capela do sino | Equilibrada | — | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | Guerreiro + Guerreiro + Mago Nv5, com tracker (passa em 100%) | 35 de 40 |
| Pântano Nebuloso | B | Recuar com o que têm | Cautelosa | — | — | Guerreiro + Guerreiro + Mago Nv5, com tracker (passa em 100%) | 0 de 40 |
| Pântano Nebuloso | C | Desfazer a maldição da árvore | Ousada | Clérigo | Mago + Clérigo + Clérigo Nv3 (passa em 37%) | Guerreiro + Arqueiro + Mago Nv1 (não pode) | 12 de 20 |
| Pântano Nebuloso | C | Passar ao largo, pelo canal | Equilibrada | — | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | Mago + Clérigo + Clérigo Nv3 (passa em 31%) | 8 de 20 |
| Pântano Nebuloso | C | Recuar com o que têm | Cautelosa | — | — | Guerreiro + Mago + Clérigo Nv5 (passa em 100%) | 0 de 20 |
