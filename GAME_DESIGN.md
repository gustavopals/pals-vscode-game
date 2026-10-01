# Lords of the Guild — Game Design Document (GDD)

> **Status:** conceito inicial / base para desenvolvimento com Codex  
> **Versão:** 0.1  
> **Idioma:** português (Brasil)  
> **Plataforma inicial:** extensão do Visual Studio Code (VS Code)  
> **Gênero:** estratégia, gerenciamento medieval, RPG de guilda e progressão assíncrona  
> **Inspirações:** Age of Empires, Warcraft III, Tribal Wars, OGame e RPGs de navegador.

## 1. Visão geral

**Lords of the Guild** é um jogo medieval de fantasia jogado dentro do VS Code. O jogador começa administrando um pequeno feudo e precisa desenvolver sua economia, distribuir trabalhadores, construir edifícios, treinar tropas, recrutar heróis e enviar expedições. A longo prazo, poderá explorar regiões, conquistar territórios, estabelecer alianças e interagir com outros jogadores.

O jogo **não é sobre programação**. O VS Code é apenas a interface: o jogador interage com árvores de navegação, painéis administrativos, tabelas, notificações e comandos, sem precisar escrever código. A experiência deve funcionar em sessões curtas, de 2 a 10 minutos, e continuar progredindo enquanto o editor está fechado.

### Pilares de design

1. **Decisões estratégicas, não cliques repetitivos:** escolhas de alocação e investimento importam mais que frequência de acesso.
2. **Progressão persistente:** produção, construções, treinamentos e missões respeitam o tempo decorrido.
3. **Interface discreta e eficiente:** aparência de painel administrativo integrado ao VS Code; legível, responsiva e compatível com temas claro/escuro.
4. **Economia com escolhas reais:** crescer rápido, defender-se, explorar ou especializar-se em comércio.
5. **Começar simples:** primeiro um jogo local e single-player; multiplayer, conquistas e PvP ficam para versões posteriores.

### Fantasia do jogador

Começar como senhor de **Pedra Alta**, um pequeno feudo com cinco aldeões e recursos escassos, e transformá-lo em um reino próspero com exércitos, heróis, guildas e influência sobre regiões vizinhas.

---

## 2. Loop principal

1. Abrir o painel do feudo e verificar recursos, população e eventos.
2. Distribuir aldeões entre produção de comida, madeira, pedra e ouro.
3. Investir recursos em construções e melhorias; planejar expansão e capacidade produtiva.
4. Iniciar treinamento de unidades ou expedições (quando desbloqueados).
5. Encerrar a sessão; processos temporizados continuam com base nos timestamps salvos.
6. Voltar para coletar resultados, resolver eventos e decidir os próximos passos.

**Duração ideal:** 2–10 minutos por sessão; produção passiva e tarefas variando de poucos minutos a algumas horas.

---

## 3. Mundo, tom e progressão

- **Ambientação:** fantasia medieval própria, com feudos humanos, florestas antigas, ruínas, monstros e guildas de aventureiros.
- **Tom:** estratégia acessível, com decisões econômicas relevantes e descoberta gradual do mundo.
- **Mapa (futuro):** regiões com biomas, recursos especiais, perigos e posições estratégicas. O MVP não exige mapa gráfico.
- **Progressão inicial:** Acampamento → Aldeia → Vila → Cidade fortificada → Reino (nomes sujeitos a ajuste).
- **Especializações futuras:** Comércio, Guerra ou Exploração. Evitar vantagens irreversíveis no início.

---

## 4. Recursos e economia

### Recursos básicos

| Recurso | Produção principal | Usos principais |
|---|---|---|
| Comida | Fazenda | Sustentar população, recrutar e manter tropas, expedições |
| Madeira | Serraria | Edifícios, melhorias, algumas unidades |
| Pedra | Pedreira | Estruturas avançadas, muralhas e defesa |
| Ouro | Mina / comércio | Recrutamento, pesquisas e mercado futuro |

### População

