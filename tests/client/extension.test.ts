import type { ViewState } from '@lotg/protocol';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { activate } from '../../packages/extension/src/extension';
import * as editor from '../../packages/extension/test/fake-vscode';
import { createTestApp, type TestApp } from '../../packages/server/test/helpers/app';
import { resetTestDb, truncateAll } from '../../packages/server/test/helpers/db';

// A extensão inteira, ativada como o VS Code a ativa, contra o servidor real em memória e o
// PostgreSQL de teste. O editor é um substituto mínimo (fake-vscode.ts): os diálogos são
// respondidos por roteiro e o que a extensão mostra fica registrado.

const HOUR = 3_600_000;
const START = new Date('2026-10-01T12:00:00.000Z');

let server: TestApp;
let online = true;
type Context = ReturnType<typeof editor.createContext>;
let context: Context;
const requests: string[] = [];

/** O `fetch` da extensão vai direto à API em memória; `online = false` simula a rede caída. */
const fetchViaApp: typeof fetch = async (input, init) => {
  if (!online) {
    throw new TypeError('fetch failed');
  }
  const url = new URL(String(input));
  requests.push(`${init?.method ?? 'GET'} ${url.pathname}`);
  const response = await server.app.inject({
    method: (init?.method ?? 'GET') as 'GET',
    url: url.pathname + url.search,
    headers: init?.headers as Record<string, string>,
    ...(typeof init?.body === 'string' ? { payload: init.body } : {}),
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      headers.set(name, String(value));
    }
  }
  const empty = response.statusCode === 204 || response.statusCode === 304;
  return new Response(empty ? null : response.body, { status: response.statusCode, headers });
};

/** Ativa a extensão em uma "máquina": o contexto dado (ou um novo) e um editor recém-aberto. */
async function openEditor(existing?: Context): Promise<Context> {
  for (const item of context?.subscriptions ?? []) {
    item.dispose();
  }
  editor.reset();
  context = existing ?? editor.createContext();
  context.subscriptions = [];
  await activate(context as never);
  await editor.settle();
  return context;
}

const run = async (command: string, ...args: unknown[]) => {
  await editor.commands.executeCommand(command, ...args);
  await editor.settle();
};

/** Abre o painel e faz a Webview dizer que carregou. */
async function openPanel(): Promise<editor.FakePanel> {
  await run('lords.openPanel');
  const panel = editor.state.panels.at(-1);
  if (panel === undefined) {
    throw new Error('O painel não foi criado.');
  }
  await panel.receive({ type: 'ready' });
  return panel;
}

const lastOf = (panel: editor.FakePanel, type: string) =>
  panel.posted.filter((message) => message.type === type).at(-1);
const viewOf = (panel: editor.FakePanel) => lastOf(panel, 'view')?.view as ViewState | undefined;

/** "Jogar agora" pelo painel de boas-vindas. */
async function playNow(displayName = 'Gustavo'): Promise<editor.FakePanel> {
  const panel = await openPanel();
  await panel.receive({ type: 'playNow', displayName, settlementName: 'Pedra Alta' });
  return panel;
}

const command = (type: string, payload: unknown) => ({
  type: 'command',
  command: { commandId: crypto.randomUUID(), type, payload },
});

beforeAll(async () => {
  await resetTestDb();
  vi.stubGlobal('fetch', fetchViaApp);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  // Só o relógio é de mentira; temporizadores e o banco seguem reais.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  online = true;
  requests.length = 0;
  server = await createTestApp();
  server.clock.set(START);
  // Cada teste começa com o reino vazio: nenhuma conta de um teste anterior interfere.
  await truncateAll(server.pool);
  await openEditor();
});
afterEach(async () => {
  for (const item of context.subscriptions) {
    item.dispose();
  }
  await server.close();
  vi.useRealTimers();
});

/** Faz o tempo passar igual no servidor e na máquina do jogador. */
function passTime(ms: number): void {
  server.clock.advance(ms);
  vi.setSystemTime(Date.now() + ms);
}

