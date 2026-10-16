# Pendências e dúvidas da v0.4

> **Para ler primeiro.** A v0.3.0 está no ar desde 2026-10-15 (estado 24, protocolo 3). Em 2026-10-16 o autor respondeu, uma a uma, às decisões do lote 1 da v0.4 e à herança da v0.3: todas com a premissa recomendada ([ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)). Este arquivo é a caixa de entrada do autor durante a v0.4, no molde de [pendencias-v0.3.md](pendencias-v0.3.md). Cada item diz o que vale enquanto não houver resposta.

## 1. O mais importante

1. **Os números das Fases B e C foram aprovados em 2026-10-16** (V4A-T2.5; [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), "Números propostos"): durabilidade 8/10/14/20, reparo a 1 ou 2 ferro por ponto, e o resto da tabela em bloco. A Fase B pode começar.
2. **A v0.4 começa sem ninguém ter jogado a v0.3** (V4A-T1.9). Nem você, nem outras pessoas, e o conteúdo dela (18 grafos, frases da Taverna, cartas, objetivos) continua rascunho que você não leu. A lição 8 da v0.3 diz que isso é o que mais custa no fim.
3. **O ato 23 precisa acontecer antes da primeira publicação da v0.4**, no fim da Fase E (decisão 26): backup fora do servidor, cópia do `RECOVERY_CODE_SECRET` fora do Coolify e o ensaio de reversão com imagens atravessando uma migração de estado. A v0.3 subiu doze versões de estado sem ele.
4. **A migração da v0.3 em produção não foi conferida no banco** (V4A-T1.1). O arranque migrou 4 partidas sem falha; falta o SQL de [deploy/README.md](../deploy/README.md) dizer que nenhuma partida ativa ficou abaixo de `schema_version = 24`.
5. **O lote 2 de decisões** (15 a 24: Horda, presságios, sabotagem, Cerco, milícia, Crônica do Ano, cartas, objetivos 17 a 21) só trava a Fase E e tem sessão própria (V4E-T0, ADR 0020). As premissas estão no [roadmap](roadmap-v0.4.md), §11.2.

## 2. O que continua aberto da v0.3

O registro completo está em [pendencias-v0.3.md](pendencias-v0.3.md). Respondidos em 2026-10-16 (ADR 0019): F-1 (o objetivo 12 fica), F-3 (o lote 2 vai para a Fase H; decisão 1), F-4 (o alarme passa do limite de 3 por hora; GDD §13.5), E-51 e E-54 (as marcas da Crônica e o soldo por nível, aprovados) e B-2 (as sessões não são reimportadas numa restauração). O que sobra:

| Item | O que é | Vale enquanto não houver resposta |
|---|---|---|
| **F-5** | A partida migrada que já voltou das Ruínas não conta o objetivo 16 | Nada: a produção nasceu na v0.3 já com o contador. Se aparecer, uma acomodação que some os relatórios |
| **F-6** | A ordem dos itens de "Antes de partir" não é a da V3F-T3.1 | A ordem do código |
| **P1 a P3** (plausíveis da revisão da Fase F) | O depósito que pode aparecer em dois blocos do Retorno; a caravana sem escolta como "alerta"; a marca da Postura entre duas visitas | Nada, até alguém ver na tela |
| **E-55 a E-60** | Decisões do agente na revisão da Fase E (o excedente como reserva simples, nomes no estado, o especulador) | Como estão |
| **"Ouro com destino"** | O ouro parado não caiu na v0.3 (menos de 0,5%) | A decisão 2: medir depois do Quartel (V4C-T4.3) e voltar com propostas antes da Fase D |
| **O conteúdo da v0.3** | 18 grafos, relatórios, Taverna, cartas da estrangeira, objetivos 11 a 16: rascunho | Fica como está; mudar uma frase é conteúdo, golden e GDD no mesmo commit |

## 3. O que só o autor pode fazer

| # | O quê | Quando |
|---|---|---|
| 27 | Conferir `schema_version = 24` no banco e o log do job; criar a tag `v0.3.0` e a release | Antes da Fase B |
| 28 | O ato 23: backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão | Antes do fim da Fase E |
| 29 | Jogar a v0.3 ([manual-test-v0.3.md](manual-test-v0.3.md)) e preencher [acceptance-v0.3.md](acceptance-v0.3.md); ler [content-v0.3.md](content-v0.3.md) | Quando puder; de preferência antes da Fase B |
| 30 | Playtest com outras pessoas (nunca houve, em versão nenhuma) | Depois da segunda publicação da v0.4 |
| 31 | Os oito pontos do ADR 0012 e o vínculo GitHub | Sem trava |

## 4. As decisões da v0.4

**Lote 1 (decisões 1 a 14, 25 e 26): respondido em 2026-10-16**, todas com a premissa recomendada ([ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)).

**Os números das Fases B e C (V4A-T2.5): aprovados em 2026-10-16** (ADR 0019, "Números propostos").

**Lote 2 (decisões 15 a 24): a decidir, na sessão V4E-T0.** Premissas recomendadas no [roadmap](roadmap-v0.4.md), §11.2:

| # | Decisão | Premissa recomendada, em uma linha |
|---|---|---|
| 15 | A Horda aprende | Guarda só a última formação vista; peso pela estação e pela astúcia da dificuldade; sem memória entre anos |
| 16 | Tiles e datas | A Fortaleza nasce no outono e volta todo ano; o Acampamento no 25º dia de jogo; a Torre Nv3 a Nv5 avisa com 3, 4 e 5 h reais |
| 17 | Sabotagem | Só no outono, 3 heróis, até 3 por ano; cada Sucesso tira 15% de uma onda |
| 18 | Presságios e as ondas | As ondas são geradas no outono e regeradas a cada formação nova vista; o presságio nunca mente sobre a versão atual |
| 19 | O Cerco e a Queda | Ondas 40/60/80 e o Senhor da Guerra; a Queda custa 30% dos recursos, 20% da população e dois níveis dos dois maiores edifícios, sem sorteio |
| 20 | Plano de Batalha | Uma formação por onda; 60 min reais entre ondas para trocar e pedir reparo; sem reparo automático |
| 21 | Milícia | Só com incursão forte ou cerco marcado; até 50% dos aldeões; dissolve ao fim |
| 22 | Rescaldo e Crônica do Ano | Luto e festa na moral; a Crônica do Ano montada pelo servidor; "Avançar para o Degelo" não entra |
| 23 | Os lotes 2 e 3 de cartas | 38 cartas, apresentadas em lotes de cinco antes da transcrição |
| 24 | Objetivos 17 a 21 | Os cinco do GDD entram; os sazonais não |

## 5. Dúvidas levantadas durante a implementação

*Vazia. Cada tarefa acrescenta aqui o que decidiu sem o autor, com o que vale enquanto não houver resposta.*

## 6. O que não foi verificado

*Por tarefa, no Registro do [roadmap](roadmap-v0.4.md), §15.*