- Cada feudo possui **população total**, **trabalhadores disponíveis** e **capacidade habitacional**.
- Trabalhadores podem ser alocados nas quatro atividades produtivas; o mesmo trabalhador não pode produzir dois recursos simultaneamente.
- O jogador pode realocar trabalhadores sem custo no MVP.
- Novos aldeões podem ser recrutados pela prefeitura, com custo de comida e tempo de espera.
- Habitações aumentam a capacidade populacional.

### Regras econômicas propostas para o MVP

Os valores abaixo são **parâmetros iniciais de balanceamento**, não definições imutáveis:

| Parâmetro | Valor inicial |
|---|---:|
| População inicial | 5 aldeões |
| Capacidade inicial | 10 aldeões |
| Comida inicial | 180 |
| Madeira inicial | 120 |
| Pedra inicial | 65 |
| Ouro inicial | 250 |
| Produção por trabalhador/h — fazenda | 10 comida |
| Produção por trabalhador/h — serraria | 8 madeira |
| Produção por trabalhador/h — pedreira | 5 pedra |
| Produção por trabalhador/h — mina | 4 ouro |
| Consumo de comida | 1 por aldeão/h |

**Fórmula de produção (MVP):**

`produção/h = trabalhadores_alocados × taxa_base × bônus_do_edifício`

`produção_líquida_de_comida/h = produção_da_fazenda/h − população × consumo_por_aldeão/h`

**Fórmula de bônus do edifício (MVP):** `1 + 0,20 × (nível − 1)`. Um edifício nível 1 não fornece bônus extra; um nível 2 fornece +20%.

**Cálculo offline:** ao abrir a extensão ou executar uma ação, calcular o intervalo desde `lastProcessedAt` e aplicar a produção/consumo equivalente, inclusive com o aplicativo fechado. Para evitar diferenças entre ações, usar uma única função de atualização da simulação antes de processar cada comando.

**Recursos limitados e escassez:** recursos nunca ficam negativos. Se a comida não for suficiente para cobrir o consumo de um período, aplicar apenas a quantidade disponível e registrar um evento de escassez. A partir desse momento, interromper o recrutamento e aplicar penalidade temporária de produção de 25% até haver comida novamente. Implementar o ponto de início da escassez de forma determinística; não deixar um cálculo offline prolongado produzir recursos impossíveis.

**Arredondamento:** manter valores internos com precisão suficiente e arredondar apenas na apresentação; custos e estoques não podem gerar recursos gratuitos por repetição de ações.

**Capacidade de armazenamento (versão posterior):** celeiro/depósito e limites por recurso. No MVP, não limitar estoque.

---

## 5. Edifícios

| Edifício | Função | Disponibilidade |
|---|---|---|
| Prefeitura | Identidade do feudo, gestão de aldeões, desbloqueios | MVP |
| Fazenda | Produção de comida | MVP |
| Serraria | Produção de madeira | MVP |
| Pedreira | Produção de pedra | MVP |
| Mina | Produção de ouro | MVP |
| Habitações | Aumentar limite populacional | MVP |
| Quartel | Recrutar soldados | Pós-MVP |
| Muralha | Resistência em ataques | Pós-MVP |
| Taverna / Guilda | Contratar heróis e iniciar missões | Pós-MVP |
| Mercado | Trocar recursos e negociar | Pós-MVP |
| Academia | Pesquisar tecnologias | Futuro |

### Mecânica de construção e melhoria

- Cada edifício possui nível, custo de melhoria, duração e pré-requisitos.
- No MVP, existe **uma fila de construção por feudo**, com uma obra ativa de cada vez; outras melhorias podem ser planejadas visualmente, mas não serão iniciadas automaticamente.
- Os custos são descontados ao iniciar a obra; a melhoria passa a valer apenas após a conclusão.
- Não é possível melhorar simultaneamente o mesmo edifício nem iniciar uma obra sem recursos ou pré-requisitos.
- Uma notificação avisa quando a obra termina.

**Exemplos iniciais:**

| Melhoria | Custo | Tempo | Efeito |
|---|---|---|---|
| Serraria 1 → 2 | 100 madeira + 50 pedra | 5 min | +20% produção da serraria |
| Fazenda 1 → 2 | 80 madeira + 40 ouro | 5 min | +20% produção da fazenda |
| Habitações 1 → 2 | 80 madeira + 20 pedra | 4 min | +5 vagas populacionais |