describe('primeira abertura', () => {
  it('sem conta: árvore vazia, convite na barra de status e boas-vindas no painel', async () => {
    expect(editor.seeTree()).toEqual([]);
    expect(editor.state.statusBar).toMatchObject({
      text: '$(home) Lords of the Guild',
      shown: true,
    });
    expect(editor.state.contexts['lords.signedIn']).toBe(false);
    // Nenhuma chamada ao servidor antes de o jogador agir.
    expect(requests).toEqual([]);

    const panel = await openPanel();
    expect(lastOf(panel, 'session')).toMatchObject({ session: { account: null, hasGame: false } });
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'welcome' });
  });

  it('o painel tem CSP com nonce e carrega só recursos da própria extensão', async () => {
    const panel = await openPanel();
    const { html } = panel.webview;
    const nonce = /script-src 'nonce-([^']+)'/.exec(html)?.[1];
    expect(nonce).toBeDefined();
    expect(html).toContain(`nonce="${nonce}"`);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toContain('unsafe-eval');
    expect(html).toContain('vscode-resource:/extensao/media/webview.js');
    expect(html).toContain('vscode-resource:/extensao/media/webview.css');
  });

  it('"Jogar agora": dois campos, um clique, duas requisições, e o feudo aparece', async () => {
    const panel = await openPanel();
    requests.length = 0;
    await panel.receive({ type: 'playNow', displayName: 'Gustavo', settlementName: 'Pedra Alta' });

    expect(requests.slice(0, 2)).toEqual(['POST /v1/auth/anonymous', 'POST /v1/games']);
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'fief' });
    expect(viewOf(panel)?.settlement.name).toBe('Pedra Alta');
    expect(lastOf(panel, 'session')).toMatchObject({
      session: { account: { displayName: 'Gustavo', kind: 'anonymous' }, hasGame: true },
    });
    expect(editor.state.contexts['lords.signedIn']).toBe(true);
    expect(editor.state.statusBar.text).toBe('$(home) Pedra Alta · −5 comida/h');

    const tree = editor.seeTree();
    expect(tree.map((node) => node.label)).toEqual([
      'Hoje em Pedra Alta',
      'Feudo: Pedra Alta',
      'Crônica',
      'Conta: Gustavo',
      'Configurações',
    ]);
    expect(editor.findNode(tree, 'Conta: Gustavo')?.description).toBe('anônima');
  });

  it('as credenciais ficam só no SecretStorage', async () => {
    await playNow();
    expect([...context.secrets.data.keys()]).toEqual(['lords.tokens:http://localhost:3000']);
    const tokens = JSON.parse([...context.secrets.data.values()][0] ?? '{}');
    expect(tokens.accessToken).toMatch(/^eyJ/);
    const stored = JSON.stringify([...context.globalState.data.entries()]);
    expect(stored).not.toContain(tokens.accessToken);
    expect(stored).not.toContain(tokens.refreshToken);
  });

  it('nome inválido vindo do painel é ignorado, sem criar conta', async () => {
    const panel = await openPanel();
    await panel.receive({ type: 'playNow', displayName: 'G', settlementName: 'Pedra Alta' });
    expect(requests).toEqual([]);
    expect(editor.state.output.join('\n')).toContain('Mensagem inválida');
  });
});

