# Modelo do relatório de playtest

Copiar este arquivo para `docs/playtest/relatorio-<versão>.md` (o primeiro é `relatorio-v0.1.md`, tarefa V2A-T1 do [roadmap da v0.2](../roadmap-v0.2.md)) e preencher. O que não foi medido fica escrito como "não medido", e não em branco. Nada de nome de pessoa, e-mail, identificador de conta ou Código do Reino: os participantes aparecem como P1, P2…

Apagar este parágrafo e as linhas em itálico ao preencher.

---

# Playtest da v‹versão› — relatório

## 1. Resumo

*Três a cinco linhas: quantas pessoas, o que mais confundiu, se voltaram no segundo dia, e o que foi decidido.*

## 2. Participantes e período

| | |
|---|---|
| Início (data, hora e fuso) | |
| Fim (data, hora e fuso) | |
| Convidados | |
| Criaram conta | |
| Responderam o formulário | |
| Versão em produção (`/v1/version`: `server` e `builtAt`) | |
| Ritmo das partidas (`GAME_TIME_SCALE`) | |
| Houve deploy durante o período? | |
| O que as pessoas receberam (só o endereço do jogo, ou também a página de apresentação) | |

| Participante | Perfil (uma linha, sem identificar) | Navegador e aparelho | Respondeu o formulário |
|---|---|---|---|
| P1 | | | |
| P2 | | | |
| P3 | | | |

## 3. Métricas das consultas

Consultas do bloco "Métricas do playtest" de [`deploy/analytics/ops.sql`](../../deploy/analytics/ops.sql), rodadas no terminal do banco `lotg-db` no Coolify (`psql -U lotg lotg`). Colar a saída como veio.

| | |
|---|---|
| Rodadas em (data e hora) | |
| Filtro de período aplicado à CTE `jogadores` | |
| Conta do autor fora das métricas? | |
| Contas "Bot …" fora das métricas? | Sim (já é o padrão das consultas) |

O que estas métricas **não** veem: leituras não ficam gravadas, então uma visita sem nenhuma ordem não conta como sessão nem como retorno. As proporções são um piso.

### 3.1 Sessões por dia

```
(saída)
```

### 3.2 Comandos por sessão e duração

```
(saída)
```

### 3.3 Tempo até o primeiro comando

```
(saída)
```

### 3.4 Retorno no dia 2

*A consulta só inclui um dia de criação depois que o dia seguinte terminou (calendário de São Paulo). Tabela vazia quer dizer "cedo demais", e não "ninguém voltou".*

```
(saída)
```

### 3.5 Contexto

*"Contas: total, vinculadas ao GitHub, com Código do Reino e em exclusão" e "Comandos por tipo e resultado", do começo do arquivo.*

```
(saída)
```

### 3.6 Leitura

| Métrica | Valor | O que diz |
|---|---|---|
| Contas que deram ao menos um comando | | |
| Mediana do tempo até o primeiro comando | | |
| Sessões por conta por dia | | |
| Mediana de comandos por sessão | | |
| **Retorno no dia 2** (contas que voltaram ÷ contas criadas) | | |
| Recusa mais frequente (tipo e motivo) | | |
| Contas que geraram Código do Reino | | |

## 4. Respostas do formulário

Perguntas de [formulario.md](formulario.md).

### 4.1 Abertas

| Participante | 1. O que confundiu | 2. O que faltou | 3. Vontade de voltar | 8. O que quebrou |
|---|---|---|---|---|
| P1 | | | | |
| P2 | | | | |
| P3 | | | | |

### 4.2 Objetivas

| Pergunta | Contagem por opção |
|---|---|
| 4. Vezes que abriu o jogo | |
| 5. Tempo para entender | |
| 6. Ritmo | |
| 7. Navegador e aparelho | |
| 9. Continuaria jogando | |

## 5. Achados

Uma linha por achado. Classe proposta pelo agente e **decidida pelo autor**.

| Classe | Significado |
|---|---|
| **P0** | Bloqueia: a pessoa não conseguiu jogar, perdeu o feudo, ou o jogo mostrou algo errado sobre o estado |
| **P1** | Atrapalha: jogou, mas travou, entendeu errado ou desistiu por causa disso |
| **P2** | Melhoria: seria melhor, mas ninguém parou por isso |
| **P3** | É de outra versão: pede mecânica que o GDD põe na v0.2 ou depois |

| # | Achado | Origem (formulário, mensagem, consulta) | Quantas pessoas | Classe | Destino (tarefa, commit ou "não será feito", com o motivo) |
|---|---|---|---:|---|---|
| 1 | | | | | |
| 2 | | | | | |

## 6. Decisões

*O que o autor decidiu a partir do relatório, com a data. Inclui a resposta à pergunta de balanceamento de V2A-T2.3, quando houver.*

| Data | Decisão | Onde fica registrada (ADR, GDD, tarefa) |
|---|---|---|
| | | |

## 7. Limites deste playtest

*O que o relatório não permite concluir: tamanho da amostra, quem não respondeu, navegadores não cobertos, problemas de produção durante o período, métricas não medidas.*
