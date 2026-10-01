# 0010 — `GET /version` informa o que o servidor tem ligado

Data: 2026-10-01\
Estado: aprovada pelo autor em 2026-10-01; implementada em F3W-T8\
Escopo: GDD §14.5 (`GET /version`) e §14.7 (vínculo GitHub); roadmap F3W-T8.1

## Contexto

O roadmap pede que, sem `GITHUB_CLIENT_ID`, as rotas do *device flow* respondam 404 "e o app esconda o botão". Para esconder o botão o app precisa saber disso **antes** do clique. As rotas do *device flow* não servem para perguntar: chamar `POST /auth/github/device` só para sondar criaria um código no GitHub a cada abertura da página e gastaria o limite por IP.

## Decisão

`GET /v1/version` ganha um campo:

```json
{ "server": "0.1.0", "protocol": 1, "contentHash": "…", "builtAt": "…",
  "features": { "githubDevice": true } }
```

`features.githubDevice` é verdadeiro quando o servidor tem `GITHUB_CLIENT_ID`. O app lê `/version` uma vez ao abrir (a chamada já era necessária para a aba "Sobre") e só então mostra "Entrar com GitHub" e "Vincular ao GitHub".

É um acréscimo: `PROTOCOL_VERSION` continua 1. O app trata a ausência de `features` como "desligado", porque em produção a API e o app são publicados em separado (ADR 0009) e um pode estar uma versão atrás do outro.

## Alternativas

- **Sondar a rota de consulta** com um código inválido: funciona hoje, mas depende de um detalhe (o 404 vir antes da validação do corpo) e some com qualquer refatoração.
- **Mostrar o botão sempre** e avisar no clique que o vínculo está desligado: contraria o roadmap e oferece ao jogador algo que não funciona.
- **Variável de build no app**: obrigaria a reconstruir o app para ligar o vínculo e deixaria app e servidor discordarem.

## Consequências e verificação

O campo expõe um fato de configuração que não é segredo: saber que o vínculo está ligado não dá acesso a nada. Se o GDD não aceitar o campo, a alternativa "mostrar sempre" troca três linhas no app e remove o campo do protocolo.

Testes: `packages/server/test/githubDevice.test.ts` (o campo nos dois estados), `packages/web/src/app/controller.test.ts` (servidor sem `features`) e `tests/e2e/04-conta.spec.ts` (o botão aparece e o fluxo completa com o GitHub simulado).
