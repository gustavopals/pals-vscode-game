#!/usr/bin/env bash
# Confere, de fora, que a página de apresentação está sendo servida como deve: a página, os
# cabeçalhos de segurança, o cache e a página de caminho errado. Serve para a imagem local, para
# a CI e para a produção.
#
#   pnpm docker:build:landing
#   docker run --rm -d --name lotg-landing -p 8080:80 lotg-landing:latest
#   scripts/landing-smoke.sh http://localhost:8080
#   scripts/landing-smoke.sh https://lordsoftheguild.palsincomehub.com
set -euo pipefail

BASE="${1:-http://localhost:8080}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
failures=0

ok() { printf '  ok     %s\n' "$1"; }
fail() {
  printf '  FALHOU %s\n' "$1"
  failures=$((failures + 1))
}

# fetch <nome> <caminho>: guarda o corpo em $TMP/<nome>.body, os cabeçalhos em .headers e o
# código em .status. Espera a página ficar de pé (contêiner recém-criado, deploy em andamento).
fetch() {
  : >"$TMP/$1.headers"
  : >"$TMP/$1.body"
  curl --silent --show-error --compressed --max-time 15 \
    --retry 8 --retry-delay 2 --retry-all-errors \
    --dump-header "$TMP/$1.headers" --output "$TMP/$1.body" \
    --write-out '%{http_code}' "$BASE$2" >"$TMP/$1.status" || echo 000 >"$TMP/$1.status"
}
status() { cat "$TMP/$1.status"; }
header() {
  { grep -i "^$2:" "$TMP/$1.headers" || true; } | tail -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

expect_status() {
  if [ "$(status "$1")" = "$2" ]; then ok "$3 responde $2"; else fail "$3 respondeu $(status "$1"), esperado $2"; fi
}
expect_header() {
  local value
  value="$(header "$1" "$2")"
  if printf '%s' "$value" | grep -q -- "$3"; then ok "$4"; else fail "$4 (veio: ${value:-nada})"; fi
}
expect_body() {
  if grep -q -- "$2" "$TMP/$1.body"; then ok "$3"; else fail "$3"; fi
}

echo "Página de apresentação em $BASE"

# Logo depois de um deploy a página pode levar um pouco para responder (contêiner subindo,
# certificado do domínio sendo emitido): espera até um minuto e meio antes de conferir.
for _ in $(seq 1 30); do
  if curl --silent --fail --max-time 10 --output /dev/null "$BASE/"; then break; fi
  sleep 3
done

fetch home /
expect_status home 200 'a página'
expect_body home '<title>Lords of the Guild: parece trabalho, é um feudo</title>' 'é a página de apresentação, não o jogo'
expect_body home '>Jogar agora</a>' 'tem o botão Jogar agora'
expect_header home content-type 'text/html' 'a página é HTML'
expect_header home content-security-policy "default-src 'none'" 'política de conteúdo estrita'
expect_header home content-security-policy "frame-ancestors 'none'" 'a página não pode ser embutida em outra'
expect_header home x-content-type-options 'nosniff' 'X-Content-Type-Options: nosniff'
expect_header home referrer-policy 'no-referrer' 'Referrer-Policy: no-referrer'
expect_header home strict-transport-security 'max-age=' 'Strict-Transport-Security'
expect_header home cache-control 'no-cache' 'a página é sempre conferida (no-cache)'

# A folha de estilos tem hash no nome: pode ficar um ano no cache.
css="$(grep -o '/assets/[A-Za-z0-9_.-]*\.css' "$TMP/home.body" | head -1 || true)"
if [ -n "$css" ]; then
  fetch css "$css"
  expect_status css 200 "a folha de estilos ($css)"
  expect_header css cache-control 'immutable' 'arquivos com hash ficam no cache para sempre'
  expect_header css content-security-policy "default-src 'none'" 'os cabeçalhos valem para todos os arquivos'
else
  fail 'a página não aponta para uma folha de estilos em /assets'
fi

fetch og /og.png
expect_status og 200 'a imagem da prévia do link'
expect_header og content-type 'image/png' 'a imagem da prévia é PNG'
expect_header og cache-control 'max-age=3600' 'arquivos sem hash ficam uma hora no cache'

fetch robots /robots.txt
expect_status robots 200 'robots.txt'

fetch licenses /licencas.txt
expect_status licenses 200 'o arquivo de licenças das letras'
expect_body licenses 'SIL OPEN FONT LICENSE' 'o texto da licença das letras está lá'

fetch lost /um/caminho/que/nao/existe
expect_status lost 404 'um endereço desconhecido'
expect_body lost 'Este caminho não leva a Pedra Alta' 'o 404 traz a página de caminho errado'
expect_header lost cache-control 'no-cache' 'o 404 não fica no cache'
expect_header lost content-security-policy "default-src 'none'" 'o 404 tem a mesma política de conteúdo'

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures verificação(ões) falharam."
  exit 1
fi
echo 'Tudo certo.'
