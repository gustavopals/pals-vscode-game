import { describe, expect, it } from 'vitest';

import {
  DialogService,
  filterItems,
  moveSelection,
  nextFocusIndex,
  type PickItem,
} from './dialogs';

/** Um serviço de diálogos com o contador de avisos de mudança. */
function setup() {
  const dialogs = new DialogService();
  const seen = { changes: 0 };
  const unsubscribe = dialogs.onChange(() => {
    seen.changes += 1;
  });
  return { dialogs, seen, unsubscribe };
}

/** O id do diálogo à vista; falha o teste se não houver nenhum. */
function currentId(dialogs: DialogService): number {
  const current = dialogs.current;
  if (current === null) {
    throw new Error('Nenhum diálogo à vista.');
  }
  return current.id;
}

describe('fila de diálogos', () => {
  it('começa sem diálogo à vista', () => {
    expect(new DialogService().current).toBeNull();
  });

  it('mostra um diálogo de cada vez, na ordem em que foram pedidos', async () => {
    const { dialogs } = setup();
    const first = dialogs.confirm({ title: 'Primeiro?', confirmLabel: 'Sim' });
    const second = dialogs.input({ title: 'Segundo' });
    const third = dialogs.pick({ title: 'Terceiro', items: [{ label: 'A', value: 'a' }] });

    expect(dialogs.current?.state).toMatchObject({ kind: 'confirm', title: 'Primeiro?' });
    dialogs.resolve(currentId(dialogs), true);
    expect(await first).toBe(true);

    expect(dialogs.current?.state).toMatchObject({ kind: 'input', title: 'Segundo' });
    dialogs.resolve(currentId(dialogs), 'Pedra Alta');
    expect(await second).toBe('Pedra Alta');

    expect(dialogs.current?.state).toMatchObject({ kind: 'pick', title: 'Terceiro' });
    dialogs.resolve(currentId(dialogs), 'a');
    expect(await third).toBe('a');
    expect(dialogs.current).toBeNull();
  });

  it('cada diálogo tem um id próprio', () => {
    const { dialogs } = setup();
    void dialogs.input({ title: 'Um' });
    const first = currentId(dialogs);
    dialogs.cancel();
    void dialogs.input({ title: 'Dois' });
    expect(currentId(dialogs)).not.toBe(first);
  });

  it('responder um diálogo que não existe (ou já fechado) não faz nada', async () => {
    const { dialogs, seen } = setup();
    const answer = dialogs.input({ title: 'Nome' });
    const id = currentId(dialogs);
    dialogs.resolve(id, 'Gustavo');
    expect(await answer).toBe('Gustavo');
    const changes = seen.changes;

    dialogs.resolve(id, 'outra resposta');
    dialogs.resolve(9999, 'nada');
    expect(seen.changes).toBe(changes);
    expect(dialogs.current).toBeNull();
  });

  it('responder um diálogo que espera na fila não tira o da frente', async () => {
    const { dialogs } = setup();
    const first = dialogs.input({ title: 'Frente' });
    const frontId = currentId(dialogs);
    const info = dialogs.info({ title: 'Atrás', paragraphs: [] });

    info.close();
    await info.closed;
    expect(info.isOpen()).toBe(false);
    expect(currentId(dialogs)).toBe(frontId);

    dialogs.resolve(frontId, 'ok');
    expect(await first).toBe('ok');
    expect(dialogs.current).toBeNull();
  });

  it('cancelar (Esc) desiste só do diálogo à vista', async () => {
    const { dialogs } = setup();
    const first = dialogs.input({ title: 'Primeiro' });
    const second = dialogs.input({ title: 'Segundo' });
    dialogs.cancel();
    expect(await first).toBeUndefined();
    expect(dialogs.current?.state).toMatchObject({ title: 'Segundo' });
    dialogs.resolve(currentId(dialogs), 'fica');
    expect(await second).toBe('fica');
  });

  it('cancelar sem diálogo à vista não faz nada', () => {
    const { dialogs, seen } = setup();
    dialogs.cancel();
    expect(seen.changes).toBe(0);
    expect(dialogs.current).toBeNull();
  });

  it('avisa quando um diálogo abre e quando fecha', () => {
    const { dialogs, seen, unsubscribe } = setup();
    void dialogs.confirm({ title: 'Sair?', confirmLabel: 'Sair' });
    expect(seen.changes).toBe(1);
    dialogs.cancel();
    expect(seen.changes).toBe(2);

    // Quem deixou de assinar não é mais avisado.
    unsubscribe();
    void dialogs.confirm({ title: 'De novo?', confirmLabel: 'Sim' });
    expect(seen.changes).toBe(2);
  });
});