describe('governar o feudo', () => {
  it('ordem pelo painel muda a taxa na hora e reduz os livres', async () => {
    const panel = await playNow();
    await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));
    const view = viewOf(panel);
    expect(view?.resources[0]).toMatchObject({ id: 'food', perHour: 15 });
    expect(view?.population.free).toBe(3);
    expect(editor.state.statusBar.text).toBe('$(home) Pedra Alta · +15 comida/h');
    // O objetivo cumprido chega à Crônica do painel.
    const chronicle = lastOf(panel, 'chronicle')?.entries as Array<{ text: string }>;
    expect(chronicle.at(-1)?.text).toContain('Aloque 2 aldeões na Fazenda');
  });

  it('recusa do motor aparece no painel com o motivo em português', async () => {
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'townHall' }));
    expect(lastOf(panel, 'error')).toEqual({
      type: 'error',
      code: 'GAME_RULE',
      message: 'Faltam 30 madeira e 35 pedra.',
    });
  });

  it('mais e menos na árvore alocam trabalhadores', async () => {
    await playNow();
    const farm = () => editor.findNode(editor.seeTree(), 'Fazenda Nv1');
    expect(farm()).toMatchObject({ description: '0 · 0/h', contextValue: 'lords.worker' });
    await run('lords.workersIncrease', farm()?.node);
    await run('lords.workersIncrease', farm()?.node);
    expect(farm()?.description).toBe('2 · 20/h');
    await run('lords.workersDecrease', farm()?.node);
    expect(farm()?.description).toBe('1 · 10/h');
    expect(editor.findNode(editor.seeTree(), 'Trabalhadores')?.description).toBe(
      '1/5 alocados · 4 livres',
    );
  });

  it('alocar pela paleta mostra a taxa resultante e recusa o que passa da população', async () => {
    await playNow();
    editor.state.answers.push('Serraria', '3');
    await run('lords.allocateWorkers');
    expect(editor.state.inputBoxes.at(-1)?.validation).toMatchObject({ message: '3 × 8 = 24/h' });
    expect(editor.findNode(editor.seeTree(), 'Serraria Nv1')?.description).toBe('3 · 24/h');

    editor.state.answers.push('Pedreira', '9');
    await run('lords.allocateWorkers');
    expect(editor.state.inputBoxes.at(-1)?.validation).toBe(
      'Só há 2 disponíveis para Pedreira (0 já lá e 2 livres).',
    );
    expect(editor.findNode(editor.seeTree(), 'Pedreira Nv1')?.description).toBe('0 · 0/h');
  });

  it('construir pela paleta: QuickPick com custo, tempo e cadeado; a obra entra na barra de status', async () => {
    await playNow();
    editor.state.answers.push('Habitações');
    await run('lords.build');
    const pick = editor.state.quickPicks.at(-1);
    expect(pick?.title).toBe('Construir ou melhorar');
    expect(pick?.labels).toContain('$(check) Habitações Nv1 → Nv2');
    expect(pick?.labels).toContain('$(lock) Salão do Senhor Nv1 → Nv2');
    expect(editor.state.statusBar.text).toBe('$(tools) Habitações Nv2 · 00:04');

    // Bloqueada: a ordem segue e o servidor recusa com o motivo.
    editor.state.answers.push('Salão do Senhor');
    await run('lords.build');
    expect(editor.state.messages.at(-1)).toMatchObject({
      kind: 'warning',
      text: 'Os pedreiros já estão ocupados com outra obra.',
    });
  });

  it('recrutar pela paleta mostra as vagas e respeita o máximo', async () => {
    await playNow();
    editor.state.answers.push('3');
    await run('lords.recruit');
    expect(editor.state.inputBoxes.at(-1)?.prompt).toContain('Vagas: 5 de 10');
    const tree = editor.seeTree();
    expect(editor.findNode(tree, 'Recursos')?.children[0]).toMatchObject({
      label: 'Comida',
      description: '30 (−5/h)',
    });

    editor.state.answers.push('5');
    await run('lords.recruit');
    expect(editor.state.inputBoxes.at(-1)?.validation).toBe('Agora cabem no máximo 2.');
  });

  it('cancelar a obra pede confirmação e devolve 80%', async () => {
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'housing' }));
    editor.state.answers.push('Cancelar a obra');
    await run('lords.cancelConstruction');
    expect(editor.state.messages.at(-1)).toMatchObject({ modal: true });
    const wood = viewOf(panel)?.resources.find((row) => row.id === 'wood');
    // 120 − 80 da obra + 30 do objetivo + 64 de volta.
    expect(wood?.stock).toBe(134);
    expect(viewOf(panel)?.constructions.active).toBeNull();
  });

  it('exportar a Crônica abre um documento Markdown não salvo', async () => {
    const panel = await playNow();
    await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));
    await run('lords.exportChronicle');
    expect(editor.state.documents).toHaveLength(1);
    expect(editor.state.documents[0]).toMatchObject({ language: 'markdown' });
    expect(editor.state.documents[0]?.content).toContain('# Crônica de Pedra Alta');
  });

  it('"Sobre" mostra as versões da extensão, do servidor e o hash do conteúdo', async () => {
    await run('lords.about');
    const about = editor.state.messages.at(-1);
    expect(about?.text).toBe('Lords of the Guild 0.1.0 (protocolo 1)');
    expect(about?.detail).toMatch(/Servidor 0\.1\.0 · protocolo 1 · conteúdo [0-9a-f]{16}/);
  });

  it('todo comando declarado no manifesto tem implementação', async () => {
    const manifest = (await import('../../packages/extension/package.json')).default;
    const declared = manifest.contributes.commands.map((entry) => entry.command).sort();
    expect([...editor.state.commands.keys()].sort()).toEqual(declared);
    for (const entry of manifest.contributes.commands) {
      expect(entry.category).toBe('Lords');
    }
  });
});

