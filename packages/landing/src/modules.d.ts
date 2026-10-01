// O Vite e o Vitest entregam o conteúdo destes arquivos como texto (os testes leem as páginas e
// as folhas de estilo sem tocar o sistema de arquivos).
declare module '*?raw' {
  const text: string;
  export default text;
}

declare module '*?inline' {
  const text: string;
  export default text;
}
