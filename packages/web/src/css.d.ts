// O Vite empacota o CSS importado; para o TypeScript, é só um módulo sem conteúdo.
declare module '*.css';

// Tipagem mínima de `import.meta.glob`, que o Vite e o Vitest resolvem ao transformar o código.
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { query: string; import: string; eager: true },
  ): Record<string, T>;
}

interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean };
}
