# Relatório da v0.3: o que foi implementado

> Escrito em 2026-10-07, na manhã do dia de publicação, a partir do Registro de execução do [roadmap da v0.3](roadmap-v0.3.md) (§12), de [pendencias-v0.3.md](pendencias-v0.3.md), de [balance-v0.3.md](balance-v0.3.md) e do histórico do `main` (cerca de 190 commits desde `7bff36b`). O formato é o de [relatorio-v0.2.md](relatorio-v0.2.md). Onde o Registro ainda não tinha a linha de uma tarefa (a revisão da Fase E, a Fase F), o texto diz o que o histórico mostra e **não** inventa contagens.

## O que NÃO foi feito nem verificado, dito antes de tudo

- **Ninguém jogou.** O autor não jogou nenhuma fase antes da seguinte (os roteiros de 15 minutos das Fases C e D, em pendencias-v0.3.md, seções 7 e 8, nunca foram executados). Nenhum playtest com outras pessoas aconteceu, **nem o desta versão, nem o da v0.1 e o da v0.2**: não há linha de base de pessoas. Se a versão diverte, ninguém sabe.
- **O conteúdo narrativo é rascunho que o autor não leu**: os 18 grafos de expedição e as frases dos relatórios, os dez candidatos da Taverna, os heróis com nome (Edda e Rolf), a carta da estrangeira, os Mestres, as cartas do lote 2 do Conselho, as frases novas das dificuldades ([content-v0.3.md](content-v0.3.md)). Ele pediu "escrevo e sigo; você revisa depois".
- **As decisões 1 e 4 a 21 foram aprovadas em bloco**, sem leitura item a item; só a 3 e a 6 foram respondidas uma a uma. Os números que o GDD não tinha (classes, traços, candidatos, a tabela do soldo por nível) foram propostos pelo agente.
- **Nenhuma partida real de produção atravessou a migração** do estado 12 para o atual; só retratos congelados (25 da versão 12 e, ao todo, retratos de cada versão). O **ensaio de reversão com imagens nunca foi feito**, e o backup fora do servidor e a cópia do `RECOVERY_CODE_SECRET` fora do Coolify continuam pendentes (ato 23).
- **Só Chromium.** Firefox, Safari, celular e leitor de tela nunca foram abertos.
- **O balanceamento de fechamento** (V3G-T1) e o desempenho com 50 bots não estão registrados (a seção 15 de balance-v0.3.md está reservada e vazia). Cada fase teve a sua rodada da matriz; a de fechamento, com todos os perfis, ritmos e dificuldades e os extremos repetidos à mão, não.
- **O ouro parado não caiu** com nenhuma das fases (C-23): o soldo por nível, o Mercado e as caravanas não deram destino ao ouro no primeiro ano. Fica para a v0.4.
- **Primeira publicação ao vivo**: a produção salta do estado 12 direto para o da versão e do protocolo 2 para o 3. A CI do commit final e o `docker build` não foram conferidos por este documento.
- **O lote 2 do Conselho** estava em implementação por outra sessão ao escrever; quais cartas entraram está em [content-v0.3.md](content-v0.3.md).

## Resumo

**O que o jogador ganha com a v0.3 "A Guilda":**

