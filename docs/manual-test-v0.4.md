# Roteiro manual da v0.4 — 15 a 20 minutos

Para o autor jogar **em desenvolvimento**, no molde de
[manual-test-v0.3.md](manual-test-v0.3.md). Base conferida em 2026-11-06:
`ccbaa5c`, estado 42, protocolo 4. Registrar cada observação em
[acceptance-v0.4.md](acceptance-v0.4.md), com data, quem, navegador, ritmo,
dificuldade e resultado. Questões de regra/texto vão para
[pendencias-v0.4.md](pendencias-v0.4.md).

**Este roteiro foi escrito pela leitura do código; não foi executado à mão nesta
entrega.** Os atalhos abaixo existem em `tests/e2e/server.ts`. Eles preparam
situações; não demonstram a progressão natural nem o balanceamento. A evidência
humana continua por preencher.

## Preparação (3 minutos)

Dependências e bancos já preparados. Use apenas o banco de teste, porta 5433.
**O servidor abaixo esvazia esse banco ao subir.** Combine a janela com o
coordenador: não o iniciar enquanto integração ou Playwright usam o mesmo banco.
As rotas de controle afetam todos os feudos desse banco. Use uma única conta e
um único feudo nesta rodada, em perfil novo do navegador.

```bash
export PATH=/home/g_pals/.nvm/versions/node/v22.22.3/bin:$PATH
ps aux | grep -E "[v]itest|[p]laywright"
# Terminal 1, quando o banco de teste estiver livre; manter em primeiro plano:
GAME_TIME_SCALE=3 nice -n 19 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# Terminal 2, com o mesmo PATH; manter em primeiro plano:
LOTG_API_URL=http://127.0.0.1:3100 nice -n 19 pnpm dev:web
```

Não é necessário alterar `.env`, gerar segredos ou subir a API normal de porta
3000. Abra `http://localhost:5173`; “Jogar agora”, **Senhor**, **Rápido (3×)**.
O calendário começa na primavera do ano 1. Confira `protocol: 4` em
`http://127.0.0.1:3100/v1/version`.

No terminal 3, prepare os atalhos:

```bash
API=http://127.0.0.1:3100
t() {
  local test_payload='{}'
  if [ "$#" -gt 1 ]; then test_payload="$2"; fi
  curl --fail-with-body --silent --show-error --request POST \
    "$API/__test/$1" --header 'content-type: application/json' \
    --data "$test_payload"
}
t council-recess
t horde-quiet
t siege-quiet
t raise '{"building":"townHall","level":4}'
t raise '{"building":"housing","level":6}'
t raise '{"building":"smithy","level":1}'
t raise '{"building":"barracks","level":4}'
t raise '{"building":"guild","level":4}'
t raise '{"building":"market","level":1}'
t raise '{"building":"watchtower","level":3}'
t raise '{"building":"palisade","level":2}'
for test_resource in food wood stone gold; do
  t stock "{\"resource\":\"$test_resource\",\"amount\":100000}"
done
t stock '{"resource":"iron","amount":100}'
```

Recarregue a página. Os estoques acima do depósito são preparação artificial
para não gastar a sessão com fome/soldo; não são recompensa ou capacidade real.
O recesso segura audiências sorteadas, não apaga cartas já na mesa. `horde-quiet`
substitui incursões por uma distante; os tiles e a passagem das estações continuam.
`siege-quiet` adia o Cerco natural deste ano; o passo 5 o substituirá por um dirigido.

## Como adiantar o tempo

`t advance '{"ms":600000}'` adianta **10 minutos reais** no servidor. No Rápido,
isso representa 30 minutos de jogo. O relógio do navegador não salta junto:
**recarregue após cada salto e espere a visão/ordem terminar antes do próximo**.
Em saltos longos o token vence; o app deve renovar a sessão ao voltar.

