import type { Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { parseChronicle } from './markdown';

/** A Crônica inteira do feudo, como texto formatado, com o download em Markdown. */
export function ChronicleTab(props: { document: Loadable<string>; actions: Actions }) {
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
                {block.items.map((item, position) => (
                  <li key={position}>{item}</li>
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
