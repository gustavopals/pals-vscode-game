# 0011 — Ritmo 3× no MVP, configurável no servidor

Data: 2026-10-01\
Estado: decidido pelo autor em 2026-10-01 (depois de jogar em produção)\
Escopo: GDD §2.1, §4.2, §14.5, §14.9 e §16.1; roadmap F2-T6 e Fase 5

## Contexto

No ritmo Normal do GDD um dia de jogo dura 2 horas reais e o ano, 7 dias. Jogando a v0.1 em produção, o autor achou o jogo lento: pouco acontece entre uma visita e outra. O GDD §4.2 já prevê ritmos (`timeScale` de 1, 2 ou 0,5), mas como escolha do jogador na v0.2; na v0.1 o fator estava fixo em 1.

O servidor sempre converteu tempo real em tempo de jogo por partida (`games.time_scale`). O que faltava era a interface: o `ViewState` saía em tempo de jogo, e com um fator diferente de 1 as contagens regressivas e as taxas "por hora" mostrariam números que não batem com o relógio do jogador.

## Decisão

1. **As partidas novas nascem no ritmo 3×**: uma hora real são três horas de jogo. O dia de jogo dura 40 minutos reais e o ano, 56 horas. Produção, consumo, obras e recrutamento andam juntos, então o balanceamento relativo do GDD não muda.
2. **O fator vem do servidor**, pela variável `GAME_TIME_SCALE` (padrão 3, de 0,5 a 10). É gravado em cada partida na criação; mudar a variável não mexe nas partidas que já existem. O jogador ainda não escolhe o ritmo: isso continua sendo da v0.2.
3. **A interface só fala em tempo real.** `deriveViewState(state, agora, { timeScale })` divide os prazos pelo ritmo (segundos reais, arredondados para cima) e multiplica as taxas por hora, inclusive nos textos de explicação. O app continua sem fazer conta nenhuma.
4. **O motor não muda**: continua rodando em tempo de jogo, com os números do GDD no ritmo Normal. Os goldens e os testes de propriedade não foram tocados pelo ritmo.

## Consequências

- A comida também acaba três vezes mais rápido com a aba fechada: sem ninguém na Fazenda, o estoque inicial dura 12 horas reais, e não 36.
- "Cada semana é um ano" deixa de valer no MVP; o texto das boas-vindas não promete mais isso.
- As partidas criadas antes desta decisão continuam no ritmo 1. Quem quiser o ritmo novo começa uma partida nova ("Lords: Nova partida").
- O lembrete "Proteja seu reino" passou a contar 48 horas reais desde a primeira abertura no navegador, em vez do 25º dia de jogo, que dependia do ritmo.
- As metas de balanceamento do GDD §15.2 e as faixas do `sim-cli` continuam definidas no ritmo Normal. O simulador aceita `--time-scale` para ver o que um jogador de duas sessões por dia encontra no ritmo do servidor.
- A requisição de `POST /games` ainda aceita `timeScale: 1` por compatibilidade e o ignora.

## Verificação

Testes do motor para a conversão de prazos e taxas, testes de integração do servidor com `GAME_TIME_SCALE=3` (produção de uma hora real, obra que termina no tempo real anunciado, partida antiga intacta) e os testes em navegador, que seguem no ritmo 1 por serem escritos em minutos de jogo do GDD.