describe('o mundo anda sozinho', () => {
  it('a obra termina sem o jogador agir e some da barra de status', async () => {
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'housing' }));
    expect(editor.state.statusBar.text).toContain('$(tools) Habitações Nv2');

    passTime(5 * 60_000);
    await run('lords.refresh');
    expect(viewOf(panel)?.constructions.active).toBeNull();
    expect(viewOf(panel)?.population.capacity).toBe(15);
    expect(editor.state.statusBar.text).toBe('$(home) Pedra Alta · −5 comida/h');
  });

  it('com "todas", a obra concluída vira notificação com Ver e Silenciar 2h', async () => {
    editor.state.config['lords.notifications'] = 'all';
    await run('lords.muteNotifications');
    await openEditor(context);
    editor.state.config['lords.notifications'] = 'all';
    await editor.workspace.getConfiguration('lords').update('notifications', 'all');
    await editor.settle();
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'housing' }));
    editor.state.messages = [];

    passTime(5 * 60_000);
    await run('lords.refresh');
    const notice = editor.state.messages.find((message) => message.text.includes('ergueram'));
    expect(notice).toMatchObject({ kind: 'info', buttons: ['Ver', 'Silenciar 2h'] });
  });

  it('no nível padrão (essenciais), obra concluída não incomoda; a fome avisa', async () => {
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'housing' }));
    editor.state.messages = [];
    passTime(5 * 60_000);
    await run('lords.refresh');
    expect(editor.state.messages).toEqual([]);

    // Sem fazendeiros, a comida acaba em 36 horas.
    passTime(36 * HOUR);
    await run('lords.refresh');
    const famine = editor.state.messages.find((message) => message.text.includes('fome começou'));
    expect(famine).toMatchObject({ kind: 'warning' });
    expect(editor.state.statusBar.text).toBe('$(warning) Fome em Pedra Alta');
  });

  it('modo discreto: só um contador na barra e nenhuma notificação', async () => {
    const panel = await playNow();
    await panel.receive(command('startConstruction', { building: 'housing' }));
    await run('lords.toggleDiscreetMode');
    expect(editor.state.config['lords.discreetMode']).toBe(true);
    expect(editor.state.statusBar.text).toBe('$(circle-filled) 00:04');
    editor.state.messages = [];
    passTime(37 * HOUR);
    await run('lords.refresh');
    expect(editor.state.messages).toEqual([]);
  });
});

