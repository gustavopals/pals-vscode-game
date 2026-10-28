// Os testes conferem a transcrição contra a ficha aprovada, lida como texto pelo Vitest.
declare module '*.md?raw' {
  const text: string;
  export default text;
}
