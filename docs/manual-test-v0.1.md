# Roteiro manual da v0.1

O que cada critério de aceitação do GDD §16.1 (MVP-ROADMAP.md §8) já tem de prova automática, e o que ainda pede uma pessoa em um navegador, **em produção**: `https://lords.palsincomehub.com`. A evidência de cada passo é registrada em [acceptance-v0.1.md](acceptance-v0.1.md).

> **Estado em 2026-10-01.** O app web é exercitado por 48 testes em Chromium de verdade (`pnpm test:e2e`), contra a API real e o banco de teste, com o app compilado e a política de conteúdo de produção; o job `e2e` da CI passou nos commits `42d9256` e `79fe1da`. O autor já jogou em produção, em Chromium, mas sem registrar evidência por critério: **a coluna "Manual" abaixo continua inteira por fazer.** Firefox, Safari, celular e leitor de tela não foram abertos. O vínculo com o GitHub fica desligado na v0.1 e só foi testado com um GitHub simulado.

## Preparação

### Em produção (o roteiro que vale para o fechamento)

1. Abrir `https://lords.palsincomehub.com` em uma janela limpa (anônima ou perfil novo).
2. Conferir que a versão no ar é a esperada: aba **Sobre** do app, ou

   ```bash
   curl -s https://lords.palsincomehub.com/v1/health && curl -s https://lords.palsincomehub.com/v1/version
   ```

   `builtAt` precisa ser posterior ao último deploy pedido.
3. Usar uma partida **nova**: as partidas criadas antes do ritmo 3× ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)) continuam no ritmo 1, e os tempos deste roteiro não valem para elas. Conta nova, ou "Lords: Nova partida" em uma conta antiga.

**Navegadores.** Obrigatórios: **Chromium** (Chrome ou Edge) e **Firefox**, os dois no computador. Desejáveis, sem bloquear o fechamento: Safari, um navegador de celular e um leitor de tela (NVDA ou VoiceOver).

**Outro navegador ou outra máquina.** Para o critério 10, o segundo navegador serve de "outra máquina": o armazenamento é separado. Uma janela anônima também serve.

**Relógio.** Em produção o mundo anda no tempo de verdade. **Não se mexe no banco de produção para adiantar o relógio**: os passos que dependem de tempo esperam o tempo real. No ritmo 3× das partidas novas:

| O que | Tempo de jogo (GDD) | Tempo real no ritmo 3× |
|---|---|---|
| Um dia de jogo | 2 h | 40 min |
| Um ano de jogo | 7 dias | 56 h |
| Primeira obra (Habitações Nv1 → Nv2) | 4 min | 1 min 20 s (80 s) |
| Serraria Nv1 → Nv2 | 5 min | 100 s |
| Chegada de um aldeão recrutado | 20 min | 6 min 40 s (400 s) |
| Fome com os 5 aldeões iniciais e ninguém na Fazenda | 36 h | 12 h |
| Relatório de Retorno | — | depois de 4 h reais de ausência (não depende do ritmo) |
| Lembrete "Proteja seu reino" | — | 48 h reais depois da primeira abertura da conta no navegador |

O app mostra sempre o tempo real: uma contagem regressiva de 80 s leva 80 s no relógio da parede.