- **Uma equipe.** O primeiro herói chega por uma carta do Conselho (a "Estrangeira ferida", no 13º dia de jogo, também para partidas que já passaram dele). Heróis têm classe, traços, atributos, nível, experiência, soldo e equipamento. A **Taverna** oferece candidatos que trocam em rotação, e tem festival e moral.
- **Soldo.** Cada herói consome ouro por hora de jogo, e o soldo cresce com o nível. Se o ouro acaba, o atraso tem prazos em **tempo real** (12 h para o Descontente, 24 h para a primeira partida, 2 h entre as seguintes): uma noite de sono não custa um herói.
- **Expedições.** A **Guilda dos Aventureiros** manda equipes a seis destinos (Patrulha, Floresta Antiga, Covil de Lobos, Resgate, Ruínas de Vel'Thar e Pântano Nebuloso), com três variantes cada. A equipe para na **encruzilhada** e espera até **12 h reais**: sem resposta, segue a **Postura** (Cautelosa, Equilibrada ou Ousada). O desfecho vem em um **relatório nó a nó**. Há ferimento, captura e Resgate (e morte em Rei de Ferro), experiência, itens e o Covil de Lobos que pode ser limpo.
- **Mercado.** Preços que andam a cada dia, compra, venda e **volume diário** por recurso; **caravanas** a Porto do Rio, que podem ser emboscadas sem escolta; **Mestres** que dão +15% ao edifício.
- **Objetivos 11 a 16**, o **Retorno** e "Antes de partir" com a Guilda e o Mercado, e as abas **Guilda** e **Mercado**.

## Como a versão foi feita

Por agentes de código, em sessões dirigidas por um orquestrador, entre 2026-10-05 e 2026-10-07, **tudo no `main`, sem branches de fase** (decisão 2, trocada pelo autor), com um commit por tarefa e `push` só quando o autor mandar. Cada fase seguiu o mesmo desenho: tarefas de conteúdo, motor, protocolo, servidor, simulador e app; um portão (`pnpm verify`, integração, `pnpm build`, navegador, página de apresentação) conferido pelo código de saída; **uma revisão independente de leitura** e correções, um commit por defeito; a medição no simulador; e a atualização do Registro. Nas Fases D a F, o trabalho de execução rodou em **subagentes no Sonnet** e a revisão e a integração arriscada ficaram com o modelo maior (pedido do autor de 2026-10-06), e **árvores de trabalho separadas** permitiram trilhas em paralelo (app e motor), juntadas por commit de mesclagem. A regra "nenhuma mecânica de versão futura entra, nem como campo vazio" foi mantida: não há exército, formação, cerco, ferro, presságio, relíquia nem mapa gráfico.

## O que foi feito, por fase

### Fase A: herança e decisões (V3A-T1 e T2, 2026-10-05)

- **Portão e linha de base.** `pnpm verify` (94 arquivos, 5.162 testes e 1 falha esperada), integração (23 arquivos, 468), `pnpm build`, navegador (95) e página (37 e 7 pulados), todos com saída 0. Linha de base em balance-v0.3.md, seção 1: matriz nas três dificuldades (2.700 partidas dentro das faixas, as 54 linhas iguais a `MEASURED`), o ouro parado por perfil, tamanho do estado (2 a 3,5 kB) e da visão (15,5 a 18,5 kB).
- **As decisões 1 a 21** fechadas em uma sessão de perguntas: ADRs [0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md), GDD na versão 0.8. Não verificado: se alguma partida de produção foi recusada no passo 11 para 12.

### Fase B: fundação (V3B-T1 a T3, 2026-10-05)

- Estado na **versão 13**: contadores de identidade (`state.ids`, `nextId`) e fluxos de sorteio por entidade (`expedition:` e `caravan:`, apagados quando a entidade termina), com guarda de forma; dois retratos novos da versão 12 (25 congelados). Bot `explorador` e 19 colunas reservadas da Guilda no simulador.
- **Revisão independente: 0 defeitos confirmados, 7 riscos (R1 a R7) e 4 dúvidas (D1 a D4).** Corrigidos um a um (por exemplo, R3: o fluxo de entidade passa a exigir `<família>:<família>-<n>` com `n` dentro do contador).
- Portão da integração: `pnpm verify` 96 arquivos, 5.579 testes e 1 falha esperada; integração 23 arquivos, 478; navegador 95.

### Fase C: heróis e Taverna (V3C-T1 a T5, 2026-10-05 e -06)

- **V3C-T1** (estado 14): heróis, soldo e atraso; o atraso abre no instante em que o ouro acaba, consequências cobradas na virada do dia, 25 retratos da versão 13 congelados.
- **V3C-T3** (estado 15): a carta roteirizada "Estrangeira ferida", o efeito `addHero`, Edda e Rolf, a lista dos prometidos; chega também a partidas que já passaram do dia 13.
- **V3C-T2** (estado 16): a Taverna (candidatos, contratação, moral, festival), dez modelos de candidato, 24 nomes.
- **V3C-T4**: a aba Guilda e a Taverna na interface, com `guild.text` e `guild.dismissText` na visão.
- **V3C-T5, revisão independente em duas frentes. Motor e servidor: 2 defeitos confirmados, 6 riscos, 5 dúvidas. App: 3 defeitos, 8 riscos, 3 dúvidas.** Cerca de 30 commits `V3C: corrige …`. O mais importante: o atraso do soldo (e a deserção por fome da v0.2) que escapava da cobrança fechando logo antes da virada: **mudança de regra, confirmada pelo autor**.
- **Portão da integração:** `pnpm verify` 110 arquivos, 7.356 testes e 1 falha esperada; integração 23 arquivos, 499; navegador: **102 passaram e 1 falhou na primeira rodada** (um cenário que achava a linha do candidato pelo texto do nome), corrigido e rodado de novo.
- **Respostas do autor em 2026-10-06:** "o que venceu é cobrado"; a janela do atraso "fica assim"; a Fase C não é publicada sozinha.

### Fase D: expedições (V3D-T0 a T5, 2026-10-06)

- **V3D-T1** (estado 17, **protocolo 3**): o motor das expedições, a Guilda, dois grafos provisórios. **V3D-T2** (estado 18): ferimento, captura, Resgate, morte, equipamento, itens, Covil limpo. **V3D-T3** (estado 19): o catálogo completo, seis modelos e 18 grafos, o relatório nó a nó, as fichas da §13.4 do roadmap. **V3D-T4**: as expedições na interface.
- **V3D-T5, revisão independente em três frentes, todas de leitura. Motor, conteúdo, protocolo, servidor e simulador: 2 defeitos confirmados (1 de regra, 1 de medição), 8 riscos e 4 dúvidas. App: 8 defeitos confirmados (A1 a A8), riscos A9 a A16, lacunas de navegador A17 a A22. Editorial dos 18 grafos: 9 defeitos confirmados (B1 a B9) e 12 riscos (B10 a B21).** Foram **52 commits** de correção (27 de motor, conteúdo e simulador, 25 do app). O de regra: o cativo resgatado durante o atraso voltava devendo o atraso inteiro (estado 20).
- **Respostas do autor em 2026-10-06:** a espera da encruzilhada passa para **12 h reais** (D-71); as variantes ficam como estão (D-54); os lobos do outono ficam (D-24); capturado não conta no limite (D-17); as dificuldades dizem o que acontece aos heróis (D-25); o ouro parado é medido depois da Fase E (C-23).
- **Portão da integração:** `pnpm verify` 120 arquivos, 9.579 testes e 1 falha esperada; integração 25 arquivos, 531; navegador 115 e o cenário "no ritmo" no ritmo 3; página 37 e 7 pulados. A mudança para 12 h quebrou 17 testes do motor, 14 do app e 6 do simulador, todos testes e goldens que fixavam a regra.
- A medição: quem visita duas vezes por dia, a 12 h exatas, decide 100% das encruzilhadas; quem visita uma vez, 0%. **O ouro parado não caiu.** Não verificado: o jogador de duas visitas irregulares.

### Fase E: Mercado, caravanas e Mestres (V3E-T1 a T5, 2026-10-06 e -07)

- **V3E-T1** (estado 21): preço, compra, venda e volume diário. **V3E-T2** (estado 22): caravanas. **V3E-T3** (estado 23): Mestres. **V3E-T4**: a aba Mercado, a negociação em duas etapas, as caravanas e os Mestres na interface, a ordem `sendCaravan` com o dia da cotação (`PRICE_CHANGED`), a linha da árvore, avisos, retorno. Portão do T4: `pnpm verify` 135 arquivos, 11.092 testes e 1 falha esperada (523 s); integração 27 arquivos, 564; navegador 130 (15 cenários novos em `10-mercado.spec.ts`; **1 falha na primeira rodada**, a ordem das setas da árvore que não conhecia a linha "Mercado"); `pnpm capture:landing` refeito.
- **V3E-T5, revisão independente da Fase E** (a linha ainda não estava no Registro ao escrever; o que o histórico mostra): cerca de 20 commits `V3E: corrige …`, entre eles a escolta ou expedição perpétua que blindava o herói do soldo em atraso, as guardas do estado que deixavam passar um Mercado impossível, os nomes invertidos nos eventos de Mestre, a carga perdida lida como corte de depósito, a conferência velha e o foco do Mercado, a emboscada barrada pela cota de avisos. **As contagens exatas (defeitos, riscos e dúvidas) não estão no Registro**: ver pendencias-v0.3.md, seção 5, "Fase E: a revisão independente no motor, no conteúdo e no simulador (V3E-T5)".
- **Respostas do autor em 2026-10-07** (balance-v0.3.md, seção 14): a caravana paga **+15% sobre o balcão** (a arbitragem dava lucro certo); **o soldo cresce com o nível** (2 a 20 por hora de jogo); **o piso de população protege 3 aldeões**; **a primeira alocação do Mestre é imediata** (estado 24). O soldo por nível baixou a soma do ouro final em 0,29% a 0,45% por dificuldade: **não é vitória**, porque os heróis não passam do nível 3 em um ano de jogo.

### Fase F: lote 2 do Conselho e objetivos (V3F-T1 a T4)

- **V3F-T2**: objetivos 11 a 16 do Senhor (primeiro herói, Guilda, Patrulha, venda no Mercado, encruzilhada, Ruínas). **V3F-T3**: o Relatório de Retorno e "Antes de partir" com a Guilda e o Mercado (uma linha por expedição, a marca da Postura, vendas, a venda em "ainda pode decidir"), com cenário em navegador. **V3F-T1**: o lote 2 do Conselho, **em implementação por outra sessão** ao escrever; as cartas que entraram estão em [content-v0.3.md](content-v0.3.md). Sem linha de Registro nem contagens de portão no momento desta escrita.

### Fase G: fechamento (V3G-T1 a T5)

- **V3G-T2 e T3 (documentos)**: [acceptance-v0.3.md](acceptance-v0.3.md), [manual-test-v0.3.md](manual-test-v0.3.md), o [convite](playtest/convite-v0.3.md), o [formulário](playtest/formulario-v0.3.md) e o esqueleto do [relatório de playtest](playtest/relatorio-v0.3.md). Nada disso foi executado por pessoas.
- **V3G-T4**: o `CHANGELOG.md` com a seção 0.3.0, a versão 0.3.0 nos oito pacotes e a página de apresentação sem a Guilda no horizonte. A tag e a release são do autor.
- **V3G-T5**: o [esqueleto do roadmap da v0.4](roadmap-v0.4.md), com status "proposto, sem nenhuma tarefa executada".
- **V3G-T1**: não aconteceu como tarefa fechada (a matriz de fechamento e o desempenho não estão registrados).

## As quatro rodadas de decisões do autor

| Data | O que o autor respondeu |
|---|---|
| 2026-10-05 | As decisões 1 a 21 (ADRs 0017 e 0018). Uma a uma: **3** (soldo em atraso em tempo real) e **6** (a carta chega a quem já passou do dia 13). **2 trocada** (tudo no `main`, `push` em versão estável). As outras, em bloco. Conteúdo narrativo: "escrevo e sigo; você revisa depois" |
| 2026-10-06 (Fase C) | "O que venceu é cobrado" (soldo e fome); a janela do atraso "fica assim"; a Fase C não vai ao ar sozinha |
| 2026-10-06 (Fase D, duas levas) | Lobos do outono mantidos; capturado não conta no limite; frase nova nas dificuldades; **12 h reais** na encruzilhada; variantes ficam; ouro parado medido depois da Fase E; subagentes no Sonnet |
| 2026-10-07 (Fase E) | Caravana +15% sobre o balcão; soldo por nível; piso de 3 aldeões; primeira alocação do Mestre imediata |

## O que as revisões independentes acharam

| Fase | Defeitos confirmados | Riscos | Dúvidas |
|---|---:|---:|---:|
| B | 0 | 7 | 4 |
| C, motor e servidor | 2 | 6 | 5 |
| C, app | 3 | 8 | 3 |
| D, motor, conteúdo e simulador | 2 | 8 | 4 |
| D, app | 8 | 8 (A9 a A16), mais 6 lacunas | n/c |
| D, editorial | 9 | 12 | 4 |
| E | não registrado (ver acima) | n/c | n/c |
| F | ainda não feita | | |

**Em toda fase, a revisão achou defeito real depois do portão verde**, exceto a Fase B (só riscos). Os defeitos de regra (o furo da cobrança na virada, o cativo devendo o atraso, a escolta que blindava do soldo) eram dos que testes escritos pelo mesmo autor do código não encontram.

## Números de teste do último portão registrado (Fase E, T4)

`pnpm verify`: 135 arquivos, 11.092 testes e 1 falha esperada; integração: 27 arquivos, 564 testes; navegador: 130; página de apresentação: 37 passaram e 7 pulados. Depois disso entraram a revisão da Fase E, as respostas de 2026-10-07 e as Fases F e G, **sem um portão completo registrado**: antes de publicar, rodar o portão inteiro e conferir a CI do commit.

## Para o autor

O que ele precisa fazer, em ordem: ler os três pendentes de [pendencias-v0.3.md](pendencias-v0.3.md), seção 3; fazer o backup manual (e, de preferência, o externo) antes do `push`; jogar o [roteiro manual](manual-test-v0.3.md); preencher o [quadro de aceitação](acceptance-v0.3.md); criar a tag `v0.3.0`; só então convidar pessoas ([convite](playtest/convite-v0.3.md)). Depois, a [v0.4](roadmap-v0.4.md).