Custos e tempos de outros níveis devem vir de configuração, nunca ficar espalhados entre interface e motor de jogo.

---

## 6. Missões, guildas e heróis (primeira expansão)

Depois que a economia local estiver pronta, introduzir um sistema de RPG de guilda.

### Heróis

- Classes iniciais: Guerreiro, Arqueiro e Mago.
- Atributos: vida, ataque, defesa, velocidade, nível e experiência.
- Equipamentos: arma, armadura e acessório (introduzir gradualmente).
- Cada herói pode participar de apenas uma missão por vez.
- Heróis podem receber ferimentos e precisar de recuperação; morte permanente deve ser uma configuração de dificuldade futura, não uma surpresa no MVP.

### Missões

| Missão | Duração ilustrativa | Risco | Recompensas |
|---|---:|---|---|
| Patrulhar os arredores | 5 min | Baixo | Ouro, experiência |
| Explorar a Floresta Antiga | 15 min | Médio | Madeira, equipamentos comuns |
| Investigar ruínas | 30 min | Médio | Pedra, ouro, itens raros |
| Caçar o dragão | 2 h | Alto | Recursos raros, experiência, equipamento épico |

Fluxo: escolher missão → selecionar heróis → consultar previsão de risco e possíveis recompensas → enviar equipe → aguardar conclusão → receber relatório de eventos e recompensas.

**Resolução futura:** combinar atributos da equipe, vantagens de classe, dificuldade da missão e sorte limitada; usar um gerador pseudoaleatório com seed para permitir testes reproduzíveis.

---

## 7. Exércitos, combate e expansão (segunda expansão)

Inspirado em Age of Empires e Warcraft III, mas **sem microgerenciamento em tempo real**.

- **Unidades:** Espadachim, Lanceiro, Arqueiro, Cavaleiro e unidades de cerco.
- **Composição:** forças e fraquezas entre tipos de unidade; evitar uma única composição dominante.
- **Preparação:** definir comandante, formação, objetivo e suprimentos.
- **Combate:** resolução automática em rodadas, com resultados explicáveis por atributos, terreno, composição e moral.
- **Relatório:** baixas, dano causado, experiência, saque e razões do resultado.
- **Expansão:** explorar, fundar postos, conquistar regiões neutras e administrar múltiplos feudos.
- **PvP e alianças:** apenas depois de economia, combate e proteção de contas estarem estáveis.

Não implementar esta seção no MVP inicial. Ela orienta decisões de arquitetura e balanceamento futuras.

---

## 8. Interface e experiência no VS Code

O jogo deve parecer uma ferramenta nativa do editor e ser utilizável apenas com mouse, sem exigir terminal nem edição de arquivos.

### Estrutura sugerida

**Activity Bar:** ícone próprio da extensão, abrindo a área “Lords of the Guild”.

**Side Bar / TreeView:**

```text
LORDS OF THE GUILD
├── Visão geral
├── Feudo: Pedra Alta
│   ├── Recursos
│   ├── População
│   ├── Construções
│   └── Eventos
├── Guilda                [futuro]
│   ├── Heróis
│   └── Missões
├── Exército              [futuro]
├── Mapa                  [futuro]
└── Configurações
```

**Webview central:** painel com cartões de recursos, taxas por hora, distribuição de trabalhadores, lista de construções e botões de ação. Mostrar tempos de conclusão e custos antes de confirmar uma operação.

**Status Bar (opcional):** exibir uma informação curta, como “Pedra Alta · Obra pronta”, sem excesso de notificações.

**Notificações:** avisos para obras finalizadas, aldeões recrutados, missões concluídas e falta de comida. Permitir silenciar avisos.

**Acessibilidade:** navegação por teclado, contraste adequado, não depender apenas de cores, números formatados em pt-BR e compatibilidade com temas do VS Code.

### Exemplo de tela

