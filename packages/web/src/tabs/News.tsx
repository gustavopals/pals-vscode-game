import { newsForVersion } from '../news/entries';

/** Crônicas editoriais: nenhuma regra de jogo é calculada nesta página. */
export function NewsTab(props: { serverVersion: string | null }) {
  return (
    <main class="document news" aria-labelledby="news-title">
      <h1 id="news-title" tabIndex={-1}>
        Novidades
      </h1>
      <p class="lead">As últimas crônicas do reino. Veja o que mudou e o que pode fazer agora.</p>
      <p class="muted">
        {props.serverVersion === null
          ? 'Não foi possível confirmar a versão deste reino. O histórico continua disponível.'
          : `Versão deste reino: ${props.serverVersion}.`}
      </p>
      {newsForVersion(props.serverVersion).map((entry) => (
        <article key={entry.version} class="news-entry" aria-labelledby={`news-${entry.version}`}>
          <h2 id={`news-${entry.version}`}>
            <span>
              v{entry.version} · {entry.title}
            </span>
            {entry.status === 'draft' ? <span class="chip">Em preparação</span> : null}
          </h2>
          <p class="muted">
            {entry.status === 'draft' ? 'Rascunho de ' : 'Publicada em '}
            <time dateTime={entry.date}>{entry.date.split('-').reverse().join('/')}</time>
          </p>
          {entry.status === 'draft' ? (
            <p class="news-draft-note">
              Esta versão ainda não foi publicada. Os relatos abaixo descrevem o que está previsto.
              O conteúdo será confirmado na publicação; nem tudo está disponível para jogar.
            </p>
          ) : null}
          <p>{entry.introduction}</p>
          <ul>
            {entry.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </article>
      ))}
    </main>
  );
}
