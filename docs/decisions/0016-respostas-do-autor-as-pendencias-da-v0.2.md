# 0016 — Respostas do autor às pendências da v0.2

Data: 2026-10-05\
Estado: **aprovada pelo autor em 2026-10-05**, em sessão de perguntas e respostas; a implementação é o lote de correções da v0.2 (ainda não feito)\
Escopo: GDD §5.5, §5.6, §8.2, §12.1, §12.2, §13.3 e §13.5; ADRs [0013](0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (decisões 17 e 19), [0014](0014-conselho-e-ameaca-na-v0.2.md) (decisões 1, 7, 9, 10, 11 e 12) e [0015](0015-cronica-sem-o-fecho-diario-do-desperdicio.md); [pendencias-v0.2.md](../pendencias-v0.2.md)

## Contexto

A v0.2 foi implementada sem o autor, com as regras dos ADRs 0013 a 0015 "aplicadas por delegação" e cerca de 50 dúvidas anotadas em `docs/pendencias-v0.2.md`. Em 2026-10-05 o autor tinha quatro dias de jogo em produção, com outras pessoas jogando também, e disse que até ali estava tudo bem. As dúvidas foram postas a ele como perguntas, em quatro rodadas, das que mudam o jogo de quem já joga para as de apresentação. Este ADR registra o que ele respondeu.

## Decisão

### O que muda

| # | Item | Resposta do autor | Natureza |
|---|---|---|---|
| 1 | Teto dos edifícios (C-1) | A capacidade do Celeiro e do Armazém no nível 1 sobe de 900 para 1.000. O Salão nível 8 passa a caber em Senhor (5.200 contra 5.102). Rei de Ferro continua com o teto mais baixo | Conteúdo, golden, matriz do simulador, GDD §5.5 |
| 2 | Deserção por fome (C-2) | Passa a contar **tempo real**, igual ao que o ritmo Normal já dá: 12 h reais de carência e depois um aldeão a cada 2 h reais, em qualquer ritmo. A deserção **continua acontecendo na virada do dia de jogo**: na virada saem os aldeões que o prazo já deve (Rápido: um a cada três viradas; Normal: um por virada, como antes; Tranquilo: dois por virada, a cada 4 h reais). O piso de 3 aldeões fica | Regra do motor, conteúdo, golden, GDD §5.6 e §12.1 |
| 3 | Furo da fome (C-4) | A fome que reabre pouco depois de acabar é a mesma fome: o prazo da deserção continua de onde estava. A janela é de **2 h reais** sem fome: só depois dela o prazo recomeça do zero | Regra do motor, campo novo no estado, passo de migração, golden, GDD §5.6 |
| 4 | Aviso da Torre de Vigia (DE-6) | Passa a contar **tempo real**: 1 h real no nível 1 e 2 h reais no nível 2, em qualquer ritmo | Conteúdo convertido pelo ritmo, golden, matriz QA-10 nos três ritmos, GDD §8.2 |
| 5 | Sete problemas das cartas (DE-3) | Corrigir. Cada reescrita e cada número novo são mostrados ao autor antes de entrar. Os ids de carta e de opção não mudam | Conteúdo, goldens |
| 6 | Descrições das dificuldades (DE-4, B-3) | Muda o texto, não as cartas: fica a regra "quem falta não é punido" em Camponês e em Senhor, e as frases das boas-vindas passam a dizer o que acontece. As frases novas são aprovadas pelo autor antes de entrar | Conteúdo |
| 7 | Ouro da Torre (DE-8) | O objetivo 4 volta a dar 50 de ouro, além de desbloquear o Celeiro e o Armazém. Sem pagamento retroativo a quem já o cumpriu | Conteúdo, golden, matriz do simulador, GDD §12.2 |
| 8 | Barra de status (DE-12) | A fome e o frio passam na frente da carta pendente, na barra e no título da aba | App |
| 9 | Botão depois de uma incursão (DE-7) | Quando a Paliçada não pode começar, o botão é "Ver a defesa" e leva ao painel da Ameaça; deixa de ordenar a Torre | App |
| 10 | Ordem da aba Feudo (DE-15) | Os Objetivos sobem para antes do painel da Ameaça. Pede refazer as capturas da página de apresentação | App, `pnpm capture:landing` |

### O que fica como está, agora confirmado

- **A Ameaça reequilibrada** (DE-1): cresce 2 por tile por dia, cai 35 por incursão, incursão média a partir de 70.
- **As 21 cartas do Conselho** (DE-2), fora os sete problemas do item 5.
- **A obra planejada automática não olha a lenha** (C-7): a tela já avisa e cita a obra.
- **O ouro sem destino no fim da semana** (C-5): fica para a v0.3, com a Taverna, o soldo e o Mercado. Nenhum custo nem teto muda agora por causa disso.
- **Em bloco:** as leituras de regra, o desenho das telas e os textos escritos pelos agentes que as rodadas não trataram um a um. São os itens B-4 a B-15, C-6, C-9 a C-18 e DE-9 a DE-18 de `pendencias-v0.2.md`, fora o que a tabela acima muda dentro deles. O autor confirmou o conjunto com base em quatro dias de jogo, sem ler item por item.

### O que não foi perguntado

Continuam em aberto, por serem de operação ou atos do autor: B-1 (já superado pela publicação em dois passos), B-2 (sessões na restauração de backup), os atos da seção 3 das pendências (backup externo, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão, playtest, tag e release) e os dois defeitos das previsões de C-8, que precisam ser conferidos contra o commit `85a9373`.

## Consequências e verificação

- **Os ADRs 0013, 0014 e 0015 deixam de estar "à espera de confirmação"**: valem como confirmados, com as mudanças deste ADR por cima. Onde este ADR e um deles divergirem, vale este.
- **Há jogadores em produção.** Os itens 2 e 3 mudam o estado de partidas em andamento: o item 3 pede versão nova do estado e passo de migração; o item 1 aumenta a capacidade de quem já tem Celeiro e Armazém no instante em que a imagem nova sobe. Todo `push` no `main` com a CI verde é implantado sozinho: a publicação de cada parte do lote continua dependendo do pedido do autor.
- **Tempo real no motor** deixa de ser exceção de uma constante só (`council.expiryRealMs`): entram a carência e o passo da deserção e o aviso da Torre, todos convertidos com `settings.timeScale`. A regra "as mesmas ordens nos mesmos instantes de jogo dão o mesmo feudo em qualquer ritmo" passa a ter mais essas exceções.
- **Efeito por ritmo, para conferir no simulador e nos testes:** no Rápido a deserção fica três vezes mais lenta e o aviso da Torre três vezes mais longo; no Normal nada muda; no Tranquilo a deserção fica duas vezes mais rápida que hoje e o aviso da Torre cai à metade (de 2 h e 4 h reais para 1 h e 2 h).
- **A deserção não ganha instante próprio na linha do tempo.** O autor escolheu mantê-la na virada do dia, contando ali quantos aldeões o prazo real já deve; a ordem fixa do mesmo instante não muda. O estado passa a guardar quantos já desertaram na fome corrente e quando a última fome acabou (versão nova do estado).
- **Commits e publicação da Fase G:** um commit local por tarefa, com o portão verde; `push` só quando o autor mandar.
- Cada item de regra entra com conteúdo, golden, GDD e teste no mesmo commit, como manda a regra 8 do projeto. Nenhum número proposto aqui foi simulado ainda.