```text
PEDRA ALTA                                  Nível 1
População: 5/10       Aldeões livres: 1

RECURSOS               ESTOQUE      POR HORA
Comida                    180          +15
Madeira                   120           +8
Pedra                      65           +5
Ouro                      250            0

TRABALHADORES
Fazenda                     2   [-] [+]
Serraria                    1   [-] [+]
Pedreira                    1   [-] [+]
Mina                        0   [-] [+]

CONSTRUÇÕES
Serraria Nv.1     [Melhorar: 100 madeira, 50 pedra]
Fazenda Nv.1      [Melhorar: 80 madeira, 40 ouro]
Habitações Nv.1   [Melhorar: 80 madeira, 20 pedra]

OBRA ATIVA
Nenhuma
```

**Observação:** os +15 de comida/h já consideram produção de 2 trabalhadores (20/h) menos o consumo de 5 aldeões (5/h). Usar o motor de simulação como única fonte da verdade; jamais fixar números de demonstração na UI.

---

## 9. Arquitetura sugerida

### MVP local (prioridade)

- **Extensão:** TypeScript + VS Code Extension API.
- **Interface:** Webview com HTML/CSS/TypeScript; framework opcional somente se trouxer ganho real.
- **Motor de jogo:** pacote TypeScript puro, isolado de APIs do VS Code, determinístico e testável.
- **Persistência:** `ExtensionContext.globalState` para protótipo pequeno; prever migração para armazenamento local versionado caso o estado cresça.
- **Relógio:** timestamps UTC e cálculo de progresso baseado em tempo decorrido, sem depender de timers ativos enquanto o editor estiver fechado.
- **Comunicação:** mensagens tipadas entre Webview e extensão, com validação dos comandos no motor de jogo.
- **Testes:** Vitest ou equivalente para produção, consumo, custos, construção e progresso offline.

### Estrutura de pastas sugerida

```text
lords-of-the-guild/
├── README.md
├── GAME_DESIGN.md
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── game/
│   │   ├── types.ts
│   │   ├── balance.ts
│   │   ├── simulation.ts
│   │   ├── commands.ts
│   │   └── initialState.ts
│   ├── persistence/
│   │   └── gameRepository.ts
│   ├── vscode/
│   │   ├── dashboardPanel.ts
│   │   └── navigationProvider.ts
│   └── webview/
│       ├── index.html
│       ├── main.ts
│       └── styles.css
└── tests/
    ├── simulation.test.ts
    └── commands.test.ts
```

### Modelo de dados inicial (conceitual)

```ts
type Resource = 'food' | 'wood' | 'stone' | 'gold';
type Building = 'townHall' | 'farm' | 'lumberMill' | 'quarry' | 'goldMine' | 'housing';

type GameState = {
  schemaVersion: number;
  settlement: {
    id: string;
    name: string;
    level: number;
    population: number;
    housingCapacity: number;
    resources: Record<Resource, number>;
    workers: Record<Resource, number>;
    buildings: Record<Building, number>;
  };
  activeConstruction: null | {
    building: Building;
    targetLevel: number;
    startedAt: string;
    finishesAt: string;
  };
  recruitmentQueue: Array<{
    quantity: number;
    finishesAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
  lastProcessedAt: string;
};
```

Os tipos acima são um ponto de partida, não contrato imutável. A capacidade populacional pode ser calculada a partir das construções para evitar divergência de estado; caso seja persistida, deve ser validada na atualização.

### Multiplayer futuro (não criar agora)

- Backend Node.js com API (NestJS ou Express), PostgreSQL para estado persistente e Redis somente onde houver necessidade real de filas/cache.
- Simulação e validação de ações **no servidor**, com controle de concorrência e idempotência para impedir recursos duplicados.
- Autenticação, proteção contra automação abusiva, logs de operações e regras de PvP antes de abrir o mundo compartilhado.
- Não reutilizar `globalState` como fonte de verdade em multiplayer; ele pode guardar preferências ou cache local.

---

## 10. Escopo exato do MVP v0.1

**Implementar:**

