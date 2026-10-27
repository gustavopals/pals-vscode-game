import type { ViewState } from '@lotg/protocol';

import { THREAT_ICON } from '../ui/threat';
import { Icon } from './shared';

/**
 * Os presságios (GDD §10.6; V4E-T4): o que os vigias leram da Horda antes do ataque, na frase do
 * servidor. Um presságio nunca mente, mas pode ser vago: a onda a que ele se refere vem como
 * número ou, quando a Torre ainda não distingue, como `null` (o texto então diz o pouco que se
 * sabe). Sem presságio, nada aparece: a lista só existe quando há o que ler.
 */
export function OmensPanel(props: { army: ViewState['army'] }) {
  const omens: ReadonlyArray<{ text: string; wave: number | null }> = props.army.omens;
  if (omens.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="omens-title" class="omens" data-testid="omens">
      <h3 id="omens-title">Presságios</h3>
      <ul class="omens-list">
        {omens.map((omen) => (
          <li key={`${omen.wave ?? 'x'}:${omen.text}`}>
            <Icon name={THREAT_ICON} />{' '}
            {omen.wave === null ? null : <strong>Onda {omen.wave}: </strong>}
            {omen.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