describe('confirmação', () => {
  it('só é verdadeira quando o jogador confirma', async () => {
    const { dialogs } = setup();
    const confirmed = dialogs.confirm({ title: 'Excluir a conta?', confirmLabel: 'Excluir' });
    dialogs.resolve(currentId(dialogs), true);
    expect(await confirmed).toBe(true);

    const refused = dialogs.confirm({ title: 'Excluir a conta?', confirmLabel: 'Excluir' });
    dialogs.resolve(currentId(dialogs), false);
    expect(await refused).toBe(false);
  });

  it('desistir (Esc ou clique fora) conta como não', async () => {
    const { dialogs } = setup();
    const answer = dialogs.confirm({ title: 'Excluir a conta?', confirmLabel: 'Excluir' });
    dialogs.cancel();
    expect(await answer).toBe(false);
  });

  it('guarda o título, os detalhes e os rótulos para quem desenha', () => {
    const { dialogs } = setup();
    void dialogs.confirm({
      title: 'Nova partida?',
      detail: ['O feudo atual será arquivado.'],
      confirmLabel: 'Fundar outro feudo',
      cancelLabel: 'Continuar aqui',
    });
    expect(dialogs.current?.state).toEqual({
      kind: 'confirm',
      title: 'Nova partida?',
      detail: ['O feudo atual será arquivado.'],
      confirmLabel: 'Fundar outro feudo',
      cancelLabel: 'Continuar aqui',
    });
  });
});

describe('campo de texto e lista de escolha', () => {
  it('o campo devolve o texto, ou undefined na desistência', async () => {
    const { dialogs } = setup();
    const typed = dialogs.input({ title: 'Nome do feudo', value: 'Pedra Alta' });
    dialogs.resolve(currentId(dialogs), 'Vale Verde');
    expect(await typed).toBe('Vale Verde');

    const given = dialogs.input({ title: 'Nome do feudo' });
    dialogs.cancel();
    expect(await given).toBeUndefined();
  });

  it('um texto vazio é resposta, não desistência', async () => {
    const { dialogs } = setup();
    const typed = dialogs.input({ title: 'Nome' });
    dialogs.resolve(currentId(dialogs), '');
    expect(await typed).toBe('');
  });

  it('a validação do campo acompanha o diálogo', () => {
    const { dialogs } = setup();
    const validate = (value: string) =>
      value === '' ? { message: 'Diga um nome.', severity: 'error' as const } : null;
    void dialogs.input({ title: 'Nome', validate });
    const state = dialogs.current?.state;
    expect(state?.kind).toBe('input');
    if (state?.kind === 'input') {
      expect(state.validate?.('')).toEqual({ message: 'Diga um nome.', severity: 'error' });
      expect(state.validate?.('Gustavo')).toBeNull();
    }
  });

  it('a lista devolve o valor do item escolhido, ou undefined na desistência', async () => {
    const { dialogs } = setup();
    const items = [
      { label: 'Fazenda', value: 'farm' },
      { label: 'Serraria', value: 'lumberMill' },
    ];
    const chosen = dialogs.pick({ title: 'Edifício', items });
    dialogs.resolve(currentId(dialogs), 'lumberMill');
    expect(await chosen).toBe('lumberMill');

    const given = dialogs.pick({ title: 'Edifício', items });
    dialogs.cancel();
    expect(await given).toBeUndefined();
  });
});

