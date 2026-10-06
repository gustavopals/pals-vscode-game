import { randomUUID } from 'node:crypto';

import { expect, fief, MINUTE, playNow, serverView, session, test } from './helpers';

// V3C-T2 (GDD §6.1 e §9.1; ADR 0017, decisões 4, 5 e 10): a Taverna existe no servidor. A aba
// Guilda, com os painéis dos heróis e da Taverna, é da V3C-T4, e os cenários dela entram neste
// arquivo. Até lá, o que há para provar em navegador é pouco: o app continua de pé com a Taverna
// na visão, a obra dela aparece na lista de construções como a de qualquer edifício, e as rotas
// de teste que os cenários da V3C-T4 vão usar (`world.raise('tavern', …)`, `world.stock(…)`)
// entregam uma Taverna com candidatos de verdade, sorteados pelo motor.

test.describe('a Taverna no servidor de teste', () => {
  test('a obra aparece presa ao Salão; posta de pé, a Taverna tem candidatos, e contratar pela API põe o herói na visão', async ({
    context,
    world,
    request,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // A obra da Taverna está na lista desde o começo, com o que a libera.
    const listed = fief(page)
      .getByRole('region', { name: 'Construções' })
      .getByRole('listitem')
      .filter({ hasText: 'Taverna' });
    await expect(listed).toContainText('Melhore antes o Salão do Senhor para o nível 3.');
    const before = await serverView(page, request);
    expect(before.tavern).toMatchObject({ level: 0, offers: [], nextRotationInSeconds: null });
    expect(before.guild.heroLimit).toBe(1);

    await world.raise('townHall', 3);
    await world.raise('tavern', 1);
    await world.stock('gold', 900);
    await world.passTime(MINUTE, page);
    const open = await serverView(page, request);
    expect(open.tavern.level).toBe(1);
    expect(open.tavern.offers).toHaveLength(2);
    expect(open.tavern.nextRotationInSeconds).toBeGreaterThan(0);
    expect(open.guild.heroLimit).toBe(2);
    const [offer] = open.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    expect(offer.blockedReason).toBeNull();

    const { url, headers } = await session(page);
    const command = {
      commandId: randomUUID(),
      type: 'hireHero',
      payload: { offerId: offer.offerId },
    };
    const hired = await request.post(`${url}/commands`, { headers, data: command });
    expect(hired.status()).toBe(200);
    // O duplo envio devolve o recibo: um herói só.
    const again = await request.post(`${url}/commands`, { headers, data: command });
    expect(again.status()).toBe(200);
    expect(again.headers()['x-lords-replayed']).toBe('true');
    await world.passTime(MINUTE, page);
    const after = await serverView(page, request);
    expect(after.guild.heroes.map((hero) => hero.name)).toEqual([offer.name]);
    expect(after.tavern.offers).toHaveLength(1);
    // O app, que ainda não tem a aba Guilda, segue de pé com a visão nova.
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    expect(world.problems).toEqual([]);
  });
});