describe('fechar e reabrir o editor', () => {
  it('reabrir após horas mostra o intervalo simulado pelo servidor e o Relatório de Retorno', async () => {
    const panel = await playNow();
    await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));
    await panel.receive(command('startConstruction', { building: 'housing' }));

    passTime(5 * HOUR);
    editor.state.config['lords.notifications'] = 'all';
    await openEditor(context);

    // O painel não se abre sozinho por cima do trabalho de ninguém: a árvore e a barra de status
    // avisam das novidades, e nenhum evento da ausência vira notificação avulsa.
    expect(editor.state.panels).toEqual([]);
    expect(editor.state.messages).toEqual([]);
    expect(editor.state.statusBar.text).toMatch(/\$\(bell\) \d+$/);

    // Ao ser aberto, o painel começa na aba Hoje.
    const reopened = await openPanel();
    expect(lastOf(reopened!, 'navigate')).toEqual({ type: 'navigate', route: 'today' });
    const report = lastOf(reopened!, 'report')?.report as {
      awaySeconds: number;
      counts: Record<string, number>;
      resources: Array<{ id: string; delta: number }>;
      highlights: string[];
    };
    expect(report.awaySeconds).toBe(5 * 3600);
    expect(report.counts).toMatchObject({ constructionsFinished: 1, daysPassed: 2 });
    expect(report.resources.find((row) => row.id === 'food')?.delta).toBe(75);
    expect(report.highlights.some((line) => line.includes('ergueram as Habitações'))).toBe(true);
    expect(editor.findNode(editor.seeTree(), 'Hoje em Pedra Alta')?.description).toMatch(
      /novidade/,
    );
    expect(viewOf(reopened!)?.resources[0]?.stock).toBe(255);

    // Visto o relatório, as novidades somem.
    await reopened?.receive({ type: 'action', action: 'dismissReport' });
    expect(lastOf(reopened!, 'report')).toEqual({ type: 'report', report: null });
    expect(editor.findNode(editor.seeTree(), 'Hoje em Pedra Alta')?.description).toBe('');
  });

  it('reabrir depois de pouco tempo não gera relatório e abre no Feudo', async () => {
    await playNow();
    passTime(HOUR);
    await openEditor(context);
    expect(editor.state.panels).toEqual([]);
    const panel = await openPanel();
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'fief' });
    expect(lastOf(panel, 'report')).toEqual({ type: 'report', report: null });
  });
});

describe('o que só apareceria no editor de verdade', () => {
  it('clicar em itens da árvore nunca dá ordens: só abre o painel', async () => {
    await playNow();
    const tree = editor.seeTree();
    const upgrade = editor.findNode(tree, 'Habitações Nv1 → Nv2');
    const worker = editor.findNode(tree, 'Fazenda Nv1');
    expect(upgrade).toMatchObject({ command: 'lords.openPanel', contextValue: 'lords.upgrade' });
    expect(worker?.command).toBe('lords.openPanel');
    expect(editor.findNode(tree, 'Salão do Senhor Nv1 → Nv2')?.contextValue).toBe(
      'lords.blockedUpgrade',
    );

    // A obra começa pelo botão "Construir ou melhorar" do item, que passa o próprio item.
    await run('lords.build', upgrade?.node);
    expect(editor.state.statusBar.text).toContain('$(tools) Habitações Nv2');
  });

  it('"Entrar com GitHub" pelo painel de boas-vindas leva ao feudo, não a "fundar o feudo"', async () => {
    await server.close();
    server = await createTestApp({
      clock: server.clock,
      fetch: async () => new Response(JSON.stringify({ id: 7 }), { status: 200 }),
    });
    const first = await playNow();
    await first.receive(command('setWorkers', { building: 'farm', count: 2 }));
    await run('lords.linkGithub');

    await openEditor();
    const welcome = await openPanel();
    expect(lastOf(welcome, 'navigate')).toEqual({ type: 'navigate', route: 'welcome' });
    await welcome.receive({ type: 'action', action: 'signInGithub' });
    expect(lastOf(welcome, 'session')).toMatchObject({ session: { hasGame: true } });
    expect(lastOf(welcome, 'navigate')).toEqual({ type: 'navigate', route: 'fief' });
    expect(viewOf(welcome)?.workers[0]?.assigned).toBe(2);
  });

  it('login do GitHub cancelado não é erro', async () => {
    const original = editor.authentication.getSession;
    editor.authentication.getSession = async () => {
      throw new Error('User did not consent to login.');
    };
    try {
      editor.state.messages = [];
      await run('lords.signInGithub');
      expect(editor.state.messages).toEqual([]);
    } finally {
      editor.authentication.getSession = original;
    }
  });

  it('feudo arquivado em outra máquina: esta percebe e passa para o feudo novo', async () => {
    await playNow();
    editor.state.answers.push('Copiar');
    await run('lords.generateRecoveryCode');
    const code = editor.state.clipboard;
    const firstMachine = context;

    // Na outra máquina, o jogador começa uma nova partida.
    await openEditor();
    editor.state.answers.push(code);
    await run('lords.signInRecoveryCode');
    editor.state.answers.push('Começar outro feudo', 'Vau Alto');
    await run('lords.newGame');
    expect(editor.findNode(editor.seeTree(), 'Feudo: Vau Alto')).toBeDefined();

    // De volta à primeira máquina, que ainda guardava o feudo antigo.
    await openEditor(firstMachine);
    await vi.waitFor(
      () => {
        expect(editor.findNode(editor.seeTree(), 'Feudo: Vau Alto')).toBeDefined();
      },
      { timeout: 5000 },
    );
    // O cache do feudo antigo sai e o do novo entra, assim que a primeira leitura é gravada.
    await vi.waitFor(
      () => {
        const caches = [...context.globalState.data.keys()].filter((key) =>
          key.startsWith('lords.cache:'),
        );
        expect(caches).toHaveLength(1);
      },
      { timeout: 5000 },
    );
  });

  it('sair sem conexão não deixa as boas-vindas travadas em "sem ligação"', async () => {
    const panel = await playNow();
    online = false;
    await run('lords.refresh');
    expect(lastOf(panel, 'connection')).toMatchObject({ online: false });

    editor.state.answers.push('Sair desta máquina');
    await run('lords.signOut');
    expect(context.secrets.data.size).toBe(0);
    expect(lastOf(panel, 'connection')).toEqual({ type: 'connection', online: true });
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'welcome' });
  });

  it('a conta tem um item de privacidade que explica o que é guardado', async () => {
    await playNow();
    expect(editor.findNode(editor.seeTree(), 'Privacidade')?.command).toBe('lords.privacy');
    await run('lords.privacy');
    const notice = editor.state.messages.at(-1);
    expect(notice?.modal).toBe(true);
    expect(notice?.detail).toContain('nome de exibição');
    expect(notice?.detail).toContain('sete dias');
  });

  it('lords.serverUrl só vale nas configurações do usuário', async () => {
    const manifest = (await import('../../packages/extension/package.json')).default;
    expect(manifest.contributes.configuration.properties['lords.serverUrl'].scope).toBe(
      'application',
    );
  });
});