describe('diálogo de informação', () => {
  it('fica aberto até close(), e closed resolve quando fecha', async () => {
    const { dialogs } = setup();
    const info = dialogs.info({ title: 'Código do Reino', paragraphs: ['Guarde bem.'] });
    expect(info.isOpen()).toBe(true);
    expect(dialogs.current?.state).toMatchObject({ kind: 'info', title: 'Código do Reino' });

    let closed = false;
    void info.closed.then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    info.close();
    await info.closed;
    expect(closed).toBe(true);
    expect(info.isOpen()).toBe(false);
    expect(dialogs.current).toBeNull();
  });

  it('fechado pelo jogador (Esc) também resolve closed', async () => {
    const { dialogs } = setup();
    const info = dialogs.info({ title: 'Sobre', paragraphs: [] });
    dialogs.cancel();
    await info.closed;
    expect(info.isOpen()).toBe(false);
  });

  it('update troca partes do diálogo aberto e avisa quem desenha', () => {
    const { dialogs, seen } = setup();
    const info = dialogs.info({
      title: 'Entrar com GitHub',
      paragraphs: ['Digite o código no GitHub.'],
      code: 'LOTG-0001',
      status: 'Esperando a confirmação…',
    });
    const changes = seen.changes;
    info.update({ status: 'Confirmado.' });
    expect(seen.changes).toBe(changes + 1);
    expect(dialogs.current?.state).toEqual({
      kind: 'info',
      title: 'Entrar com GitHub',
      paragraphs: ['Digite o código no GitHub.'],
      code: 'LOTG-0001',
      status: 'Confirmado.',
    });
  });

  it('update depois de fechado não reabre nem avisa', async () => {
    const { dialogs, seen } = setup();
    const info = dialogs.info({ title: 'Código', paragraphs: [] });
    info.close();
    await info.closed;
    const changes = seen.changes;
    info.update({ status: 'tarde demais' });
    expect(seen.changes).toBe(changes);
    expect(dialogs.current).toBeNull();
  });

  it('update não mexe em outro diálogo da fila', () => {
    const { dialogs } = setup();
    void dialogs.input({ title: 'Na frente' });
    const info = dialogs.info({ title: 'Atrás', paragraphs: [] });
    info.update({ title: 'Atrás, atualizado' });
    expect(dialogs.current?.state).toMatchObject({ kind: 'input', title: 'Na frente' });
    dialogs.cancel();
    expect(dialogs.current?.state).toMatchObject({ kind: 'info', title: 'Atrás, atualizado' });
  });

  it('close() duas vezes não fecha o diálogo seguinte', () => {
    const { dialogs } = setup();
    const info = dialogs.info({ title: 'Primeiro', paragraphs: [] });
    void dialogs.input({ title: 'Segundo' });
    info.close();
    info.close();
    expect(dialogs.current?.state).toMatchObject({ title: 'Segundo' });
  });
});

describe('foco preso (nextFocusIndex)', () => {
  it('Tab anda para frente e dá a volta no último', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 1, false)).toBe(2);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it('Shift+Tab anda para trás e dá a volta no primeiro', () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it('com o foco fora do diálogo, entra pelo primeiro (ou pelo último, de trás)', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it('com um elemento só, o foco fica nele', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  it('sem nada focável, não há para onde ir', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, 0, true)).toBe(-1);
  });

  it('nunca sai do intervalo, em nenhuma direção', () => {
    for (let count = 1; count <= 5; count += 1) {
      for (let current = -1; current < count; current += 1) {
        for (const backwards of [false, true]) {
          const next = nextFocusIndex(count, current, backwards);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      }
    }
  });
});

