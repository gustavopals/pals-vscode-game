import type { FiefStats, StatsResponse } from '@lotg/protocol';

import { formatNumber } from './format';

/**
 * O que a aba Reino diz com a resposta de `GET /v1/stats` (ADR 0021): só apresentação, nenhuma
 * conta de regra. Os números chegam prontos do servidor; aqui eles ganham separador de milhar,
 * ordinal e frase.
 */

/** "1º", "12º": a posição no ranking. */
export function ordinal(position: number): string {
  return `${formatNumber(position)}º`;
}

/** Um número inteiro com separador de milhar ("12.450"). */
export function whole(value: number): string {
  return formatNumber(Math.trunc(value));
}

/** "1 feudo", "3 feudos". */
export function plural(count: number, one: string, many: string): string {
  return `${whole(count)} ${count === 1 ? one : many}`;
}

export type KingdomTile = { id: string; icon: string; label: string; value: string; hint: string };

/** Os totais do reino, como cartões: o número grande, o rótulo e uma frase curta. */
export function kingdomTiles(kingdom: StatsResponse['kingdom']): KingdomTile[] {
  return [
    {
      id: 'accounts',
      icon: 'account',
      label: 'Contas',
      value: whole(kingdom.accounts),
      hint: 'quem já pisou no reino',
    },
    {
      id: 'active',
      icon: 'pulse',
      label: 'Ativos na semana',
      value: whole(kingdom.activeLastWeek),
      hint: 'contas que jogaram nos últimos 7 dias',
    },
    {
      id: 'fiefs',
      icon: 'home',
      label: 'Feudos',
      value: whole(kingdom.fiefs),
      hint: 'feudos de pé agora',
    },
    {
      id: 'gold',
      icon: 'database',
      label: 'Ouro no reino',
      value: whole(kingdom.gold),
      hint: 'somado em todos os cofres',
    },
    {
      id: 'villagers',
      icon: 'person',
      label: 'Aldeões',
      value: whole(kingdom.villagers),
      hint: 'gente trabalhando nos feudos',
    },
    {
      id: 'raids',
      icon: 'shield',
      label: 'Incursões repelidas',
      value: whole(kingdom.raidsRepelled),
      hint: `${plural(kingdom.raidsSuffered, 'sofrida', 'sofridas')}`,
    },
    {
      id: 'expeditions',
      icon: 'compass',
      label: 'Expedições',
      value: whole(kingdom.expeditionsSent),
      hint: 'equipes mandadas além da fronteira',
    },
  ];
}

/**
 * A frase da posição do jogador, sob o título "Minhas estatísticas". No ranking, ela vem depois
 * do selo com a posição ("2º") e não a repete.
 */
export function positionText(stats: StatsResponse): string {
  const { me, rankedFiefs } = stats;
  if (me.position === null) {
    return 'Você ainda não governa um feudo: funde um para entrar no ranking.';
  }
  if (!me.listed) {
    return `Seu feudo está fora do ranking. Nele, seria o ${ordinal(me.position)} em ouro.`;
  }
  // A posição em si vem no selo ao lado (`ordinal`); a frase diz o resto.
  return `em ouro, entre ${plural(rankedFiefs, 'feudo', 'feudos')} do ranking.`;
}

export type FiefFact = { id: string; icon: string; label: string; value: string };

/** O que o estado gravado do feudo do jogador diz dele. */
export function fiefFacts(fief: FiefStats): FiefFact[] {
  return [
    { id: 'gold', icon: 'database', label: 'Ouro', value: whole(fief.gold) },
    { id: 'villagers', icon: 'person', label: 'Aldeões', value: whole(fief.villagers) },
    { id: 'soldiers', icon: 'organization', label: 'Soldados', value: whole(fief.soldiers) },
    { id: 'heroes', icon: 'star-full', label: 'Heróis', value: whole(fief.heroes) },
    {
      id: 'raidsRepelled',
      icon: 'shield',
      label: 'Incursões repelidas',
      value: whole(fief.raidsRepelled),
    },
    {
      id: 'raidsSuffered',
      icon: 'flame',
      label: 'Incursões sofridas',
      value: whole(fief.raidsSuffered),
    },
    {
      id: 'expeditions',
      icon: 'compass',
      label: 'Expedições enviadas',
      value: whole(fief.expeditionsSent),
    },
    {
      id: 'constructions',
      icon: 'tools',
      label: 'Obras começadas',
      value: whole(fief.constructionsStarted),
    },
    {
      id: 'days',
      icon: 'calendar',
      label: 'Reinado',
      value: fief.daysReigning === 0 ? 'desde hoje' : plural(fief.daysReigning, 'dia', 'dias'),
    },
  ];
}

/** O ícone das três primeiras posições; as outras não têm. */
export function medal(position: number): string | null {
  return position <= 3 ? 'star-full' : null;
}

/**
 * A linha do jogador fora dos 10 primeiros vem no fim da lista, com a posição dele: entre ela e
 * a anterior há um salto, que a tabela mostra com uma linha de reticências.
 */
export function gapBefore(stats: StatsResponse, index: number): boolean {
  const entry = stats.ranking[index];
  const previous = stats.ranking[index - 1];
  return entry !== undefined && previous !== undefined && entry.position > previous.position + 1;
}

/** "Atualizado às 14:05": a hora da consulta que o servidor guardou. */
export function updatedText(generatedAt: string, timeZone?: string): string {
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(generatedAt));
  return `Atualizado às ${time}.`;
}
