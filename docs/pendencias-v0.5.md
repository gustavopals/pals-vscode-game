# Pendências e dúvidas da v0.5

> **Para ler primeiro.** A v0.4.0 está no ar desde 2026-11-17 (`b7640394`, estado 42, protocolo 4). Na mesma data o autor respondeu às decisões da v0.5 ([ADR 0022](decisions/0022-regras-da-v0.5.md)): a D-1 foi aprovada (regime rápido e "sem resposta vale a recomendada") e as decisões D-2 a D-31 valem com a recomendação da tabela do [roadmap da v0.5](roadmap-v0.5.md), §4. Este arquivo é a caixa de entrada do autor durante a v0.5, no molde de [pendencias-v0.4.md](pendencias-v0.4.md). Cada item diz o que vale enquanto não houver resposta.

## 1. Perguntas abertas da v0.5

| Item | Pergunta | Vale enquanto não houver resposta |
| --- | --- | --- |
| **D-31** | Quais ideias de diversão da §8 do [roadmap da v0.5](roadmap-v0.5.md) entram no escopo? (1. Pontuação do ano ao vivo; 2. "Copiar resultado do ano" com link da semente; 3. Feito "Cartógrafo" e contador de explorados na aba Mapa; 4. Batizar o posto avançado; 5. Oferenda anual no Santuário.) | Pela regra "sem resposta vale a recomendada" (D-1), a recomendação da tabela é *"Escolher quais entram"*. Sem escolha explícita do autor, **nenhuma ideia da §8 entra** ([ADR 0022](decisions/0022-regras-da-v0.5.md)). |
| **D-29** (e ST-1 / ST-2 da v0.4) | Texto da política de privacidade sobre o ranking público e as Temporadas, e eventual regra de moderação de nomes de feudo (GDD §17.2). | Não há ferramenta de moderação de nomes na v0.5 (D-29). Como o texto da política de privacidade é exclusivo do autor (`CLAUDE.md`, regra 7), o agente não o altera; vale a opção de saída nas Preferências (`accounts.ranking_listed`, [ADR 0021](decisions/0021-estatisticas-e-ranking.md) e D-28) até o autor atualizar a política no README e no item "Conta" do app. |

## 2. O que continua aberto da v0.4

O registro completo está em [pendencias-v0.4.md](pendencias-v0.4.md). Com a aprovação em bloco de 2026-11-04 e as respostas de 2026-11-09, 2026-11-11 e 2026-11-17 (R1 a R3 e D1 a D4), continuam abertos para decisão ou confirmação do autor:

| Item | O que é | Vale enquanto não houver resposta |
| --- | --- | --- |
| **F-5** (V4F-T3) | Prévia ofensiva do ataque ao Acampamento de Saqueadores (`simulateBattle` simula a defesa do feudo; uma prévia ofensiva exige regra e contrato próprios no motor, adiada na revisão da V4F-T3). *(As outras duas entradas `F-5` de [pendencias-v0.4.md](pendencias-v0.4.md) — contador do objetivo 16 na v0.3 e trecho de saída da Fortaleza na V4F-T1 — já foram fechadas.)* | A tela e a paleta identificam a simulação como **defesa do feudo** e avisam que o ataque ao Acampamento ainda não tem prévia. |
| **G-23** (V4G-T4) | Vínculo por onda no relatório de batalha persistido e discriminação das perdas da Queda no painel de rescaldo (`siege.aftermath` usa só os dados persistidos no estado; `battleId` por onda e perdas detalhadas da Queda vivem nos eventos `siegeWaveFought` e `siegeFell`). | O painel exibe o resumo persistido de ondas, mortos e prazos/descontos do rescaldo; o detalhamento por evento permanece na Crônica e no Relatório de Retorno, sem migração de estado nem leitura extra de eventos. |
| **G-25** (V4G-T5.1) | Reservar a sequência completa das três ondas do Cerco (incluindo os dois intervalos de 60 min reais) antes do fechamento anual (`year * YEAR_MS`), usando o fallback de +12 h de jogo quando a Hora da Vigília não comporta as três ondas e não agendando o Cerco do ano em migração tardia sem janela suficiente (`siege.year-boundary.test.ts`). | Permanece a hipótese conservadora aplicada no motor na revisão de 2026-11-09, aguardando confirmação do autor. |

## 3. O que só o autor pode fazer

| # | O quê | Origem / observação |
| --- | --- | --- |
| 1 | **Cópia externa de `RECOVERY_CODE_SECRET`** fora do Coolify | Ato 23 ([pendencias-v0.4.md](pendencias-v0.4.md), §1 e §3): sem ela, perder o Coolify invalida todos os Códigos do Reino já emitidos. |
| 2 | **Backup fora do servidor** | Ato 23: configurar destino externo para os backups diários do PostgreSQL (hoje no mesmo disco do servidor). |
| 3 | **Ensaio de restauração e reversão** | Ato 23: ensaiar em banco descartável a restauração e a reversão com duas imagens atravessando uma migração de estado ([deploy/README.md](../deploy/README.md)). |
| 4 | **Playtest e leitura de conteúdo** | Jogar as versões publicadas com os roteiros manuais e realizar playtest com outras pessoas (inclusive para o ajuste fino das faixas de vitória de Senhor Rápido e Normal aceitas em D2, D3 e D4 de [pendencias-v0.4.md](pendencias-v0.4.md)), além de revisar os textos narrativos em rascunho das versões anteriores e ler por amostra o conteúdo da v0.5 em cada publicação (D-30). |
| 5 | **Confirmações editoriais do [ADR 0012](decisions/0012-pagina-de-apresentacao.md)** | Confirmar os oito pontos da página de apresentação (`@lotg/landing`), incluindo as escolhas atualizadas em 2026-11-17 na versão "Almanaque de Pedra Alta" (endereço, fontes, título e tom, artes conceituais, capturas, aviso para celular, monitor de saúde e menção no GDD), e o vínculo GitHub em produção se quiser ativá-lo. |

## 4. As decisões da v0.5

Respondidas em lote pelo autor em **2026-11-17** e registradas no [ADR 0022](decisions/0022-regras-da-v0.5.md): **D-1 aprovada** (regime rápido da §2 e "sem resposta vale a recomendada") e **D-2 a D-31 valendo com a recomendação da tabela** da §4 do [roadmap da v0.5](roadmap-v0.5.md) (com a D-31 mantendo as ideias da §8 fora do escopo até escolha explícita).

## 5. Dúvidas levantadas durante a implementação

*Nenhuma até o momento (Fase A).*
