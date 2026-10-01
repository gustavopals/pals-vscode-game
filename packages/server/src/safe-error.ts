/**
 * O que de um erro pode ir para o log. O erro de consulta do Drizzle traz na mensagem o SQL e
 * todos os parâmetros: nomes de exibição, o estado inteiro da partida, hashes de credenciais.
 * Nesse caso só a causa original do PostgreSQL (mensagem e código) é registrada.
 */
export function safeError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  stack?: string;
} {
  if (!(error instanceof Error)) {
    return { name: 'Erro', message: String(error) };
  }
  const isQueryError = 'query' in error && 'params' in error;
  const source = isQueryError && error.cause instanceof Error ? error.cause : error;
  const code = (source as { code?: unknown }).code;
  return {
    name: source.name,
    message: isQueryError && source === error ? 'Falha em uma consulta ao banco.' : source.message,
    ...(typeof code === 'string' ? { code } : {}),
    ...(source.stack !== undefined && !(isQueryError && source === error)
      ? { stack: source.stack }
      : {}),
  };
}
