# 0015 — Crônica sem o fecho diário do desperdício

Data: 2026-10-02\
Estado: aplicada por delegação do autor em 2026-10-02 (tarefa V2C-T2, sem o autor presente); **aguarda confirmação**\
Escopo: GDD §5.5, §11.4 e §13.2; roadmap da v0.2, V2C-T2.3; [ADR 0007](0007-cronica-sem-viradas-de-dia.md)

## Contexto

Com os limites de estoque (V2C-T2), o motor emite `storageWasted` na virada de cada dia de jogo em que algum depósito perdeu produção, com os totais por recurso ([ADR 0013](0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 17). O GDD §5.5 diz para que ele serve: "é ele que gera a linha 'Celeiro cheio: 120 comida desperdiçadas' no **Relatório**".

`GET /chronicle` e `GET /chronicle.md` trazem uma linha por evento, menos as viradas de dia (ADR 0007). Sem outra exceção, o fecho do desperdício vira uma linha da Crônica por dia de jogo enquanto houver depósito cheio. No cenário roteirizado de 7 dias do motor são 49 linhas "a produção não coube nos depósitos e foi ao chão" contra 60 de todo o resto (obras, chegadas, fome, frio, objetivos). No ritmo Rápido um dia real tem 36 dias de jogo: até 36 linhas iguais por dia real. É o mesmo problema que o ADR 0007 resolveu para "Amanhece o Nº dia": a Crônica deixa de ser boa de ler.

Alternativas consideradas:

- **Deixar na Crônica.** Segue "uma linha por evento" ao pé da letra e esconde o que o jogador quer reler.
- **Emitir o desperdício só quando o jogador volta, ou uma vez por estação.** Faria o evento depender de quem consulta, ou adiaria a conta que o Relatório precisa por dia; nos dois casos a divisão de intervalo deixa de ser trivial.
- **Tirar da Crônica e manter o evento.** É o que o ADR 0007 fez com `dayStarted`.

## Decisão

O evento `storageWasted` continua existindo, sai em `GET /events` com os totais do dia e é a fonte da linha de desperdício do Relatório de Retorno. Ele **fica fora das duas leituras da Crônica**, `GET /chronicle` e `GET /chronicle.md`, ao lado de `dayStarted`.

O que a Crônica conta do armazenamento é o que é notícia: `storageFilled`, uma vez por episódio ("o Celeiro de Pedra Alta encheu: não cabe mais comida, e o que chegar se perde"), e `buildingFounded`, quando o depósito é erguido.

A lista dos eventos que não são linhas da Crônica passa a ter um lugar só, `CHRONICLE_HIDDEN_EVENT_TYPES` em `@lotg/protocol` (`dayStarted` e `storageWasted`): o servidor a usa em `chronicleRows` (`packages/server/src/games/repository.ts`) e o app deve usá-la na Crônica recente da aba Hoje, onde hoje filtra só `dayStarted`.

O que o jogador perde de vista na Crônica continua à vista onde ele decide: a tabela de recursos mostra o depósito cheio, quanto vai ao chão por hora e o que fazer (`resources[].fullNote`, `wastingPerHour`, `wastedToday`), e o Relatório soma o desperdício da ausência.

## Consequências e verificação

- Nenhuma regra do motor muda: é escolha de apresentação, como no ADR 0007. Reverter é tirar `storageWasted` da lista.
- `packages/server/test/storage.test.ts` confere que o evento sai em `GET /events`, uma vez por dia de jogo e com os totais, e que não aparece em `GET /chronicle` nem em `/chronicle.md`, onde `storageFilled` aparece.
- O filtro `?year=` e o `?limit=` da Crônica contam só o que entra nela, como já era.
- **Para o autor confirmar:** se o fecho diário deve mesmo ficar fora da Crônica. A alternativa é uma linha por dia de jogo com depósito cheio.
