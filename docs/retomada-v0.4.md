# Retomada em 2026-11-10 — R1, R2 e amostra do Cerco

No `v4-juncao3`, o WIP `82360fd` preserva a medição antiga. As regras e o bot foram juntados nos commits `7ebde70` e `5c7d1e8`; o teste histórico foi ajustado em `e8f3c64`. A guarda v42 valida o lote diretamente, sem importar `units` ou depender da mensagem da v41; as guardas v28 a v41 continuam rejeitando lote acima de 10. Testes focados: ritmo 21, Paliçada 75, bot do Cerco 31, todos verdes; `pnpm typecheck` verde. A revisão das trilhas ainda deve ser concluída.

Amostra com cinco sementes, ano de jogo: Regular em Senhor, Rápido 0/5, Normal 5/5, Tranquilo 4/5; Dedicado em Senhor, 4/5, 5/5, 5/5; Regular em Camponês, 0/5, 5/5, 5/5. Os três comandos saíram 1 por violarem as faixas anteriores; CSVs e relatórios em `/tmp/lotg-v04-medicao/`. O Rápido do Regular ganhou 1–2 ondas em cada semente. Antes das matrizes completas, investigar a causa do 0/5, inclusive vagas do Quartel e o tamanho efetivo do treino e da formação; ainda não há conclusão ou proposta medida. Não atualizar MEASURED com esta amostra. Não houve publicação ou push.

# Retomada da v0.4 — 2026-11-06

**Ponto de continuação:** terceira junção local `v4-juncao3`, base **`ccbaa5c`**
(“integre as ondas por ano e o preparo dos bots”), antes do fechamento documental.
Esta trilha trabalha em **`v4-docs`**, sem integração ao `main`, push ou publicação.
Estado **42**, protocolo **4**, catálogo de **59 cartas**; pacotes e motor ainda
se identificam como **0.3.0**. Conferir `git status`, o SHA do candidato e os
registros ao retomar; versões documentais não comprovam o que está em produção.

## O que está pronto na terceira junção

A junção de 2026-11-03 reuniu inicialmente o estado 41/protocolo 4. A base `ccbaa5c`
contém também o Lobo Branco, as revisões e o preparo dos bots de 2026-11-04, além
das ondas por ano. Não confundir o retrato inicial da junção com a base atual.

| Área | O que existe nesta base |
|---|---|
| Ferro e Ferreiro | Ferro no Armazém/Mercado e na Mina Abandonada; forja de armas, desgaste e reparo de item na mesma fila; interface no Feudo |
| Exército | Quartel, cinco unidades, treino/dispensa, formações salvas, comandantes e Defesa ativa offline; editor por teclado |
| Batalha e prévia | Motor único, sete contas à mão/goldens, relatórios e efeitos nos comandantes; Conselho de Guerra comum na tela e prévia por onda no motor/protocolo |
| Muralha e incursões | Vida por ala, reparo com prioridade sobre obras, Torre Nv3+; toda incursão usa batalha e a Defesa disponível |
| Horda | Memória da última formação efetiva, astúcia, presságios com névoa, Acampamento e Fortaleza; preparação/regeneração das ondas e congelamento no inverno |
| Sabotagem e campanha | Sabotagem com três heróis, até três tentativas anuais, reduções/alerta; ataque ao Acampamento com reserva de tropas, batalha, retorno, saque e restauração anual do tile; telas e conferências |
| Vigília e Cerco | Preferência de hora/fuso; Plano por onda, três ondas com intervalo de 60 min reais, decisão entre ondas, troca, reparo de emergência, milícia no motor/visão, resultado, Queda e rescaldo/Reconstrução |
| Ondas por ano | Base ×1/3 no ano 1, ×2/3 no ano 2 e ×1 no ano 3+, antes da dificuldade; postos fixos preservados e redução sem zerar postos |
| Ano e Feitos | `yearEnded`, pontuação e seis Feitos anuais; endpoint autenticado `GET /v1/games/:id/years/:year/chronicle.md`, sem mistura de anos |
| Conselho e objetivos | Cartas dos lotes 2/3 e três cartas do Lobo Branco; caçada temporária no estado 42, uma equipe por vez e janela encerrada na vitória/expiração; objetivos 17 a 21; Retorno e Antes de partir com guerra |
| Reino | Estatísticas e ranking de ouro pelo estado gravado, saída nas Preferências, ADR 0021; SQL `0001_ranking_listed`, SDK e aba Reino |
| Novidades | Aba editorial, selo de leitura por conta/entre abas; entrada v0.4 ainda como rascunho |
| Simulador | Preparo militar dos perfis, Plano, milícia pela oferta pública, contabilidade do Cerco e prévia de onda no Militar; faixas medidas continuam distintas de metas |