### Local (alternativa, para repetir um passo sem tocar a produção)

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api          # deixa rodando: http://localhost:3000/v1/health
pnpm dev:web          # abre http://localhost:5173
```

Localmente o ritmo é o de `GAME_TIME_SCALE` em `deploy/.env` (3 se a variável não existir). Só no banco **de desenvolvimento**, e com a API parada, dá para simular uma ausência longa sem esperar:

```bash
pnpm db:psql -c "update games set created_at = created_at - interval '5 hours', last_processed_at = last_processed_at - interval '5 hours' where status = 'active'"
```

Para rever o que os testes automáticos fazem, com o navegador à vista:

```bash
pnpm dev:up
pnpm test:e2e                         # tudo, sem interface (cerca de 1 minuto)
pnpm exec playwright test --headed    # o mesmo, com a janela aparecendo
pnpm exec playwright test --ui        # um teste por vez, passo a passo
```

As capturas dos três temas ficam em `test-results/temas/` depois de `pnpm test:e2e` (na CI, no artefato `e2e`). `pnpm test:e2e` não roda contra a produção: depende das rotas `/__test` e do relógio adiantável de `tests/e2e/server.ts`. Os testes em navegador rodam no ritmo 1, com os tempos de jogo do GDD.

## Critérios

A coluna "Automático" cita o arquivo em `tests/e2e/` (ou a suíte) que prova o critério; os tempos citados nela são os do ritmo 1 dos testes. A coluna "Manual" é o que resta para uma pessoa, em produção, e os tempos dela são os do ritmo 3×.

| # | Critério | Automático | Manual, em produção |
|---|---|---|---|
| 1 | Jogar agora e primeiro comando em menos de 30 s, sem instalar nada | `01-entrada`: dois campos, um clique, duas requisições, primeiro comando; o tempo medido fica na anotação do teste (frações de segundo, sem gente digitando) | ☐ Cronometrar com uma pessoa que nunca viu o jogo, do endereço digitado ao primeiro `+`. ☐ Repetir em Firefox. Desejável: em um celular |
| 2 | Alocar muda a taxa na hora e reduz os livres | `02-feudo`: painel, árvore e paleta; menos de 1 s do clique à taxa nova | ☐ Pôr um aldeão na Serraria e conferir a taxa de madeira por hora (real) e os livres. ☐ Sentir se a resposta parece imediata em uma rede comum |
| 3 | Recusas com o motivo à vista | `02-feudo`: população excedida barrada no campo, falta de recursos e fila ocupada recusadas pelo servidor com a frase em português | ☐ Provocar as três recusas e ler as frases: dizem o que fazer, e não só o que deu errado? |
| 4 | Melhoria desconta uma vez, ocupa a fila, conclui no tempo | `02-feudo`: custo descontado uma vez, segunda obra recusada, conclusão sozinha aos 4 min de jogo, cancelamento devolvendo o que o servidor informa | ☐ Melhorar as Habitações para Nv2 e acompanhar até o fim com um cronômetro: a contagem anuncia 1 min 20 s e a obra termina nesse tempo, sem recarregar. ☐ Durante a obra, tentar uma segunda: recusada |
| 5 | Reabrir após horas mostra o intervalo simulado, sem duplicar | `03-retorno-e-conexao`: 5 horas fora, abre em Hoje, +75 de comida exatamente uma vez, recarregar não soma. Motor: teste de propriedade | ☐ Fechar a aba por mais de 4 h (uma noite) e reabrir: abre em Hoje, com o Relatório de Retorno. Recarregar a página não soma de novo. ☐ O relatório conta o que importa? |
| 6 | Escassez correta em longos períodos | Motor e servidor (testes de 30 dias); `06-avisos`: a fome aparece na barra de status e no painel | ☐ Em uma partida nova, deixar os 5 aldeões fora da Fazenda e voltar depois de 12 h: a fome está na barra de status e a Crônica traz o instante em que ela começou |
| 7 | Recibos, UUID conflitante, dois clientes | Suíte de integração do servidor (inclusive "reiniciar o servidor no meio do dia"); `04-conta`: dois navegadores na mesma conta | ☐ Com uma obra em andamento e a aba aberta, **reiniciar o recurso `lotg-api` no Coolify** (botão "Restart"). O app avisa que está sem conexão, volta sozinho, a obra termina no horário anunciado antes do reinício e nada aparece duas vezes na Crônica |
| 8 | Regras rodam sem navegador nem servidor | `pnpm --filter @lotg/engine test` | — |
| 9 | Três temas; navegável por teclado, inclusive a paleta | `05-teclado-e-temas`: ordem do `Tab`, árvore no padrão ARIA, paleta, **partida inteira dos objetivos 1 a 4 sem mouse**, contraste de todo texto visível ≥ 4,5:1 nos três temas, rótulos em todos os controles, 480 px sem rolagem horizontal | ☐ Trocar entre os três temas em produção: parecem um editor? Algo destoa? ☐ Jogar cinco minutos só pelo teclado, em Chromium e em Firefox: a paleta é agradável? Desejável: passar um leitor de tela pela aba Feudo e por um diálogo |
| 10 | Código do Reino em outra máquina mostra o mesmo feudo (o GitHub fica desligado na v0.1) | `04-conta`: Código do Reino entre dois navegadores; *device flow* com GitHub **simulado**, inclusive conflito, recusa e código vencido | ☐ Gerar o Código do Reino em Chromium e entrar com ele em Firefox: o mesmo feudo, em segundos. ☐ Conferir que "Entrar com GitHub" e "Vincular ao GitHub" **não** aparecem (`features.githubDevice` é `false`) |
| 11 | Sem conexão: último estado, explicação, volta sozinho | `03-retorno-e-conexao`: API derrubada, modo leitura, nenhuma ordem enviada nem guardada, retorno sem recarregar, abertura da página com o servidor fora | ☐ Desligar o Wi-Fi de verdade por um minuto e religar: último estado à vista, explicação, ordens bloqueadas, volta sozinho |
| 12 | Excluir bloqueia na hora e limpa todas as abas | `04-conta`: confirmação, nome do feudo, prazos no texto, JWT, refresh e Código do Reino recusados em seguida, duas abas limpas. Expurgo em sete dias: suíte de integração | ☐ Com uma conta **de teste** aberta em duas abas, excluir em uma: as duas vão às boas-vindas, e o Código do Reino dela deixa de entrar. ☐ Ler o texto da exclusão: está claro que não há volta? O expurgo de sete dias fica só com a prova automática |

## Só para olhos humanos

Coisas que nenhum teste automático julga.

- ☐ **Aparência.** O app ao vivo nos três temas (e as capturas de `test-results/temas/`, do artefato `e2e` da CI). O alto contraste tem bordas em tudo o que precisa? O tema claro cansa?
- ☐ **Primeira impressão.** As boas-vindas explicam o jogo em uma frase? O nome sugerido do feudo convida a trocar?
- ☐ **Ritmo.** No ritmo 3×, há o que fazer a cada visita? Os tempos mostrados batem com o relógio da parede?
- ☐ **Paleta.** `F1` e `Ctrl+K` abrem. A busca acha "recrutar" digitando "recr"? Os títulos dos comandos são os que você procuraria?
- ☐ **Avisos.** Com o nível "Todos", concluir três obras: os avisos atrapalham? "Silenciar 2h" está à mão?
- ☐ **Modo discreto.** Olhando de longe, a aba parece um editor e não um jogo?
- ☐ **Tela pequena.** A 480 px a barra lateral abre por cima e fecha ao navegar. Dá para jogar com o polegar?
- ☐ **Firefox (obrigatório).** Abrir, Jogar agora, uma ordem, recarregar, duas abas. A renovação da sessão entre abas usa a Web Locks API; em Firefox isso nunca foi conferido.
- ☐ **Safari e celular (desejável).** O mesmo passeio curto.
- ☐ **Duas abas por um dia.** Deixar duas abas abertas da manhã à noite. Nenhuma deve voltar às boas-vindas.
- ☐ **Notificações do navegador.** Ligar nas preferências, aceitar a permissão e deixar a aba em segundo plano com uma obra em andamento (a Serraria Nv2 leva 100 s).
- ☐ **Lembrete "Proteja seu reino".** Em uma conta anônima sem Código do Reino, 48 h depois da primeira abertura neste navegador: aparece uma vez só.

## O que os testes automáticos não cobrem

- **A produção.** Nenhuma suíte roda contra `lords.palsincomehub.com`. O que existe lá é a conferência de F4-T1 (saúde, versão, cabeçalhos e **Jogar agora** até Pedra Alta em Chromium), o monitor de saúde (`.github/workflows/health.yml`) e o que o autor jogou. A fumaça `pnpm -s sim -- --smoke <url>` e a medição de carga pequena de F5-T1.2 são os únicos comandos pensados para ela.
- **O ritmo 3× no navegador.** Os testes em navegador e os cenários de integração rodam no ritmo 1. A conversão para tempo real é coberta por testes de integração do servidor (`packages/server/test/pace.test.ts`), não por um navegador.
- **O GitHub real.** Só o simulado; na v0.1 o vínculo fica desligado em produção.
- **Firefox, Safari e navegadores de celular.** A CI só usa Chromium.
- **Leitores de tela.** Os papéis e rótulos ARIA são conferidos; a experiência de ouvi-los, não.
- **O reinício da API de verdade.** Os testes derrubam e sobem a API em processo; o reinício do contêiner no Coolify, com o proxy na frente, só o passo manual do critério 7 prova.
- **Tempos longos de verdade.** Os testes adiantam o relógio do servidor e o do navegador juntos, em saltos.
