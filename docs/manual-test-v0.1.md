# Roteiro manual da v0.1

Um roteiro por critério de aceitação do GDD §16.1 (MVP-ROADMAP.md §8). Serve para o que só um VS Code de verdade prova: temas, teclado, foco, tempo de clique.

> **Estado em 2026-10-01:** nenhum passo deste roteiro foi executado em um VS Code real. A extensão foi exercitada só por testes automatizados, inclusive `tests/client/extension.test.ts`, que a ativa com um editor de mentira contra o servidor real. A coluna "Automático" diz o que esses testes já cobrem; a coluna "Manual" está em branco, à espera da primeira execução.

## Preparação

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api                       # deixa rodando: http://localhost:3000/v1/health
pnpm --filter @lotg/webview build && pnpm --filter lords-of-the-guild build
```

No VS Code, abra a pasta do repositório e aperte **F5** ("Extensão (Extension Development Host)"). Uma segunda janela abre com a extensão carregada.

**Segunda máquina.** Para simular outra máquina, abra outro perfil com dados separados:

```bash
code --user-data-dir /tmp/lotg-b --extensionDevelopmentPath="$PWD/packages/extension"
```

**Relógio.** O mundo anda no tempo real do servidor. Para testar ausências longas sem esperar, pare a API, ajuste a data da partida no banco e suba de novo:

```bash
pnpm db:psql -c "update games set created_at = created_at - interval '5 hours', last_processed_at = last_processed_at - interval '5 hours' where status = 'active'"
```

Em cada critério, anote em "Evidência" uma captura de tela ou a saída do comando, com a data.

## Critérios

### 1. Jogar agora e primeiro comando em menos de 30 s, sem e-mail nem senha

| Passo | Esperado |
|---|---|
| Com um perfil limpo, clicar no ícone da torre na Activity Bar e em **Jogar agora** | Abre o painel de boas-vindas com exatamente dois campos: quem governa e nome do feudo |
| Preencher o nome, manter "Pedra Alta", clicar em **Jogar agora** e, no painel, apertar **+** na Fazenda | O painel Feudo aparece; a comida passa de −5/h para +5/h |
| Cronometrar do clique no ícone ao **+** | Menos de 30 segundos |

Automático: `tests/client/extension.test.ts` ("Jogar agora": dois campos, um clique, duas requisições). O tempo não é medido.
Manual — data: ____ · resultado: ____ · evidência: ____

### 2. Alocar um trabalhador muda a taxa imediatamente e reduz os livres

| Passo | Esperado |
|---|---|
| Na aba Feudo, apertar **+** na Serraria | Madeira/h sobe 8 em menos de 1 s; "Livres" cai 1 |
| Passar o mouse (e depois focar com Tab) sobre a taxa | Aparece a explicação: "1 trabalhador × 8 × 1 (Nv1) = 8/h" |
| Na árvore, usar o **+** e o **−** ao lado de Serraria | O mesmo efeito, refletido no painel |
| Clicar no próprio item da Serraria ou de uma melhoria na árvore | Só abre o painel; nenhuma ordem é dada. A obra começa pelo botão de seta do item |

Automático: motor (`population.test.ts`), extensão (ordem pelo painel; mais e menos na árvore).
Manual — data: ____ · resultado: ____ · evidência: ____

### 3. Não alocar mais que a população nem gastar o que não existe; motivo visível

| Passo | Esperado |
|---|---|
| Com todos alocados, apertar **+** em outro edifício | O botão está desabilitado |
| Paleta: **Lords: Alocar trabalhadores…**, escolher um edifício e digitar 99 | O campo recusa: "Só há N disponíveis para …" |
| Paleta: **Lords: Construir ou melhorar…** e escolher o Salão do Senhor logo no início | Aviso: "Faltam 30 madeira e 35 pedra." |
| No painel, a linha do Salão em "Disponíveis" | Botão desabilitado, chips com "(faltam …)" e o motivo por extenso |

Automático: motor (um teste por código de recusa), extensão (recusa no painel e na paleta).
Manual — data: ____ · resultado: ____ · evidência: ____

### 4. Melhoria desconta uma vez, ocupa a fila e conclui no tempo

| Passo | Esperado |
|---|---|
| Clicar em **Melhorar** nas Habitações (80 madeira, 20 pedra, 4 min) | Madeira e pedra caem uma vez; aparece a obra ativa com contagem regressiva por segundo e barra de progresso |
| Tentar melhorar outro edifício | Botões desabilitados: "Os pedreiros já estão ocupados com outra obra." |
| Esperar os 4 minutos | A obra some, "Habitação" passa a 5/15, a Crônica ganha a linha, a barra de status volta ao padrão |
| `pnpm db:psql -c "select kind, at from game_events order by seq desc limit 3"` | Há um `constructionFinished` |

Automático: motor (`construction.test.ts`), servidor (`games.test.ts`), extensão (a obra termina sem o jogador agir).
Manual — data: ____ · resultado: ____ · evidência: ____

### 5. Reabrir após horas simula o intervalo sem duplicar

| Passo | Esperado |
|---|---|
| Com 2 na Fazenda, anotar a comida; fechar a janela do Extension Development Host | — |
| Recuar a partida 5 horas (comando da Preparação) e abrir de novo com F5 | O painel **não** abre sozinho; a view ganha um badge e a barra de status mostra o sino com as novidades; nenhuma notificação avulsa dos eventos da ausência |
| Abrir o painel | Abre na aba **Hoje**, com o Relatório de Retorno: "Você esteve fora por 5 horas", comida +75 |
| Conferir a aba Feudo | A comida é a anotada + 75; nada duplicado |

Automático: motor (propriedade de divisão de intervalo), extensão (reabrir após horas).
Manual — data: ____ · resultado: ____ · evidência: ____

### 6. Escassez correta em longos períodos, com o instante exato na Crônica

| Passo | Esperado |
|---|---|
| Tirar todos da Fazenda; recuar a partida 40 horas; reabrir | Banner "Fome em andamento"; barra de status "$(warning) Fome em Pedra Alta"; comida 0, nunca negativa |
| **Lords: Exportar Crônica (Markdown)** | Há a linha "…as despensas de Pedra Alta ficaram vazias. A fome começou." |
| Pôr 2 na Fazenda | O banner some; a Crônica registra o fim da fome |

Automático: motor (`famine.test.ts`, teste de 30 dias), extensão (a fome avisa).
Manual — data: ____ · resultado: ____ · evidência: ____

### 7. Reinício do servidor, reenvio e dois clientes

| Passo | Esperado |
|---|---|
| Iniciar uma obra; parar a API (Ctrl+C) e subir de novo | Nada se perde; a obra segue com o tempo certo |
| Subir a API em Docker e reiniciar: `docker compose -f deploy/docker-compose.dev.yml --profile full restart api` | Idem |
| Com dois perfis na mesma conta (critério 10), dar ordens alternadas | Os dois painéis convergem em até 30 s; nenhuma ordem aplicada duas vezes |

Automático: servidor (`games.test.ts`: recibos, conflito de UUID, 10 comandos em paralelo), `tests/server/scenarios.test.ts` (reinício no meio do dia).
Manual — data: ____ · resultado: ____ · evidência: ____

### 8. Regras rodam em testes sem VS Code

```bash
pnpm --filter @lotg/engine test
```

Esperado: todos verdes, sem editor aberto.
Automático: é o próprio critério. Última execução: 2026-10-01, 192 testes verdes.

### 9. Tema claro e escuro; navegável por teclado

Repetir em **Dark Modern**, **Light Modern** e **Dark High Contrast** (`Ctrl+K Ctrl+T`):

| Passo | Esperado |
|---|---|
| Olhar o painel em cada tema | Texto legível, bordas visíveis, nenhuma cor "de outro tema" |
| Percorrer o painel só com **Tab** e **Shift+Tab** | A ordem segue a leitura; o foco é sempre visível |
| Com o foco numa linha de trabalhadores, apertar **+**, **−**, **↑** e **↓** | Aloca, desaloca e anda entre os edifícios |
| Focar uma taxa com Tab | A explicação aparece, como no mouse |
| Estreitar o painel até cerca de 480 px | Sem rolagem horizontal; as duas colunas viram uma |
| Jogar 10 minutos só pela paleta (`Ctrl+Shift+P`, "Lords:") | Tudo que o painel faz tem comando; anotar fricções abaixo |
| Ligar "reduzir movimento" no sistema | Nada se anima |

Automático: `webview.test.tsx` confere que o CSS não tem cor fixa e que há rótulos ARIA. Aparência e foco não são verificáveis sem o editor.
Manual — data: ____ · resultado: ____ · evidência: ____
Fricções da paleta: ____

### 10. GitHub ou Código do Reino em outra máquina mostra o mesmo feudo

| Passo | Esperado |
|---|---|
| **Lords: Gerar Código do Reino** | Modal com o código e o aviso de exibição única; **Copiar** põe na área de transferência |
| No segundo perfil: **Usar Código do Reino** e colar | O mesmo feudo aparece em segundos |
| No primeiro perfil: **Lords: Vincular conta ao GitHub** | Login nativo do VS Code; a árvore mostra "Conta: … · GitHub" |
| Em um terceiro perfil limpo: **Entrar com GitHub** | O mesmo feudo |
| Num perfil com feudo anônimo, vincular um GitHub já vinculado | QuickPick com as duas opções descritas; os feudos nunca se misturam |

Automático: servidor (`recovery.test.ts`, `github.test.ts`), extensão (outra máquina; conflito). O login real do GitHub não é coberto.
Manual — data: ____ · resultado: ____ · evidência: ____

### 11. Sem conexão: último estado, explicação, retorno automático

| Passo | Esperado |
|---|---|
| Com o painel aberto, parar a API | Em até 30 s: banner "Sem ligação com o reino. O mundo continua andando. Seus comandos voltam quando a ligação voltar."; barra de status com `$(debug-disconnect)`; botões desabilitados |
| Fechar e reabrir a janela, ainda sem API | O último estado aparece, em modo leitura |
| Subir a API | O banner some sozinho em até 60 s; os números atualizam |

Automático: extensão (sem conexão), `gameSession.test.ts` (recuo 5 s → 60 s).
Manual — data: ____ · resultado: ____ · evidência: ____

### 12. Excluir a conta

| Passo | Esperado |
|---|---|
| **Lords: Excluir conta…** | Modal explica: bloqueio imediato, remoção em sete dias, cópias de segurança por até 14 dias; não oferece desfazer |
| Confirmar e digitar o nome do feudo | Volta às boas-vindas; a árvore esvazia |
| No segundo perfil (mesma conta), esperar o próximo ciclo | Também volta às boas-vindas, sem mostrar o feudo antigo |
| `pnpm db:psql -c "select deleted_at is not null from accounts"` | `t` |
| Tentar entrar com o Código do Reino antigo | Recusado |

Automático: servidor (`auth.test.ts`, `jobs.test.ts`: bloqueio, retenção e expurgo), extensão (excluir a conta).
Manual — data: ____ · resultado: ____ · evidência: ____

## Outras conferências que só o editor mostra

- O ícone da torre aparece na Activity Bar e a view mostra as boas-vindas com **Jogar agora** quando não há conta.
- `Lords: Sobre` mostra a versão do servidor e o hash do conteúdo.
- Com duas janelas do VS Code abertas na mesma conta por mais de 15 minutos, nenhuma das duas volta às boas-vindas (a renovação da sessão de uma não derruba a outra).
- As explicações dos números aparecem em uma faixa no rodapé do painel, ao passar o mouse e ao focar com Tab, sem serem cortadas com o painel estreito.
- A barra de progresso da obra usa a cor do tema nos três temas.
- Cancelar o login do GitHub não mostra erro.
- **Entrar com GitHub** pela tela de boas-vindas leva direto ao feudo.
- Com `lords.notifications: all`, cinco obras concluídas em uma hora geram três notificações e o badge "2" na view.
- **Lords: Modo discreto**: a barra de status vira `● 00:42` e nenhuma notificação aparece.
- O Output "Lords of the Guild" não mostra erros na ativação.
- Instalar o `.vsix` em um perfil limpo (`code --install-extension packages/extension/lords-of-the-guild-0.1.0.vsix`) chega ao painel Feudo com **Jogar agora**.

## Execuções registradas

| Data | Quem | Ambiente | Critérios | Resultado |
|---|---|---|---|---|
| 2026-10-01 | Claude Code | Testes automatizados (sem VS Code) | 1–8, 10–12 nas partes indicadas como "Automático" | Verdes. Nenhum passo manual executado. |