A descrição das regras, da ordem no mesmo instante, dos relógios, dos sorteios e
dos limites está em [architecture.md](architecture.md). Não recalcular prazos já
marcados, não alterar retratos `FROZEN` e não usar um golden divergente como motivo
para regravá-lo sem `UPDATE_GOLDEN=1` e leitura do diff.

## Evidência e lacunas que permanecem

- [balance-v0.4.md](balance-v0.4.md), “Terceira junção”, revisões de 2026-11-04 e
  seção 21, conserva as verificações focadas, correções de cenários e medições.
  Saída verde de um subconjunto não é portão completo. Na base lida, §21.4 descreve
  a remedição com bots preparados, sem consolidar os resultados finais; ondas
  alteradas depois também precisam ser identificadas na medição usada.
- [acceptance-v0.4.md](acceptance-v0.4.md) relaciona os seis critérios, QA-19 a
  QA-34 e os nove itens de “pronto” à prova existente, com limites explícitos.
  **A evidência manual continua por preencher pelo autor.**
- Complemento V4G-T4 em `v4g-t4-fim` (2026-11-09, base `879f0cc`): o app tem
  milícia com conferência e prévia por onda; o SDK/aba Crônica têm seleção/download anual.
  A visão acrescenta termos/quantidade ativa/alvo da milícia e resumo/prazos do rescaldo.
  Estado 42 e protocolo 4 preservados. **Ainda faltam** prévia ofensiva do Acampamento,
  vínculo persistente de relatório por onda e discriminação das perdas da Queda na visão
  (G-23); somente acrescentar campos derivados não recupera dados ausentes do estado.
  Milícia/Markdown anual em navegador estão escritos nos três temas/720 px, sem execução;
  as verificações focadas e seus limites estão no Registro V4G-T4 do roadmap.
- **Decisão do autor de 2026-11-09: a v0.4 fecha com 59 cartas** (a 60ª prevista inicialmente seria `"O aprendiz e o Mestre"`, proibida pelo autor). Cobertura dirigida de cadeias
  não demonstra que todas saem espontaneamente em 50 sementes (em `coverage.test.ts`, o perfil Regular abre espontaneamente 47 das 59 cartas no ano do ritmo Normal; as 12 restantes exigem promessa, hostilidade, Covil limpo, dois heróis livres, herói ferido, Ferreiro no verão ou rescaldo, cobertas nos testes de contrato do motor). Conteúdo não lido
  e perguntas de regra continuam em [content-v0.4.md](content-v0.4.md) e
  [pendencias-v0.4.md](pendencias-v0.4.md).
- O critério de **65–80% de Vitória do Regular não está provado**: `MEASURED`
  protege regressão observada, sem impor essa meta. A Fase I continua necessária
  para a aceitação final, mesmo que o autor autorize uma publicação intermediária.

Não usar o antigo ponto “começar V4D-T1.3” deste arquivo: batalha, Horda e Cerco já
existem. O histórico da retomada de outubro está nos commits anteriores do arquivo.

## O que falta para publicar

Esta trilha não autoriza publicação. O coordenador integra as entregas e registra
o candidato; o **autor faz o push**. A lista abaixo organiza os atos já previstos
no roadmap e em [deploy/README.md](../deploy/README.md), sem substituir o procedimento.

1. **Consolidar o candidato.** Integrar/revisar as trilhas, registrar SHA, estado 42,
   protocolo 4 e hash de conteúdo. Conferir pendências, correções e o escopo da
   publicação. Para a release 0.4.0, continuam previstos em V4I-T4 versões dos
   oito pacotes/`ENGINE_VERSION`, changelog, relatório, capturas e página de
   apresentação; não promovê-los a feitos por constarem nesta retomada.
