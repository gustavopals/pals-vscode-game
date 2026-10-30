/** Notícias editoriais do app: ações em palavras, sem números de regra ou conteúdo oculto. */
export type NewsEntry = {
  version: string;
  title: string;
  /** Data de publicação; em rascunho, data da redação, explicitamente indicada na tela. */
  date: string;
  status: 'published' | 'draft';
  introduction: string;
  changes: readonly string[];
};

/** Uma crônica por versão, da mais nova para a mais antiga. */
export const NEWS_ENTRIES: readonly NewsEntry[] = [
  // RASCUNHO A CONFIRMAR NA PUBLICAÇÃO: a v0.4 ainda não foi publicada.
  // A data abaixo é de redação. Conferir escopo e data real antes de mudar o status.
  // Fontes: docs/roadmap-v0.4.md (Fases B a H), CLAUDE.md; pendência N-1.
  {
    version: '0.4.0',
    title: 'Guerra e Cerco',
    date: '2026-10-30',
    status: 'draft',
    introduction:
      'Os vigias olham para além dos campos. A próxima crônica prepara o feudo para a guerra.',
    changes: [
      'Busque ferro na Mina Abandonada. Erga o Ferreiro, forje armas e repare o equipamento gasto dos heróis.',
      'Erga o Quartel e treine soldados para guardar o feudo.',
      'Salve formações, escolha os comandantes das alas e mantenha uma Defesa ativa.',
      'Consulte o Conselho de Guerra antes de lutar. Leia o relato da batalha para conhecer o destino de cada ala.',
      'Erga a Muralha de Pedra e o Baluarte. Repare as alas feridas e prepare a Torre para a defesa.',
      'Enfrente incursões em batalha com a formação que deixou de guarda.',
      'Observe uma Horda que aprende com suas defesas. Leia os presságios dos vigias e prepare outra resposta.',
      'Escolha a Hora da Vigília nas Preferências para preparar sua guarda.',
      'Siga os novos objetivos do Senhor para conhecer o Ferreiro, o Quartel e o Conselho de Guerra.',
      'Receba novas cartas do Conselho. Ouça refugiados, viajantes e veteranos que chegam aos portões.',
      'Envie heróis para sabotar a Fortaleza da Horda e enfraquecer o que marcha contra o feudo.',
      'Marche contra o Acampamento de Saqueadores. Pese o risco de deixar a casa sem quem partiu.',
      'Prepare um Plano de Batalha para o Cerco do inverno. Atravesse as ondas da Horda e cuide do rescaldo.',
    ],
  },
  // Fontes: docs/retomada-v0.3.md e CLAUDE.md (publicação de 2026-10-15).
  {
    version: '0.3.0',
    title: 'A Guilda',
    date: '2026-10-15',
    status: 'published',
    introduction: 'A estrada trouxe companhia. Agora há heróis à mesa e jornadas além da paliçada.',
    changes: [
      'Acolha a estrangeira que chega pelo Conselho. Contrate outros heróis na Taverna e cuide do soldo da equipe.',
      'Dê um festival na Taverna para alegrar o povo.',
      'Erga a Guilda dos Aventureiros. Reúna heróis, escolha uma Postura e envie expedições.',
      'Decida o caminho nas encruzilhadas. Leia os relatórios, equipe os achados e envie um Resgate por quem ficou cativo.',
      'Explore novos destinos e limpe o Covil de Lobos.',
      'Negocie no Mercado. Envie caravanas e escolha quem acompanha a carga pela estrada.',
      'Acolha Mestres trazidos das jornadas e escolha onde seu ofício ajudará o feudo.',
      'Siga novos objetivos e confira a Guilda no Relatório de Retorno e em Antes de partir.',
    ],
  },
  // Fonte: docs/relatorio-v0.2.md; data da tag e da release, após os ajustes de fechamento.
  {
    version: '0.2.0',
    title: 'Estações e Conselho',
    date: '2026-10-05',
    status: 'published',
    introduction: 'O ano ganhou peso. O Conselho acendeu suas velas e os lobos desceram a serra.',
    changes: [
      'Escolha o ritmo e a dificuldade ao fundar um feudo.',
      'Prepare a colheita para as estações e reserve lenha para atravessar o inverno.',
      'Erga o Celeiro e o Armazém. Veja o que enche os depósitos e o que se perde por falta de espaço.',
      'Planeje obras para começarem quando houver recursos e amplie o Salão para abrir outra frente de trabalho.',
      'Cuide do ofício dos trabalhadores e da moral do povo. Confira o que preparar em Antes de partir.',
      'Decida as cartas do Conselho e acompanhe na Crônica o retorno de suas escolhas.',
      'Erga a Torre de Vigia para conhecer a Ameaça. Prepare a Paliçada contra as incursões dos lobos.',
      'Leia no Relatório de Retorno o que prosperou, o que exigiu um preço e o que ainda pode decidir.',
    ],
  },
  // Fontes: docs/acceptance-v0.1.md e GAME_DESIGN.md §16.1.
  {
    version: '0.1.0',
    title: 'Fundação do feudo',
    date: '2026-10-01',
    status: 'published',
    introduction: 'Pedra Alta abriu seus portões. O primeiro capítulo do reino começou.',
    changes: [
      'Funde seu feudo no navegador e dê suas ordens pela bancada ou pela paleta.',
      'Distribua aldeões entre os ofícios, recrute moradores e erga os edifícios do feudo.',
      'Planeje as obras e acompanhe a produção enquanto cuida de outros assuntos.',
      'Volte para ler a Crônica e o Relatório de Retorno. Consulte o último estado guardado quando faltar ligação.',
      'Gere um Código do Reino para retomar seu feudo em outro navegador.',
      'Escolha um tema claro, escuro ou de alto contraste e governe também pelo teclado.',
    ],
  },
];

/** Só versões estáveis confirmam uma publicação; uma prévia do servidor não a anuncia. */
function versionParts(version: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(version);
  if (match === null) return null;
  const parts = match.slice(1, 4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareNewsVersions(left: string, right: string): number | null {
  const a = versionParts(left);
  const b = versionParts(right);
  if (a === null || b === null) return null;
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** O rascunho nunca é a versão nova que acende o selo. */
export function latestPublishedNews(serverVersion: string | null): NewsEntry | null {
  if (serverVersion === null) return null;
  return (
    NEWS_ENTRIES.find((entry) => {
      const compared = compareNewsVersions(entry.version, serverVersion);
      return entry.status === 'published' && compared !== null && compared <= 0;
    }) ?? null
  );
}

/** Sem consulta de versão, o histórico continua legível, sem afirmar o que está neste reino. */
export function newsForVersion(serverVersion: string | null): readonly NewsEntry[] {
  return NEWS_ENTRIES.filter((entry) => {
    const compared =
      serverVersion === null ? null : compareNewsVersions(entry.version, serverVersion);
    return entry.status === 'draft' || compared === null || compared <= 0;
  });
}