describe('filtro da lista (filterItems)', () => {
  const items: PickItem<string>[] = [
    { label: 'Lords: Ir para a Crônica', description: 'aba', value: 'chronicle' },
    {
      label: 'Lords: Construir ou melhorar',
      detail: 'Serraria, fazenda, pedreira',
      value: 'build',
    },
    { label: 'Lords: Alocar trabalhadores', description: 'aldeões livres', value: 'workers' },
    { label: 'Lords: Excluir conta', detail: 'Não há como desfazer', value: 'delete' },
  ];
  const values = (query: string) => filterItems(items, query).map((item) => item.value);

  it('sem texto (ou só espaços), devolve tudo na mesma ordem', () => {
    expect(filterItems(items, '')).toBe(items);
    expect(values('   ')).toEqual(['chronicle', 'build', 'workers', 'delete']);
  });

  it('não liga para maiúsculas nem para acentos, nos dois lados', () => {
    expect(values('cronica')).toEqual(['chronicle']);
    expect(values('CRÔNICA')).toEqual(['chronicle']);
    expect(values('aldeoes')).toEqual(['workers']);
    expect(values('NÃO')).toEqual(['delete']);
  });

  it('todas as palavras precisam aparecer, em qualquer ordem', () => {
    expect(values('conta excluir')).toEqual(['delete']);
    expect(values('excluir cronica')).toEqual([]);
    expect(values('cronica lords')).toEqual(['chronicle']);
    expect(values('lords  conta')).toEqual(['delete']);
  });

  it('procura também na descrição e no detalhe', () => {
    expect(values('livres')).toEqual(['workers']);
    expect(values('pedreira')).toEqual(['build']);
    expect(values('construir fazenda')).toEqual(['build']);
  });

  it('acha pedaços de palavra', () => {
    expect(values('trabalh')).toEqual(['workers']);
  });

  it('sem nenhum item que sirva, a lista fica vazia', () => {
    expect(values('mercado')).toEqual([]);
  });

  it('não muda a lista original', () => {
    const before = items.map((item) => item.value);
    filterItems(items, 'conta');
    expect(items.map((item) => item.value)).toEqual(before);
  });
});

describe('seleção na lista (moveSelection)', () => {
  it('as setas andam um item e dão a volta', () => {
    expect(moveSelection(3, 0, 'ArrowDown')).toBe(1);
    expect(moveSelection(3, 2, 'ArrowDown')).toBe(0);
    expect(moveSelection(3, 1, 'ArrowUp')).toBe(0);
    expect(moveSelection(3, 0, 'ArrowUp')).toBe(2);
  });

  it('Home e End vão às pontas', () => {
    expect(moveSelection(5, 3, 'Home')).toBe(0);
    expect(moveSelection(5, 1, 'End')).toBe(4);
  });

  it('PageDown e PageUp pulam vários itens sem passar das pontas', () => {
    expect(moveSelection(20, 0, 'PageDown')).toBeGreaterThan(1);
    expect(moveSelection(20, 0, 'PageDown')).toBeLessThanOrEqual(19);
    expect(moveSelection(20, 18, 'PageDown')).toBe(19);
    expect(moveSelection(20, 19, 'PageUp')).toBeLessThan(18);
    expect(moveSelection(20, 1, 'PageUp')).toBe(0);
    expect(moveSelection(3, 0, 'PageDown')).toBe(2);
    expect(moveSelection(3, 2, 'PageUp')).toBe(0);
  });

  it('outra tecla mantém a seleção, ajustada ao tamanho da lista', () => {
    expect(moveSelection(5, 2, 'a')).toBe(2);
    // A lista encolheu depois de um filtro: a seleção cai no último item.
    expect(moveSelection(2, 7, 'a')).toBe(1);
    expect(moveSelection(2, -1, 'a')).toBe(0);
  });

  it('lista vazia não tem seleção', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'a']) {
      expect(moveSelection(0, 0, key)).toBe(-1);
    }
  });

  it('nenhuma tecla leva a seleção para fora da lista', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter']) {
      for (let count = 1; count <= 12; count += 1) {
        for (let current = 0; current < count; current += 1) {
          const next = moveSelection(count, current, key);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      }
    }
  });
});