2. **Fechar o portão nesse SHA.** `verify`, integração, build, navegador e landing,
   mais a remedição aplicável, com código de saída/contagens e leitura das falhas.
   Registrar em balance/roadmap; se entrar correção, identificar o novo candidato.
   Antes de começar, conferir processos e combinar o banco compartilhado. Tudo
   com `nice -n 19`, Vitest `--maxWorkers=2`, uma suíte pesada por vez; não rodar
   integração e Playwright ao mesmo tempo. **Não executar esse portão na trilha docs.**
3. **Preparar operação e backup.** Conferir as três imagens e a migração SQL
   `0001_ranking_listed`; fazer backup manual imediatamente antes da publicação
   que sobe estado/protocolo, registrar arquivo e SHA de retorno. Seguir o
   procedimento de restauração/reversão. Imagem antiga diante do estado novo
   não é reversão: precisa do backup correspondente.
4. **Entregar o aviso concreto ao autor.** SHA, resumo, saída do portão, arquivo
   do backup, mudanças em partidas existentes e lacunas ainda abertas. No `main`,
   push aciona a implantação automática; **nenhum agente desta trilha dá push**.
5. **Depois do push do autor.** Conferir saúde e `GET /v1/version` (versão esperada,
   protocolo 4 e `builtAt`), migração das partidas ativas para o estado 42 e a conta
   do autor aberta. Registrar resultado, sem inferir sucesso só pelo CI verde.

O ensaio de restauração/reversão com imagens atravessando a migração continua sem
evidência nesta entrega; ele é item expresso do “pronto” (§10.4, ato 23). Registro
antigo de procedimento escrito não equivale a ensaio executado. Tag/release também
permanecem atos do autor.

## O que fica para depois desta documentação

**Fase I, V4I-T1:** matriz dos quatro perfis padrão e perfis adicionais previstos,
três dificuldades, três ritmos, 50 sementes e duas janelas, identificando o conteúdo
com ondas por ano. Converter as faixas de Vitória/Gloriosa em **metas** do GDD §15.2,
sem apenas alargar a linha observada. Onde a medida não couber, levar propostas ao
autor. Comparar ouro por fonte/destino com a linha de base. As rodadas das fases
não substituem a matriz completa do fechamento.

Ainda em V4I-T1: `--perf` no candidato (avanços longos e Cerco), `--remote` com
50 bots, tamanho máximo de estado/visão e custo dos recibos, mais repetição manual
das sementes extremas por célula. Há medições anteriores de desempenho, mas esta
trilha não as refez nem as declara válidas para o SHA final.

**Aceitação e playtest, V4I-T2/T3:** o autor preenche a evidência por critério e joga
[manual-test-v0.4.md](manual-test-v0.4.md) em 15–20 minutos. Registrar Firefox,
Safari, celular e leitor de tela como vistos ou não vistos. O roteiro acelerado
não prova a semana natural, a conveniência da Vigília ou a vantagem de preparação.
O playtest externo continua por fazer; convite, formulário e relatório da v0.4
ficam para essa tarefa. Não houve playtest nesta entrega.

**Fechamento de produto, V4I-T4:** resolver ou obter decisão explícita para as
lacunas da aceitação, conferir textos e fichas com o autor, concluir documentos e
artefatos da release e conferir a entrada de Novidades antes de marcá-la publicada.
O próximo roadmap é a V4I-T5; não antecipar mapa, Legado, Votos ou Temporadas.

## Entrega desta trilha documental

Foram atualizados somente `architecture.md`, `acceptance-v0.4.md`,
`manual-test-v0.4.md` e esta retomada, um commit por arquivo, todos com prefixo
`V4-DOCS`. Código, testes, `CLAUDE.md`, deploy, balanceamento, roadmap e pendências
não foram editados.

Verificação: apenas `nice -n 19 pnpm exec prettier --check` nos documentos tocados,
com saída 0 por arquivo. O worktree não tem `node_modules` próprio: a primeira
chamada falhou com **254** por não encontrar `prettier`; as chamadas seguintes
usaram o executável já instalado na raiz compartilhada pelo `PATH`, sem instalar
ou alterar dependências. **Markdown é ignorado por `.prettierignore`**; o resultado
0 não atesta formatação desses textos. Referências e diff foram conferidos por
leitura; nenhum teste de jogo foi executado, nenhum golden/retrato regravado,
nenhum serviço iniciado, nenhum backup, push ou deploy feito.
