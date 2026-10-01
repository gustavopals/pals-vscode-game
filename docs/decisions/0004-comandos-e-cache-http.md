# 0004 — Recibos de comandos, avanço em recusas e cache HTTP

Data: 2026-10-01\
Estado: consolidada na revisão documental solicitada; implementação pendente\
Escopo: GDD §14.5–14.10 e §16.1; roadmap F1-T7, F2-T1, F2-T3, F2-T6, F3-T1 e F3-T4

## Contexto

O plano prometia a resposta original no reenvio sem definir seu armazenamento. Também deixava ambíguo se uma recusa desfazia o avanço do mundo. A versão persistida do estado era usada como ETag no GDD, embora a produção contínua pudesse mudar a representação sem escrita no banco.

## Decisão

O contrato detalhado está no GDD §14.8:

1. Identidade por `(game_id, commandId)` e SHA-256 canônico de `{ type, payload }`. Autenticar e verificar propriedade antes de consultar recibos.
2. Guardar status HTTP e corpo JSON completos de sucesso e recusa em `commands`, na mesma transação do estado e dos eventos. Falha inesperada faz rollback de tudo; recusa de regra faz commit do avanço e do recibo, sem efeitos da ação recusada.
3. Mesmo UUID e hash retornam status/corpo originais antes de qualquer avanço. Somente o cabeçalho `X-Lords-Replayed: true` indica repetição; igualdade do corpo é estrutural JSON. Hash diferente retorna `409 COMMAND_ID_CONFLICT`, sem efeitos. Uma nova tentativa de jogo após recusa usa outro UUID.
4. Recibos permanecem enquanto a partida existir, inclusive arquivada. A regra anterior de expurgo em 90 dias foi removida para que um UUID antigo nunca seja reaplicado por perda de seu registro. Exclusão da conta remove os recibos em cascata.
5. `stateVersion` é string decimal, incrementada uma vez por escrita do estado. `X-Lords-State-Version` informa a versão conhecida e produz apenas `staleView`; a comparação usa a versão persistida obtida sob lock antes do avanço do comando.
6. `/view` retorna `{ view, stateVersion }`. ETag fraco = SHA-256 do JSON canônico do corpo completo. Autenticar, avançar e derivar antes de comparar `If-None-Match`; 304 só para representação igual, sem corpo. `Cache-Control: private, no-cache` e `Vary: Authorization` acompanham 200 e 304. Respostas de comandos usam `no-store`.
7. O SDK expõe repetição como metadado. A extensão consulta view/eventos atuais após um recibo repetido, sem recolocar a tela no passado nem notificar os mesmos eventos novamente.

Não usar `If-Match` como aviso: ele define uma precondição HTTP que pode impedir a operação, diferente do comportamento desejado para `staleView`. Referência: [RFC 9110, §13.1.1 e §13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1).

## Consequências e verificação

Guardar respostas completas aumenta o volume de `commands`; medir esse volume antes de propor compactação ou retenção. O JSON canônico ordena chaves de objetos recursivamente, preservando arrays; o cabeçalho de versão não participa do hash da intenção.

Produção e tempos restantes podem mudar o ETag mantendo `stateVersion`; polling sem eventos pode retornar 200 sem escrever no banco. Testar 304 com relógio congelado, não exigir 304 em dez segundos de avanço real.

F2-T6.7–10 cobrem concorrência, falha transacional, reenvio após reinício/outros comandos, recibos antigos, payload conflitante, recusa após obra concluída e ETag sem escrita. F3-T1/F3-T4 verificam o tratamento dos recibos e do estado avançado em recusas.