- [ ] Criar extensão que abre pelo Activity Bar.
- [ ] Exibir painel do feudo com recursos, população e taxas de produção/consumo.
- [ ] Criar estado inicial reproduzível para “Pedra Alta”.
- [ ] Distribuir e realocar aldeões entre as quatro atividades produtivas.
- [ ] Calcular produção passiva e consumo de comida com timestamps UTC.
- [ ] Salvar/carregar partida ao fechar e reabrir o VS Code.
- [ ] Melhorar Fazenda, Serraria, Pedreira, Mina e Habitações.
- [ ] Implementar uma obra ativa por vez, com custo, duração e conclusão automática.
- [ ] Recrutar novos aldeões com limite de habitação, custo e duração configuráveis.
- [ ] Mostrar feed de eventos e alertas de escassez.
- [ ] Adicionar comando **Reiniciar partida** com confirmação.
- [ ] Escrever testes unitários para regras econômicas e progresso offline.

**Não implementar ainda:** mapa, exército, batalhas, heróis, PvP, mercado global, autenticação, pagamentos, servidor remoto, animações complexas ou gráficos 3D.

### Critérios de aceitação

1. O usuário instala a extensão, abre o painel e encontra uma partida nova sem configuração manual.
2. Alocar mais um trabalhador na serraria altera imediatamente a taxa de madeira/h e reduz o número de livres.
3. Não é possível alocar mais trabalhadores do que a população total nem gastar recursos que não existem.
4. Uma melhoria desconta recursos exatamente uma vez, ocupa a fila e termina após o tempo configurado.
5. Fechar o VS Code e reabrir depois simula corretamente o intervalo transcorrido sem duplicar progresso.
6. O consumo de comida e a escassez são tratados mesmo quando há um longo período offline.
7. Salvar/recarregar não duplica construções, trabalhadores ou recursos; o reset só acontece após confirmação.
8. As regras de jogo funcionam em testes sem abrir o VS Code.

---

## 11. Roadmap

| Fase | Objetivo | Entregável |
|---|---|---|
| v0.1 — Fundação | Economia local e interface VS Code | Feudo jogável com construção e trabalhadores |
| v0.2 — Progressão | Desbloqueios, eventos e missões simples | Mais decisões e objetivos de médio prazo |
| v0.3 — Guilda | Heróis, equipamentos e expedições | RPG assíncrono com relatórios |
| v0.4 — Guerra | Quartel, tropas e combate automático | Camada militar single-player |
| v0.5 — Mundo | Exploração, mapa e múltiplos feudos | Expansão territorial |
| v1.0 — Multiplayer | Contas, alianças, economia compartilhada e PvP | Mundo persistente no servidor |

Reavaliar cada etapa com partidas de teste e métricas simples de engajamento antes de acrescentar novos sistemas.

---

## 12. Primeira tarefa para o Codex

> **Objetivo:** implementar apenas a v0.1 descrita neste documento.
>
> 1. Leia `GAME_DESIGN.md` e crie a base de uma extensão VS Code em TypeScript.
> 2. Primeiro implemente e teste o motor econômico isolado, com funções determinísticas para avançar o estado até determinado timestamp e validar comandos.
> 3. Depois crie o painel Webview com recursos, população, alocação de trabalhadores e construções.
> 4. Persista o estado com schema versionado e sincronize a Webview com a extensão por mensagens tipadas.
> 5. Inclua testes para offline progress, custo de construção, fila única, escassez, alocação inválida e recarregamento sem duplicação.
> 6. Documente os comandos para instalar dependências, compilar, executar com F5 (Extension Development Host) e rodar testes.
> 7. Não adicione multiplayer, autenticação, microtransações ou bibliotecas desnecessárias nesta fase.

## 13. Questões em aberto para depois do protótipo

- Mundo totalmente medieval humano ou fantasia com diferentes raças e facções?
- Batalhas de PvP com risco de perder territórios ou apenas recursos e posição no ranking?
- Quanto tempo um jogador casual deve levar para atingir a segunda cidade?
- Existe limite diário para ações estratégicas ou somente custos e tempos de espera?
- Como evitar que um jogador veterano torne impossível a entrada de novos jogadores no multiplayer?
- Heróis podem morrer permanentemente, ou apenas ficar feridos?

**Regra de produto:** nenhuma questão em aberto deve bloquear o desenvolvimento do MVP local.
