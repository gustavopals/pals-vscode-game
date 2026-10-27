# V4E-T3 — mapa de contexto e plano de execução

Sessão de 2026-10-27. Base conferida: `main`, `de76fb7`, estado 33,
protocolo 3. Limite da sessão: 16:01 UTC (13:01 em São Paulo), com margem
para validação e registro antes disso. Sem publicação.

## Fontes e requisitos

`CLAUDE.md`, GDD §8.2–8.3, §10.6, §11.1–11.2, §14–15, roadmap
V4E-T3 e contratos §0.7, ADR 0019 e ADR 0020. As respostas D-21 e D-22
fixam a astúcia nas dificuldades, teto de chance 90%, seis presságios e
contagens parciais em múltiplos de cinco. As funções puras já existem em
`hordeMind.ts`; ainda não participam do jogo.

1. Memória somente da última formação efetivamente vista na batalha, sem
   memória entre anos; pesos inteiros com astúcia 3/10, 1/2 e 4/5.
2. Acampamento no dia 25; Fortaleza no outono; ambos somam a Ameaça.
3. Ondas preparadas no outono, renovadas quando a Horda vê uma nova formação
   até o inverno; presságios dizem a verdade sobre a versão observada.
4. Presságios limitados e informação parcial na visão e na prévia. Composição
   escondida, memória e sorteios permanecem no servidor.
5. Migração sem sorteios, eventos ou passado recalculado; partida migrada no
   outono/inverno recebe a Fortaleza na primeira virada após a fronteira.
6. Simulador honesto, medidas de Ameaça e presságios, documentação e portão.

## Mapa de contexto

| Arquivo | Papel e mudança prevista |
| --- | --- |
| `packages/content/src/{balance,schemas,tiles,ids,omens,chronicle,index}.ts` | Astúcia nas dificuldades, tiles e eventos, dados das ondas e dos presságios, validação e hash |
| `packages/engine/src/{types,state,migrations}.ts` e `migrations/v33.ts`, `v34.ts` | Estado 33 → 34; memória, preparação das ondas e presságios; guarda e passo |
| `packages/engine/src/{hordeMind,hordeTurn,raidArmy,raids}.ts` | Pesos adaptados na marcação; memória da formação que realmente lutou; presságios |
| `packages/engine/src/{advance,threat,outcomes}.ts` | Surgimento e retorno dos tiles, reinício anual, ordem fixa da virada |
| `packages/engine/src/{threatView,armyView,warCouncilOrders}.ts` | Somente informação revelada; prévia não consulta a memória oculta |
| `packages/protocol/src/view.ts` | Adições compatíveis à visão, sem subir protocolo |
| `packages/sim-cli/src/` | Política militar, colunas e medição por estação |
| `packages/engine/src/{fixtures,migrations,hordeMind,hordeTurn,raids.battle,warCouncil}.test.ts` | Determinismo, migração, névoa, batalha e prévia |
| `packages/server/test/` e `tests/server/scenarios.test.ts` | Persistência real e avanço de partidas antigas |

Referências: `migrations/v32.ts` e `v33.ts` para guardas; `restoreTiles`
para retorno anual; `fightRaid` para observar o defensor antes das baixas;
`turnHorde` para a ordem e o fluxo de sorteio; `previewInputFor` para a névoa.

Riscos revistos: mudança persistida exige versão e retratos congelados;
sem migração SQL; adições ao protocolo mantêm versão 3; nenhum serviço de
produção, dependência ou configuração nova é necessário.

## Sequência e prova

1. Conferir a base com `pnpm verify` e os retratos 33 antes de mudá-los.
2. Escrever testes dos contratos; congelar retratos 33 e criar passo/guarda 34.
3. Ligar memória e pesos, tiles, ondas preparadas e presságios, nessa ordem.
4. Adicionar visão e prévia com testes que comparam estados com segredos
   diferentes e a mesma informação pública.
5. Atualizar bot e medições; executar os comandos da tarefa, `pnpm verify`,
   integração com banco real, build e cenários pertinentes.
6. Ler o diff dos goldens; atualizar GDD, arquitetura, README, pendências e
   registro; commits locais por subtarefa. Registrar qualquer validação
   indisponível e deixar o próximo passo explícito.

O mapa foi conferido contra os imports e chamadas atuais antes da implementação.
A execução e a evidência final ficam no registro do roadmap e na retomada.