describe('sem conexão', () => {
  it('mostra o último estado conhecido, explica, não envia comandos e volta sozinho', async () => {
    const panel = await playNow();
    await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));

    online = false;
    await run('lords.refresh');
    expect(editor.state.statusBar.text).toBe('$(debug-disconnect) Sem ligação com o reino');
    expect(lastOf(panel, 'connection')).toMatchObject({ type: 'connection', online: false });
    // A árvore continua mostrando o feudo que estava guardado.
    expect(editor.findNode(editor.seeTree(), 'Comida')?.description).toBe('180 (+15/h)');

    // Uma ordem dada sem ligação não é enviada nem fica em fila.
    requests.length = 0;
    await panel.receive(command('setWorkers', { building: 'farm', count: 5 }));
    expect(lastOf(panel, 'error')).toMatchObject({ code: 'NETWORK' });
    expect(requests).toEqual([]);

    // Reabrir o editor ainda sem rede: o cache aparece, em modo leitura.
    await openEditor(context);
    const offline = await openPanel();
    expect(viewOf(offline)?.settlement.name).toBe('Pedra Alta');
    expect(lastOf(offline, 'connection')).toMatchObject({ online: false });

    online = true;
    passTime(HOUR);
    await run('lords.refresh');
    expect(lastOf(offline, 'connection')).toEqual({ type: 'connection', online: true });
    expect(viewOf(offline)?.resources[0]).toMatchObject({ stock: 195, perHour: 15 });
    expect(viewOf(offline)?.workers[0]?.assigned).toBe(2);
  });
});

