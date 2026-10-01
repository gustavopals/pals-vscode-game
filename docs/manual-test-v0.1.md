# Roteiro manual da v0.1

O que cada critério de aceitação do GDD §16.1 (MVP-ROADMAP.md §8) já tem de prova automática, e o que ainda pede olhos humanos em um navegador.

> **Estado em 2026-10-01.** O app web foi exercitado por 47 testes em Chromium de verdade (`pnpm test:e2e`), contra a API real e o banco de teste, com o app compilado e a política de conteúdo de produção. **Nenhum passo da coluna "Manual" foi executado por uma pessoa.** Também não foram abertos Firefox nem Safari, nem o vínculo com o GitHub de verdade.

## Preparação

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api          # deixa rodando: http://localhost:3000/v1/health
pnpm dev:web          # abre http://localhost:5173
```

Para rever o que os testes automáticos fazem, com o navegador à vista:

```bash
pnpm dev:up
pnpm test:e2e                         # tudo, sem interface (cerca de 1 minuto)
pnpm exec playwright test --headed    # o mesmo, com a janela aparecendo
pnpm exec playwright test --ui        # um teste por vez, passo a passo
```

As capturas dos três temas ficam em `test-results/temas/` depois de `pnpm test:e2e` (na CI, no artefato `e2e`).

**Outro navegador.** Para simular outra máquina, use uma janela anônima ou outro perfil: o armazenamento é separado.

**Relógio.** O mundo anda no tempo real do servidor. Para testar ausências longas sem esperar, com a API parada:

```bash
pnpm db:psql -c "update games set created_at = created_at - interval '5 hours', last_processed_at = last_processed_at - interval '5 hours' where status = 'active'"
```

## Critérios

A coluna "Automático" cita o arquivo em `tests/e2e/` (ou a suíte) que prova o critério. A coluna "Manual" é o que resta para uma pessoa.

| # | Critério | Automático | Manual |
|---|---|---|---|
| 1 | Jogar agora e primeiro comando em menos de 30 s, sem instalar nada | `01-entrada`: dois campos, um clique, duas requisições, primeiro comando; o tempo medido fica na anotação do teste (frações de segundo, sem gente digitando) | ☐ Cronometrar com uma pessoa que nunca viu o jogo, do endereço digitado ao primeiro `+`. ☐ Repetir em um celular |
| 2 | Alocar muda a taxa na hora e reduz os livres | `02-feudo`: painel, árvore e paleta; menos de 1 s do clique à taxa nova | ☐ Sentir se a resposta parece imediata em uma rede comum |
| 3 | Recusas com o motivo à vista | `02-feudo`: população excedida barrada no campo, falta de recursos e fila ocupada recusadas pelo servidor com a frase em português | ☐ Ler as frases: dizem o que fazer, e não só o que deu errado? |
| 4 | Melhoria desconta uma vez, ocupa a fila, conclui no tempo | `02-feudo`: custo descontado uma vez, segunda obra recusada, conclusão sozinha aos 4 min, cancelamento devolvendo o que o servidor informa | ☐ Acompanhar uma obra de verdade até o fim, olhando a contagem regressiva e a barra de progresso |
| 5 | Reabrir após horas mostra o intervalo simulado, sem duplicar | `03-retorno-e-conexao`: 5 horas fora, abre em Hoje, +75 de comida exatamente uma vez, recarregar não soma. Motor: teste de propriedade | ☐ Ler o Relatório de Retorno depois de uma noite fora: ele conta o que importa? |
| 6 | Escassez correta em longos períodos | Motor e servidor (testes de 30 dias); `06-avisos`: a fome aparece na barra de status e no painel | ☐ Deixar o feudo sem fazendeiros por dois dias reais e ler a Crônica |
| 7 | Recibos, UUID conflitante, dois clientes | Suíte de integração do servidor; `04-conta`: dois navegadores na mesma conta | ☐ `docker compose restart` no meio de uma obra, com a aba aberta |
| 8 | Regras rodam sem navegador nem servidor | `pnpm --filter @lotg/engine test` | — |
| 9 | Três temas; navegável por teclado, inclusive a paleta | `05-teclado-e-temas`: ordem do `Tab`, árvore no padrão ARIA, paleta, **partida inteira dos objetivos 1 a 4 sem mouse**, contraste de todo texto visível ≥ 4,5:1 nos três temas, rótulos em todos os controles, 480 px sem rolagem horizontal | ☐ Olhar as capturas dos três temas: parecem um editor? Algo destoa? ☐ Jogar cinco minutos só pelo teclado: a paleta é agradável? ☐ Passar um leitor de tela (NVDA ou VoiceOver) pela aba Feudo e por um diálogo |
| 10 | GitHub ou Código do Reino em outra máquina mostra o mesmo feudo | `04-conta`: Código do Reino entre dois navegadores; *device flow* com GitHub **simulado**, inclusive conflito, recusa e código vencido | ☐ **GitHub de verdade**: registrar o OAuth App, definir `GITHUB_CLIENT_ID`, vincular em um navegador e entrar em outro. Nunca foi feito |
| 11 | Sem conexão: último estado, explicação, volta sozinho | `03-retorno-e-conexao`: API derrubada, modo leitura, nenhuma ordem enviada nem guardada, retorno sem recarregar, abertura da página com o servidor fora | ☐ Desligar o Wi-Fi de verdade por um minuto e religar |
| 12 | Excluir bloqueia na hora e limpa todas as abas | `04-conta`: confirmação, nome do feudo, prazos no texto, JWT, refresh e Código do Reino recusados em seguida, duas abas limpas. Expurgo em sete dias: suíte de integração | ☐ Ler o texto da exclusão: está claro que não há volta? |

## Só para olhos humanos

Coisas que nenhum teste automático julga.

- ☐ **Aparência.** Abrir `test-results/temas/` e o app ao vivo nos três temas. O alto contraste tem bordas em tudo o que precisa? O tema claro cansa?
- ☐ **Primeira impressão.** As boas-vindas explicam o jogo em uma frase? O nome sugerido do feudo convida a trocar?
- ☐ **Paleta.** `F1` e `Ctrl+K` abrem. A busca acha "recrutar" digitando "recr"? Os títulos dos comandos são os que você procuraria?
- ☐ **Avisos.** Com o nível "Todos", concluir três obras: os avisos atrapalham? "Silenciar 2h" está à mão?
- ☐ **Modo discreto.** Olhando de longe, a aba parece um editor e não um jogo?
- ☐ **Tela pequena.** A 480 px a barra lateral abre por cima e fecha ao navegar. Dá para jogar com o polegar?
- ☐ **Outros navegadores.** Firefox e Safari: abrir, Jogar agora, uma ordem, recarregar. Web Locks existe nos dois; nada disso foi conferido.
- ☐ **Duas abas por um dia.** Deixar duas abas abertas da manhã à noite. Nenhuma deve voltar às boas-vindas.
- ☐ **Notificações do navegador.** Ligar nas preferências, aceitar a permissão, deixar a aba em segundo plano com uma obra de 5 minutos.

## O que os testes automáticos não cobrem

- O GitHub real (só o simulado).
- Firefox, Safari e navegadores de celular.
- Leitores de tela: os papéis e rótulos ARIA são conferidos, a experiência de ouvi-los não.
- A imagem de produção atrás do proxy do Coolify ([ADR 0009](decisions/0009-implantacao-no-coolify.md)): o alvo `web` foi construído e servido localmente, mas o app nunca foi aberto em `lords.palsincomehub.com`.
- Tempos longos de verdade: os testes adiantam o relógio do servidor e o do navegador juntos, em saltos.
