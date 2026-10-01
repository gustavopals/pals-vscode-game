# 0003 — Código do Reino com HMAC e chave independente

Data: 2026-10-01\
Estado: consolidada na revisão documental solicitada; implementação pendente\
Escopo: GDD §14.5–14.7 e §14.13; roadmap F0-T4, F2-T2, F2-T3 e F2-T5

## Contexto

O GDD prescrevia Argon2id, enquanto o roadmap propunha HMAC para localizar a conta diretamente pelo código. Derivar a chave de recuperação de `JWT_SECRET` também faria a troca da chave JWT invalidar os códigos existentes. O código é gerado pelo servidor com 100 bits de aleatoriedade; não é uma senha escolhida pelo jogador.

## Decisão

- Gerar 20 caracteres uniformes de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` com o gerador criptográfico do Node. Exibir em cinco grupos de quatro, somente na geração.
- Normalizar removendo espaços externos e hífens, converter para maiúsculas e validar o comprimento e alfabeto. O mesmo valor normalizado alimenta geração e busca.
- Guardar apenas HMAC-SHA256 hexadecimal em `accounts.recovery_code_hash`, com índice único. A chave é `RECOVERY_CODE_SECRET`, base64 decodificado com pelo menos 32 bytes aleatórios, independente de `JWT_SECRET`. Usar `node:crypto`; Argon2 sai das dependências da v0.1.
- Rotacionar o código substitui seu HMAC e invalida o código anterior; não revoga sessões. Recuperar cria uma nova sessão da mesma conta, após revalidá-la sob lock.
- Código inválido, não encontrado ou de conta excluída retorna `401 UNAUTHORIZED`, sem identificar a conta. Geração e recuperação não registram código ou segredos em logs; respostas usam `Cache-Control: no-store`.

## Consequências e verificação

A chave de recuperação precisa ser preservada nos deploys e nas restaurações, junto aos segredos operacionais. `secrets:gen` não sobrescreve valores existentes. Não há rotação transparente dessa chave na v0.1: sua substituição invalida os códigos anteriores e requer emissão de novos códigos por jogadores autenticados. A rotação de JWT não tem esse efeito.

F2-T5 comprova recuperação em outra máquina, normalização, rejeição do código anterior após rotação, manutenção das sessões, independência da chave JWT e bloqueio de conta excluída. GDD e roadmap adotam o mesmo contrato; não há aprovação adicional pendente para a antiga divergência Argon2/HMAC.