describe('outra máquina', () => {
  it('o Código do Reino abre o mesmo feudo em uma máquina nova', async () => {
    const panel = await playNow();
    await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));
    editor.state.answers.push('Copiar');
    await run('lords.generateRecoveryCode');
    const code = editor.state.clipboard;
    expect(code).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
    expect(editor.state.messages.at(-1)).toMatchObject({ modal: true });
    expect(editor.state.messages.at(-1)?.detail).toContain('só desta vez');
    expect(editor.findNode(editor.seeTree(), 'Trocar o Código do Reino')).toBeDefined();

    const firstMachine = context;
    await openEditor();
    expect(editor.seeTree()).toEqual([]);
    editor.state.answers.push(code.toLowerCase());
    await run('lords.signInRecoveryCode');

    const there = editor.state.panels.at(-1);
    await there?.receive({ type: 'ready' });
    expect(lastOf(there!, 'navigate')).toEqual({ type: 'navigate', route: 'fief' });
    expect(viewOf(there!)?.workers[0]).toMatchObject({ building: 'farm', assigned: 2 });
    expect(editor.findNode(editor.seeTree(), 'Conta: Gustavo')).toBeDefined();
    expect(context).not.toBe(firstMachine);
  });

  it('um código malformado é barrado antes de gastar uma tentativa no servidor', async () => {
    editor.state.answers.push('PEDR-7F3A');
    requests.length = 0;
    await run('lords.signInRecoveryCode');
    expect(editor.state.inputBoxes.at(-1)?.validation).toBe(
      'O código tem 20 caracteres; você digitou 8.',
    );
    expect(requests).toEqual([]);
  });

  it('duas máquinas na mesma conta veem o mesmo feudo depois de sincronizar', async () => {
    const first = await playNow();
    editor.state.answers.push('Copiar');
    await run('lords.generateRecoveryCode');
    const code = editor.state.clipboard;
    const firstMachine = context;

    await openEditor();
    editor.state.answers.push(code);
    await run('lords.signInRecoveryCode');
    const second = editor.state.panels.at(-1)!;
    await second.receive({ type: 'ready' });
    await second.receive(command('setWorkers', { building: 'quarry', count: 4 }));
    const fromSecond = viewOf(second);

    // De volta à primeira máquina: o estado novo chega no ciclo seguinte.
    await openEditor(firstMachine);
    const back = await openPanel();
    expect(viewOf(back)?.workers).toEqual(fromSecond?.workers);
    expect(first.posted.length).toBeGreaterThan(0);
  });
});

describe('sair, perder a sessão e excluir', () => {
  it('sair desta máquina revoga a sessão e apaga tokens e cache locais', async () => {
    await playNow();
    expect([...context.globalState.data.keys()].some((key) => key.startsWith('lords.cache:'))).toBe(
      true,
    );
    editor.state.answers.push('Sair desta máquina');
    await run('lords.signOut');

    // Conta anônima sem código: o aviso diz que não há volta.
    expect(editor.state.messages.at(-1)?.detail).toContain('não poderá mais voltar');
    expect(context.secrets.data.size).toBe(0);
    expect([...context.globalState.data.keys()].filter((key) => key.startsWith('lords.'))).toEqual(
      [],
    );
    expect(editor.seeTree()).toEqual([]);
    expect(editor.state.contexts['lords.signedIn']).toBe(false);
    expect(editor.state.statusBar.text).toBe('$(home) Lords of the Guild');
    const { rows } = await server.pool.query('select revoked_at from sessions');
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('sessão revogada no servidor limpa os dados locais em vez de parecer falta de rede', async () => {
    const panel = await playNow();
    await server.pool.query('update sessions set revoked_at = now()');
    await run('lords.refresh');

    expect(editor.state.contexts['lords.signedIn']).toBe(false);
    expect(context.secrets.data.size).toBe(0);
    expect(
      [...context.globalState.data.keys()].filter((key) => key.startsWith('lords.cache:')),
    ).toEqual([]);
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'welcome' });
    expect(lastOf(panel, 'session')).toMatchObject({ session: { account: null, hasGame: false } });
    expect(editor.state.statusBar.text).not.toContain('Sem ligação');
  });

  it('excluir a conta pede confirmação e o nome do feudo, explica os prazos e volta às boas-vindas', async () => {
    const panel = await playNow();
    // Nome errado: nada acontece.
    editor.state.answers.push('Excluir a conta', 'Outro Nome');
    await run('lords.deleteAccount');
    expect(editor.state.contexts['lords.signedIn']).toBe(true);

    editor.state.answers.push('Excluir a conta', 'Pedra Alta');
    await run('lords.deleteAccount');
    const warning = editor.state.messages.find((message) =>
      message.text.includes('Excluir a conta'),
    );
    expect(warning?.detail).toContain('bloqueada na hora');
    expect(warning?.detail).toContain('sete dias');
    expect(warning?.detail).toContain('14 dias');
    expect(warning?.detail).not.toMatch(/desfazer/i);

    expect(editor.state.contexts['lords.signedIn']).toBe(false);
    expect(context.secrets.data.size).toBe(0);
    expect(lastOf(panel, 'navigate')).toEqual({ type: 'navigate', route: 'welcome' });
    const { rows } = await server.pool.query('select deleted_at from accounts');
    expect(rows[0]?.deleted_at).not.toBeNull();
  });
});

