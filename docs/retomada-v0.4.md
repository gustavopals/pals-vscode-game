# Retomada da v0.4 — 2026-10-22

## Plano e escopo desta sessão

Concluir a integração de V4C-T3 antes de iniciar outra mecânica. Base: `main` em
`74f57e7`. O branch local `v4c-t3-resto`, em `834111e`, já continha T3.4 e T3.5;
foi revisado e integrado em `codex/v0.4-fase-c-retomada` (`0e334f9`). Nenhuma
migração ou alteração de protocolo: estado 29, protocolo 3, pacotes 0.3.0.

Arquivos: avisos em `ui/format.ts` e `game/beforeLeaving.ts`, descrição da árvore
em `ui/army.ts`, Defesa ativa em `FormationList.tsx`, comandante em `HeroesPanel.tsx`,
testes unitários e cenários `12-exercito` e `13-formacoes`. A montagem continua
local até Salvar; as ordens seguem o controlador e os dados da visão.

## Entrega

- Defesa ativa pelo nome na árvore, aviso quando há soldados sem formação ativa,
  atalho em Antes de partir e botão para tirar a Defesa ativa.
- A ficha do herói informa a ala que ele comanda e o bloqueio da expedição.
- Testes da prioridade do aviso: incursão, frio, soldo e encruzilhada continuam
  prevalecendo; modo discreto e falta de conexão mantêm o comportamento.
- O cenário estreito monta, salva e ativa pelo teclado em cada um dos três temas,
  além de conferir contraste e ausência de rolagem horizontal em 720 px.
- O teste de cancelamento espera o botão habilitado e focado antes de pressionar
  Enter. A visão do lote pode chegar antes da liberação da trava de treino;
  `focus()` não aguarda habilitação. Isso trata uma possível causa da
  intermitência registrada no branch anterior, sem afirmar reproduzi-la.

## Verificação

Em andamento; resultados finais serão registrados antes do encerramento.

## Próximo marco seguro

V4C-T4: revisão independente da Fase C, correções comprovadas, medição do ouro
com treino e ferro, documentação de arquitetura e roteiro do autor. A decisão 2
do ADR 0019 exige levar a medição e propostas ao autor antes da Fase D; não
mudar custos ou introduzir soldo de soldados sem essa decisão.

Verificar na revisão o cancelamento de treino com confirmação aberta enquanto
outro lote idêntico substitui o anterior: hoje a paleta compara unidade,
quantidade e duração, sem identidade do lote. É hipótese para reprodução,
não defeito comprovado nesta sessão.

A Fase C não fecha apenas com a interface: revisão e medição continuam pendentes.
Não publicar: a primeira publicação foi combinada para o fim da Fase E, com
backup e os procedimentos operacionais do ADR 0019. O arquivo local `.hermes.md`
não faz parte desta entrega.
