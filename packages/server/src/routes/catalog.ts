import type { FastifyInstance } from 'fastify';

import { catalogInfo } from '../catalog';
import type { AppContext } from '../context';
import { etagMatches, weakEtag } from '../games/view';

/**
 * `GET /catalog`: as opções de nova partida, sem autenticação. O corpo só depende do conteúdo e
 * da configuração, então é montado uma vez, no arranque. O ETag é o do corpo inteiro: muda com o
 * conteúdo (o corpo leva o `contentHash`) e também quando o ritmo padrão do servidor muda.
 */
export function registerCatalogRoutes(app: FastifyInstance, ctx: AppContext): void {
  const body = catalogInfo(ctx.config);
  const etag = weakEtag(body);

  app.get('/catalog', async (request, reply) => {
    // `no-cache`: o navegador guarda a resposta, mas pergunta antes de usar; o 304 não tem corpo.
    void reply.header('etag', etag).header('cache-control', 'no-cache');
    if (etagMatches(request.headers['if-none-match'], etag)) {
      return reply.status(304).send();
    }
    return reply.send(body);
  });
}