describe('GitHub', () => {
  /** Outra instância do servidor que "fala" com um GitHub de mentira. */
  async function withGithub(test: () => Promise<void>): Promise<void> {
    await server.close();
    server = await createTestApp({
      clock: server.clock,
      fetch: async (_url, init) => {
        const token = String((init?.headers as Record<string, string>).authorization);
        return new Response(JSON.stringify({ id: token.includes('edda') ? 2 : 1 }), {
          status: 200,
        });
      },
    });
    await test();
  }

  it('vincular a conta usa o login nativo do VS Code e muda a conta para GitHub', async () => {
    await withGithub(async () => {
      await playNow();
      await run('lords.linkGithub');
      expect(editor.findNode(editor.seeTree(), 'Conta: Gustavo')?.description).toBe('GitHub');
      expect(editor.findNode(editor.seeTree(), 'Vincular ao GitHub')).toBeUndefined();
      expect(editor.state.messages.at(-1)?.text).toContain('vinculada ao GitHub');
    });
  });

  it('em outra máquina, entrar com GitHub abre o mesmo feudo', async () => {
    await withGithub(async () => {
      const panel = await playNow();
      await panel.receive(command('setWorkers', { building: 'farm', count: 2 }));
      await run('lords.linkGithub');

      await openEditor();
      await run('lords.signInGithub');
      const there = await openPanel();
      expect(viewOf(there)?.workers[0]?.assigned).toBe(2);
      expect(editor.findNode(editor.seeTree(), 'Conta: Gustavo')?.description).toBe('GitHub');
    });
  });

  it('num conflito, pergunta qual feudo manter e nunca mistura os dois', async () => {
    await withGithub(async () => {
      // Edda vincula o GitHub dela em uma máquina.
      editor.state.githubToken = 'gho_edda';
      const edda = await playNow('Edda');
      await edda.receive(command('setWorkers', { building: 'quarry', count: 5 }));
      await run('lords.linkGithub');

      // Em outra máquina, alguém começa um feudo anônimo e tenta o mesmo GitHub.
      await openEditor();
      editor.state.githubToken = 'gho_edda';
      const panel = await playNow('Viajante');
      editor.state.answers.push('Usar o feudo de Edda');
      await run('lords.linkGithub');

      const conflict = editor.state.quickPicks.at(-1);
      expect(conflict?.title).toBe('Este GitHub já está vinculado a outro feudo');
      expect(conflict?.labels).toEqual([
        'Usar o feudo de Edda, já vinculado ao GitHub',
        'Manter este feudo e mover o vínculo para ele',
      ]);
      expect(editor.findNode(editor.seeTree(), 'Conta: Edda')?.description).toBe('GitHub');
      // O feudo que aparece é o de Edda, intacto: 5 na Pedreira.
      expect(viewOf(panel)?.workers.find((row) => row.building === 'quarry')?.assigned).toBe(5);
      // O cache do feudo anônimo descartado não fica na máquina.
      const caches = [...context.globalState.data.keys()].filter((key) =>
        key.startsWith('lords.cache:'),
      );
      expect(caches).toHaveLength(1);
    });
  });
});