| Atalho existente | Uso neste roteiro |
|---|---|
| `raise { building, level }`, `stock { resource, amount }` | Edifícios e estoque, sem pagar/esperar obra |
| `item { defId, condition }` | Item gasto no arsenal |
| `soldiers { units }` | Contagens de soldados; respeitar o limite do Quartel |
| `raid-in { inSeconds }` | Incursão média anunciada, com composição dirigida |
| `hero { name, classId, level }` | Herói livre; criar depois do salto ao outono |
| `siege { inMinutes, opposition }` | Cerco dirigido; `small` ou `overwhelming` |
| `wall { percent }` | Vida da muralha; não usar durante reparo |
| `council-deal { cardId }`, `reveal { modelId }`, `omen` | Extras disponíveis; não substituem requisitos de sabotagem/caçada |

Não existem atalhos `/__test/sabotage`, `/__test/autumn`, `/__test/year-end` ou
`/__test/chronicle`: as jornadas usam calendário e motor reais depois da preparação.
O intervalo entre ondas continua **uma hora real nos três ritmos**; forja, treino,
viagem e duração dos nós são tempo de jogo. A encruzilhada espera **12 h reais**:
responda pela tela para não gastar essa janela no roteiro.

## Jornadas

### 1. Forja, armas e reparo (2 minutos)

1. Na aba **Feudo**, encontre o Ferreiro. Escolha **2 armas**, revise custo/prazo e
   confirme uma vez. Confira o lote em curso e os recursos cobrados ao começar.
2. `t advance '{"ms":600000}'`; recarregue. As duas armas chegaram, a fila liberou
   e a Crônica registrou o lote? Armas não aparecem como mercadoria de venda.
3. `t item '{"defId":"huntingSpear","condition":0}'`; recarregue. No reparo do
   Ferreiro, selecione o item no arsenal e confira o ferro/prazo. Confirme.
4. `t advance '{"ms":600000}'`; recarregue. O item voltou inteiro ao arsenal e a
   fila liberou? Durante o reparo, outro lote estava bloqueado?

Observar: ☐ custo/prazo antes da ordem; ☐ uma fila compartilhada; ☐ item sem bônus
quando gasto; ☐ aviso de conclusão e texto legível. QA-20/21 e jornada do ferro.

### 2. Treino, formação e Conselho de Guerra (2 minutos)

1. Abra **Exército**. Treine **2 Espadachins**: confira armas, recursos e prazo na
   revisão. `t advance '{"ms":600000}'`; recarregue. Os soldados saíram dos aldeões,
   ainda moram nas casas e aparecem no consumo? Anote a diferença.
2. Prepare a pequena defesa: `t soldiers '{"units":{"spearman":6,"archer":4}}'`;
   recarregue. No editor, nomeie **Guarda da Ponte**. Com setas e Enter, ponha
   6 Lanceiros na Frente central e 4 Arqueiros na Retaguarda central. Salve e
   **ative como Defesa**. Recarregue: o plano e o nome continuam?
3. **Simular defesa do feudo**: leia percentuais, risco e perdas. Altere um posto,
   salve e veja “Prévia desatualizada”; simule outra vez. A prévia desta tela é
   defesa comum, sem seletor de onda ou simulação ofensiva.

Observar: ☐ revisão do treino; ☐ editor por teclado; ☐ aviso sem Defesa some ao
ativar; ☐ prévia explica o risco. Critérios 1/2; QA-22 a QA-25.

### 3. Incursão e relatório (1 minuto)

```bash
t raid-in '{"inSeconds":60}'
# Recarregar: ler aviso/composição antes de avançar.
t advance '{"ms":61000}'
```

Recarregue e abra o relatório no Exército: formação que lutou, fatores, rodadas,
baixas e muralha. O feudo foi defendido sem outro clique? Sem Torre Nv5, não espere
contagens inimigas exatas antes do combate. Não interprete resultado deste inimigo
dirigido como dificuldade de uma incursão normal. Ao terminar, `t horde-quiet`
para isolar o salto seguinte. Critério 1; QA-26/27.

### 4. Outono, sabotagem e Acampamento (4 minutos)

1. `t advance '{"ms":115200000}'` (**32 h reais**, 48 dias de jogo); recarregue.
   Esta rodada começou no ano 1 e agora deve estar no **outono**, com Acampamento
   e Fortaleza ativos. Se o calendário divergir, registre: não force descoberta
   de `sabotage`, pois ela não contorna estação/Fortaleza.
