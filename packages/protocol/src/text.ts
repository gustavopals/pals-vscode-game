// eslint-disable-next-line no-control-regex -- é exatamente o que se quer recusar
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export const UNSTORABLE = 'o texto contém caracteres de controle ou Unicode malformado';

/**
 * Texto que pode ser guardado e exibido: sem caracteres de controle (o PostgreSQL recusa o
 * caractere nulo em `text` e em `jsonb`) e sem metades soltas de pares substitutos.
 * Sem esta checagem, um nome assim passaria pela validação e viraria um erro 500 no banco.
 */
export function isStorableText(value: string): boolean {
  return !CONTROL_CHARACTERS.test(value) && !LONE_SURROGATE.test(value);
}
