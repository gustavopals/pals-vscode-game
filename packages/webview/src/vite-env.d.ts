// Tipagem mínima de `import.meta.glob`, que o Vitest resolve ao transformar os testes.
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { query: string; import: string; eager: true },
  ): Record<string, T>;
}