2. Só agora dê os heróis, para não cobrar soldo durante o salto inicial:

```bash
t hero '{"name":"Alda","classId":"warrior","level":10}'
t hero '{"name":"Bela","classId":"mage","level":10}'
t hero '{"name":"Ciro","classId":"cleric","level":10}'
t hero '{"name":"Daro","classId":"warrior","level":10}'
```

3. Recarregue. Em **Guilda → Sabotagem da Fortaleza**, leia tentativas restantes,
   risco e ondas enfraquecidas. Marque Alda, Bela e Ciro; tire um e veja o envio
   bloquear. Marque os três e envie. Eles não podem ser comandantes da Defesa ativa.
4. No **Exército**, edite a Guarda da Ponte e nomeie **Daro** comandante central;
   salve. **Atacar o Acampamento**: leia a conferência e envie. Observe a tropa
   ausente e o aviso de que esses postos não defendem enquanto viajam.
5. `t advance '{"ms":2400001}'` (40 min reais e 1 ms); recarregue. A sabotagem deve
   estar na encruzilhada após suas primeiras provas. Escolha um caminho liberado
   que continue a missão, lendo o risco. Se a equipe perdeu todos os integrantes,
   leia o relatório e registre o desfecho; não prometa sucesso pela preparação.
6. `t advance '{"ms":4800000}'` (80 min reais); recarregue. Confira relatório da
   sabotagem, tentativas, reduções/alerta se ocorreram; confira também retorno do
   exército, suas baixas/saque e relatório do Acampamento. Vitória limpa o tile;
   derrota ou recuo deixam-no ativo. O nome do herói e a história fazem sentido?

A ida/volta do Acampamento leva uma hora real no Rápido; a sabotagem completa,
duas, **além da espera pela escolha**. O salto final cobre o percurso depois da
resposta. Se houver prazo restante, avance só o informado pela visão. QA-28 a QA-31.

### 5. Cerco com decisão entre ondas (3 minutos)

As equipes devem ter voltado. Este atalho **substitui** formações por “Muralha
Firme” e “Guarda do Inverno”, coloca 48 soldados de referência, Quartel Nv5,
Torre Nv3, muralha danificada Nv3 e ondas pequenas. Não é o Cerco natural da Vigília
nem uma amostra de balanceamento. As ordens e o combate seguintes são os reais.
Zere as tropas anteriores só para essa preparação: o atalho `siege` define
Cavaleiros/Arqueiros, mas preserva outros tipos; somá-los poderia ultrapassar o Quartel.

```bash
t soldiers '{"units":{"spearman":0,"swordsman":0,"archer":0,"knight":0,"shieldbearer":0}}'
t siege '{"inMinutes":10,"opposition":"small"}'
```

1. Recarregue; no painel **Cerco do Inverno** do Exército, escolha “Guarda do
   Inverno” para a onda 2 e **Salvar onda 2**. Só mudar o seletor não salva.
   Leia o padrão das outras: Defesa ativa no instante da batalha.
2. `t advance '{"ms":601000}'`; recarregue. A primeira onda foi enfrentada, a decisão
   da **onda 2** está aberta e o prazo é de cerca de **60 min reais**?
3. Pelo teclado, **Trocar formação…**, escolha “Muralha Firme” e confirme. **Reparar
   agora…** mostra pedra e ouro; confirme e veja a muralha refeita. Se já estiver
   inteira, registre o bloqueio, sem inventar dano de batalha.
4. `t advance '{"ms":3600000}'`; recarregue. Onda 2 enfrentada, decisão da onda 3
   aberta? Deixe o Plano decidir: `t advance '{"ms":3600000}'`; recarregue.
5. Leia **Vitória Gloriosa/Vitória/Queda**, a Crônica e os relatórios guardados.
   Verifique que uma onda não aparece duas vezes como batalha e progresso.
   Não há controle de milícia na tela: a ordem/oferta existe, mas o roteiro não
   a apresenta como fluxo disponível ao jogador.

