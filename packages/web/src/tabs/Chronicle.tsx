import type { Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { Icon } from '../components/shared';
import { chronicleAnchor, type ChronicleLine, parseChronicle } from './markdown';

/**
 * Leva à linha da escolha anterior: rola até ela e põe o foco nela, para quem usa o teclado ou um
 * leitor de tela continuar a leitura dali. Não é um link de endereço: o `#` da página é das abas.
 */
function goToLine(n: number): void {
  const line = document.getElementById(chronicleAnchor(n));
  line?.scrollIntoView({ block: 'center' });
  line?.focus();
}

/**
 * Uma linha da Crônica. A de uma carta que continua outra traz, logo abaixo, "Sua escolha
 * voltou" e a frase da escolha (roadmap da v0.2, V2D-T4.3): lê-se ali mesmo de onde a história
 * vem, e o botão leva à linha da escolha, sem reler dezenas de entradas. A de uma expedição com
 * relatório guardado traz "Ver o relatório", que abre a folha dela na aba Guilda.
 */
function Line(props: { line: ChronicleLine; report: string | undefined; actions: Actions }) {
  const { n, text, echo } = props.line;
  const { report } = props;
  return (
    // O foco só chega aqui pelo botão de uma continuação: a linha não entra na ordem do Tab.
    <li id={chronicleAnchor(n)} tabIndex={-1}>
      {text}
      {report === undefined ? null : (
        <>
          {' '}
          <button
            type="button"
            class="link"
            onClick={() => props.actions.run('lords.openReport', report)}
          >
            Ver o relatório
          </button>
        </>
      )}
      {echo === undefined ? null : (
        <span class="chronicle-echo">
          <Icon name="history" />{' '}
          {echo.target === null ? (
            echo.label
          ) : (
            <button
              type="button"
              class="link"
              title="Ir à linha dessa escolha"
              onClick={() => goToLine(echo.target ?? n)}
            >
              {echo.label}
            </button>
          )}
          : “{echo.quote}”
        </span>
      )}
    </li>
  );
}

/**
 * A Crônica inteira do feudo, como texto formatado, com o download em Markdown.
 *
 * A linha de uma expedição liga ao relatório dela **enquanto ele estiver guardado**: o
 * documento traz, em cada linha de expedição, o identificador dela (`ChronicleLine.expeditionId`,
 * a marca de `?links=1`), e `reports` são os relatórios que a visão guarda (`keptReports`). A
 * ligação é pelo identificador, nunca pela frase: duas jornadas com a mesma linha levam cada uma
 * ao seu relatório. Quando ele sai da lista dos guardados, a linha continua legível sozinha.
 */
export function ChronicleTab(props: {
  document: Loadable<string>;
  /** As expedições que têm relatório guardado na visão. */
  reports?: ReadonlySet<string>;
  actions: Actions;
}) {
  const { document: chronicle, actions } = props;
  if (chronicle.status === 'error') {
    return (
      <div class="document">
        <p class="warning" role="alert">
          {chronicle.message}
        </p>
        <button type="button" onClick={() => actions.run('lords.openChronicle')}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (chronicle.status !== 'ready') {
    return (
      <p class="muted loading" role="status">
        Abrindo a Crônica…
      </p>
    );
  }
  return (
    <article class="document">
      <div class="row">
        <button
          type="button"
          class="secondary"
          onClick={() => actions.run('lords.downloadChronicle')}
        >
          Baixar Crônica (Markdown)
        </button>
      </div>
      {parseChronicle(chronicle.value).map((block, index) => {
        switch (block.kind) {
          case 'title':
            return <h1 key={index}>{block.text}</h1>;
          case 'heading':
            return <h2 key={index}>{block.text}</h2>;
          case 'list':
            return (
              <ul key={index}>
                {block.items.map((line) => (
                  <Line
                    key={line.n}
                    line={line}
                    report={
                      line.expeditionId !== undefined && props.reports?.has(line.expeditionId)
                        ? line.expeditionId
                        : undefined
                    }
                    actions={actions}
                  />
                ))}
              </ul>
            );
          case 'note':
            return (
              <p key={index} class="muted">
                {block.text}
              </p>
            );
          case 'paragraph':
            return <p key={index}>{block.text}</p>;
        }
      })}
    </article>
  );
}
