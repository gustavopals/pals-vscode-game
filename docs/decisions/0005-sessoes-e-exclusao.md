# 0005 — Histórico de refresh, revogação e exclusão em duas etapas

Data: 2026-10-01\
Estado: consolidada na revisão documental solicitada; implementação pendente\
Escopo: GDD §14.6–14.7, §14.10, §14.14 e §16.1; roadmap F2-T3–5, F2-T7, F3-T1, F3-T3 e F3-T4

## Contexto

Guardar somente o refresh token imediatamente anterior perde a associação com antecessores mais antigos. O cache positivo de autorização por 60 segundos também permitia novas requisições após uma revogação. O critério de exclusão prometia remoção total imediata, mas o fluxo tinha soft delete e expurgo posterior.

## Decisão

- Uma sessão identifica uma família por máquina, com prazo absoluto de 30 dias. Todos os hashes SHA-256 ficam em `refresh_tokens`; um índice parcial permite apenas um token não utilizado por sessão. Tokens usados permanecem identificáveis até a sessão expirar ou a conta ser removida.
- Rotação trava conta e sessão nessa ordem, revalida os registros e troca o token em transação. Reuso de qualquer antecessor revoga essa sessão inteira. A revogação precisa ser confirmada por commit antes do 401; outras sessões não são revogadas por esse evento.
- Toda autorização consulta conta e sessão no banco, sem cache positivo na v0.1. JWTs têm validade de até 15 minutos, limitada pela expiração da sessão. Novas requisições após commit de uma revogação falham em qualquer instância; uma requisição já autorizada antes do commit pode estar em execução.
- O SDK serializa refresh concorrente e não o repete automaticamente após falha de rede com resultado desconhecido. Repetir um token já consumido pode revogar a família. Nesse caso, pode ser necessário autenticar novamente via GitHub ou Código do Reino; uma conta anônima sem vínculo/código não tem recuperação garantida. Essa limitação acompanha a rotação estrita; não criar exceção que aceite tokens usados.
- Logout revoga apenas a sessão atual. Exclusão revoga todas as sessões, limpa o HMAC de recuperação e arquiva partidas na mesma transação que grava `deleted_at`. Retorna 202 com `deletedAt` e `purgeAfter`, em UTC.
- A conta excluída fica inacessível imediatamente e some das consultas da API e métricas de jogadores ativos. Dados ainda podem existir em consultas administrativas do banco durante a retenção. Nenhum fluxo GitHub/recuperação desfaz a exclusão.
- O primeiro job com `now >= deletedAt + 7 dias` remove conta e dependentes em cascata: sessões, hashes, partidas, recibos/comandos, eventos e Crônicas. A execução é horária, sujeita à disponibilidade; não prometer remoção exatamente no segundo do prazo. Backups seguem 14 dias desde sua geração, conforme política informada ao jogador.
- Logout, exclusão e detecção de sessão revogada limpam tokens e cache local da conta; erro de autenticação não vira exibição offline de dados antigos.

A retenção da relação entre tokens rotacionados segue a orientação de detecção de reuso da [RFC 9700, §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2). O escopo de uma família por máquina e o prazo absoluto são decisões deste projeto.

## Consequências e verificação

Autorização passa a ter uma consulta por requisição; medir antes de propor cache com invalidação distribuída. Históricos por sessão aumentam o armazenamento, limitado pela expiração absoluta. Rotação e revogação compartilham os mesmos locks para que duas instâncias não emitam sucessores independentes.

F2-T4 testa `R0 → R1 → R2`, reuso de `R0`, revogação de `R2` e JWTs e preservação de outra sessão, além de concorrência e duas instâncias. F2-T5 testa recuperação/login de conta excluída. F2-T7 usa relógio injetado antes e exatamente no prazo de expurgo; uma conta de controle não é afetada. F3-T3/F3-T4 verificam a limpeza local.
