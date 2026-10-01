// O mínimo do ambiente Node que o simulador usa. `@types/node` não está entre as
// dependências permitidas (MVP-ROADMAP.md §1.6); ver a proposta do ADR 0006.
declare const process: {
  argv: string[];
  exitCode?: number;
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
};
