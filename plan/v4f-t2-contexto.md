# V4F-T2 — Mapa de contexto e execução

Mapa revisado no worktree `v4f-t2-acampamento`, base `6964500` (estado 38).

## Arquivos a modificar

| Arquivos | Finalidade |
| --- | --- |
| `packages/content/src/balance.ts`, `campaign.ts`, `chronicle.ts`, `heroes.ts`, `ids.ts` | Viagem, guarnição, paliçada, saque e frases da campanha |
| `packages/engine/src/armyOrders.ts`, `armyTurn.ts`, `campaign.ts` | Validar saída; congelar formação e reservas; chegada e retorno |
| `battle.ts`, `battleReport.ts`, `raids.ts`, `formations.ts`, `warCouncilOrders.ts` | Paliçada do defensor; excluir reservas da defesa e da prévia |
| `types.ts`, `state.ts`, `commands.ts`, `timeline.ts`, `advance.ts`, `outcomes.ts` | Estado, ordem, instantes e limpeza de ameaça |
| `armyView.ts`, `formationsView.ts`, `packages/protocol/src/{commands,view}.ts` | Contrato público aditivo; situação da campanha e aviso |
| `migrations/v38.ts`, `migrations/v39.ts`, `migrations.ts` | Passo 38 → 39; campanha inicialmente nula |

## Dependências e referências

| Arquivos | Relação |
| --- | --- |
| `raidArmy.ts`, `battleTurn.ts`, `battleOutcome.ts` | Preenchimento de postos, fluxo `battle:<id>`, efeitos em comandantes |
| `outcomes.ts`, `advance.ts` | Tile limpo e restauração na virada do ano |
| `heroes.ts`, `wages.ts`, `equipment.ts` | Herói em campanha não está no feudo; conserva soldo e bloqueia dispensa/equipamento |
| `migrations/v29.ts`, `v30.ts`, `v33.ts` | Guardas congeladas de formação e relatório |

## Testes

| Arquivos | Cobertura |
| --- | --- |
| `campaign.test.ts`, `campaign.property.test.ts` | Recusas, viagem, batalha, defesa, retorno, virada anual e divisão de intervalo |
| `battle.test.ts`, `battle.property.test.ts` | Paliçada na batalha ofensiva e preservação da defesa |
| `campaign.migration.test.ts`, `fixtures.test.ts`, `migrations.test.ts` (filtro) | Migração, forma exata e retratos congelados |
| `army.test.ts`, `formations.test.ts`, `raids*.test.ts`, `warCouncil*.test.ts`, protocolo (focados) | Regressão das reservas e contratos |

## Riscos e limites

- API cresce por adição; protocolo permanece 3.
- Migração de estado necessária; sem migração SQL nem configuração.
- Números sem aprovação ficam como propostas F-3 em `docs/pendencias-v0.4.md`.
- Interface é V4F-T3. Simulador, matrizes, integração, navegador e verify inteiro ficam para o coordenador por instrução desta sessão.
- Não alterar `packages/sim-cli/src/bands.ts`.

## Passos

1. [x] Conteúdo e suporte da paliçada inimiga; teste focado e commit.
2. [x] Estado 39, ordem, reserva, chegada, retorno e contratos de visão; teste focado e commit.
3. [x] Retratos, propriedades, regressões e documentação/Registro; typecheck, lint e commit.
