import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import { fakeApi, makeController, scriptedDialogs, settle } from '../test-helpers';
import { bindCommands, createCommands } from '../palette/commands';
import { ChronicleTab } from './Chronicle';

const markdown =
  '# Crônica do Ano 1 de Pedra Alta\n\n## O ano em números\n\n| Medida | Valor |\n|---|---|\n| Batalhas | 3 |\n\n## Pontuação\n\n120 pontos.\n\n## Feitos\n\n- **O primeiro inverno**: Sobreviveu ao Cerco.\n';
const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

async function setup(options: Parameters<typeof makeController>[0] = {}) {
  const made = makeController({ signedIn: true, ...options });
  controllers.push(made.controller);
  made.api.state.yearChronicles[1] = markdown;
  made.api.state.view = {
    ...made.api.state.view,
    calendar: { ...made.api.state.view.calendar, year: 2 },
  };
  const script = scriptedDialogs();
  const downloads: { name: string; text: string }[] = [];
  const commands = createCommands(made.controller, script.dialogs, {
    download: (name, text) => {
      downloads.push({ name, text });
    },
    reload: () => {},
    sleep: async () => {},
    currentTheme: () => 'dark',
    openPalette: () => {},
    reveal: () => {},
  });
  bindCommands(made.controller, commands);
  await made.controller.start();
  await settle(made.controller);
  return {
    ...made,
    ...script,
    downloads,
    run: async (id: string, arg?: unknown) => {
      await commands.find((command) => command.id === id)!.run(arg);
    },
  };
}

describe('Crônica do Ano no app', () => {
  it('o seletor mantém a Crônica completa e o documento anual mostra a tabela, pontuação e Feitos', () => {
    const html = renderToString(
      <ChronicleTab
        document={{ status: 'ready', value: '# Crônica completa' }}
        yearDocument={{ status: 'ready', value: markdown }}
        selectedYear={1}
        currentYear={2}
        actions={{ run: () => {}, order: () => {}, playNow: () => {} }}
      />,
    );
    expect(html).toContain('for="chronicle-year"');
    expect(html).toContain('Crônica completa');
    expect(html).toContain('Baixar a Crônica do Ano');
    expect(html).toContain('<table>');
    expect(html).toContain('<th scope="col">Medida</th>');
    expect(html).toContain('<td>3</td>');
    expect(html).toContain('120 pontos.');
    expect(html).toContain('O primeiro inverno');
    expect(html).not.toContain('Baixar Crônica (Markdown)');
  });
  it('seleciona um ano, baixa o texto anual com nome próprio e mantém o download geral', async () => {
    const made = await setup();
    await made.run('lords.selectChronicleYear', 1);
    expect(made.controller.yearChronicleDocument).toEqual({ status: 'ready', value: markdown });
    await made.run('lords.downloadYearChronicle', 1);
    await made.run('lords.downloadChronicle');
    expect(made.downloads).toEqual([
      { name: 'cronica-pedra-alta-ano-1.md', text: markdown },
      { name: 'cronica-pedra-alta.md', text: made.api.state.chronicleMarkdown },
    ]);
    expect(made.api.state.yearChronicleQueries).toEqual([1, 1]);
    await made.run('lords.selectChronicleYear', null);
    expect(made.controller.selectedChronicleYear).toBeNull();
  });
  it('a paleta pergunta o ano; desistir não baixa e um ano ainda não publicado explica a ausência', async () => {
    const made = await setup();
    made.answers.push(undefined);
    await made.run('lords.downloadYearChronicle');
    expect(made.downloads).toEqual([]);
    made.answers.push(0);
    await made.run('lords.downloadYearChronicle');
    expect(made.downloads).toHaveLength(1);
    await made.run('lords.selectChronicleYear', 2);
    expect(made.controller.yearChronicleDocument).toMatchObject({
      status: 'error',
      message: expect.stringContaining('ainda não foi registrada'),
    });
  });
  it('resposta antiga não substitui outro ano selecionado nem baixa após sair da conta', async () => {
    const api = fakeApi();
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const made = await setup({
      api,
      overrides: {
        fetch: async (input, init) => {
          if (String(input).includes('/years/1/')) await gate;
          return api.fetch(input, init);
        },
      },
    });
    const first = made.controller.selectChronicleYear(1);
    await made.controller.selectChronicleYear(2);
    finish!();
    await first;
    expect(made.controller.selectedChronicleYear).toBe(2);
    expect(made.controller.yearChronicleDocument.status).toBe('error');
    // Uma resposta em voo de outra conta também é descartada.
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const otherApi = fakeApi();
    const other = await setup({
      api: otherApi,
      overrides: {
        fetch: async (input, init) => {
          const response = await otherApi.fetch(input, init);
          if (String(input).includes('/years/1/')) await pending;
          return response;
        },
      },
    });
    const download = other.run('lords.downloadYearChronicle', 1);
    await Promise.resolve();
    await other.controller.signOut();
    release!();
    await download;
    expect(other.downloads).toEqual([]);
    expect(other.controller.selectedChronicleYear).toBeNull();
  });
  it('uma falha de rede apresenta retentativa no documento; HTML do servidor permanece texto', async () => {
    const made = await setup();
    made.api.state.online = false;
    await made.run('lords.selectChronicleYear', 1);
    expect(made.controller.yearChronicleDocument.status).toBe('error');
    made.api.state.online = true;
    await made.run('lords.selectChronicleYear', 1);
    expect(made.controller.yearChronicleDocument.status).toBe('ready');
    const html = renderToString(
      <ChronicleTab
        document={{
          status: 'ready',
          value: '# <script>alert(1)</script>\n| Nome |\n|---|\n| <img src=x> |',
        }}
        actions={{ run: () => {}, order: () => {}, playNow: () => {} }}
      />,
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