Extra fora dos 20 min: repetir `t siege '{"inMinutes":1,"opposition":"overwhelming"}'`
e avançar 61 s mostra Queda e cancela ondas restantes; fazer em rodada separada
se quiser preservar o resultado anterior para a Crônica. Critério 4; QA-32/33.

### 6. Crônica do Ano, Reino e Novidades (3 minutos)

1. A rodada deve continuar no ano 1. Reponha comida, madeira e ouro com `stock`
   como na preparação. `t advance '{"ms":86400000}'` (**24 h reais**); recarregue.
   Com os saltos anteriores, isso cruza uma vez o fim do ano de 56 h do Rápido.
   Confira ano 2, linha de fecho/pontuação e acesso à Crônica. Após Queda, observe
   a Reconstrução nos primeiros dois dias de jogo da primavera; este salto pode
   já passar dessa janela, então sua ausência aqui não é defeito.
2. O botão da aba **Crônica** baixa a geral. Para conferir a **anual** existente
   no servidor, use o console do app logado após a renovação da sessão:

```js
{
  const tokens = JSON.parse(localStorage.getItem('lords.tokens'));
  const headers = { authorization: `Bearer ${tokens.accessToken}`, 'x-lords-protocol': '4' };
  const response = await fetch('/v1/games', { headers });
  if (!response.ok) throw new Error(`Listar feudos: HTTP ${response.status}`);
  const { games } = await response.json();
  const game = games.find((entry) => entry.status === 'active');
  if (!game) throw new Error('Nenhum feudo ativo.');
  const annual = await fetch(`/v1/games/${game.id}/years/1/chronicle.md`, { headers });
  if (!annual.ok) throw new Error(`Crônica anual: HTTP ${annual.status}`);
  const url = URL.createObjectURL(await annual.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cronica-ano-1.md';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

   Não copie tokens para o relatório. Se houver 401, recarregue/espere a renovação
   e repita; 404 do endpoint anual pede conferir se o ano terminou. Leia no arquivo
   as quatro estações, resultado do Cerco, números, pontuação e Feitos. **A falta
   de seletor/download anual no app é lacuna conhecida do critério 5**.
3. F1 → **Lords: Reino**, ou a linha da conta na árvore. Leia totais, ranking de
   ouro e estatísticas próprias. Em Preferências, desmarque **Mostrar meu feudo no
   ranking** e volte ao Reino: a linha pública some, os totais continuam. Reative.
   O agregado tem cache de um minuto e usa ouro gravado; “Atualizar” não avança
   outros feudos.
4. F1 → **Lords: Novidades**. O foco chega ao título? A v0.4 está marcada como
   rascunho, sem parecer publicada? Abra uma segunda aba e confira a leitura por
   conta da última entrada publicada compatível com a versão da API; o rascunho
   v0.4 não deve gerar selo de publicação.

Critério 5; jornadas Reino/Novidades. O critério 6 depende da Fase I, não desta rodada.

## Só para olhos humanos

- ☐ O relatório explica por que ganhou/perdeu e sugere uma mudança de formação?
- ☐ O que preparou parece ter valido a pena? A prévia e o presságio ajudam?
- ☐ Custos, confirmação, foco e prazos ficam claros sem ler código?
- ☐ Uma largura de 720 px cabe sem rolagem lateral? Escuro, claro e alto contraste
  mantêm texto legível e estado expresso por palavra/ícone, além da cor?
- ☐ Hora/fuso da Vigília nas Preferências se entendem? O Cerco dirigido não prova
  que a hora natural é conveniente: isso exige uma rodada sem `siege-quiet`/`siege`.

Esta sessão curta não cobre todas as dificuldades/ritmos, partida migrada real,
Lobo Branco completo, milícia pelo app, ausência real, calendário natural do Cerco
ou playtest. Registrar Firefox, Safari, celular e leitor de tela como observados
ou não observados na tabela de aceitação. Encerrar API/Vite com Ctrl+C ao terminar,
para liberar o banco de teste ao coordenador. Nenhum comando daqui vale em produção.
