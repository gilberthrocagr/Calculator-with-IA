/**
 * Capa 1: normalizacion de cadena.
 *
 * Objetivo: detectar "no cambios" baratos y unificar la entrada real de un alumno,
 * que casi nunca es ASCII limpio. Si pega desde WhatsApp o Word llegan el menos
 * tipografico U+2212, el por U+00D7, exponentes en superindice y el NBSP.
 *
 * Esta capa es deliberadamente CONSERVADORA: solo hace transformaciones que no
 * pueden cambiar el significado. Si dos cadenas normalizan igual afirmamos
 * equivalencia, asi que una normalizacion agresiva aqui produciria falsos
 * EQUIVALENTE, que es el error mas caro del sistema.
 *
 * NO se hace (a proposito):
 *  - pasar a minusculas: 'X' y 'x' son variables distintas, X - x no es 0.
 *  - convertir la coma decimal ('3,5' -> '3.5'): la coma tambien separa argumentos
 *    en f(a, b). Es ambiguo y se resuelve en la capa de entrada, no aqui.
 */

/** Sustituciones de un solo caracter. Sin dependencias de Intl, para que corra en Hermes. */
const SUSTITUCIONES: Array<[string, string]> = [
  // Signos de resta tipograficos
  ['−', '-'], // MINUS SIGN
  ['–', '-'], // EN DASH
  ['—', '-'], // EM DASH
  ['‐', '-'], // HYPHEN
  ['‑', '-'], // NON-BREAKING HYPHEN
  // Multiplicacion
  ['×', '*'], // MULTIPLICATION SIGN
  ['⋅', '*'], // DOT OPERATOR
  ['·', '*'], // MIDDLE DOT
  ['∗', '*'], // ASTERISK OPERATOR
  // Division
  ['÷', '/'], // DIVISION SIGN
  ['∕', '/'], // DIVISION SLASH
  ['⁄', '/'], // FRACTION SLASH
  // Comparadores
  ['≤', '<='],
  ['≥', '>='],
  ['≠', '!='],
  // Constantes
  ['π', 'pi'],
  ['ᵰB', 'pi'],
  // Espacios raros
  [' ', ' '], // NBSP
  [' ', ' '], // NARROW NBSP
  [' ', ' '], // THIN SPACE
  ['​', ''], // ZERO WIDTH SPACE
  ['﻿', ''], // BOM
  // Comillas tipograficas que a veces se cuelan
  ['‘', "'"],
  ['’', "'"],
];

/** Superindices Unicode -> exponente explicito. 'x²' pasa a 'x^2'. */
const SUPERINDICES: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/**
 * Convierte runs de superindices en '^(...)'.
 * 'x²' -> 'x^2'   |   'x¹²' -> 'x^12'   |   '2³+x²' -> '2^3+x^2'
 */
function expandirSuperindices(s: string): string {
  let salida = '';
  let i = 0;
  while (i < s.length) {
    const c = s.charAt(i);
    if (SUPERINDICES[c] !== undefined) {
      let digitos = '';
      while (i < s.length && SUPERINDICES[s.charAt(i)] !== undefined) {
        digitos += SUPERINDICES[s.charAt(i)];
        i += 1;
      }
      salida += digitos.length > 1 ? '^(' + digitos + ')' : '^' + digitos;
    } else {
      salida += c;
      i += 1;
    }
  }
  return salida;
}

/**
 * '√' (raiz) -> 'sqrt(...)'.
 * Hay que envolver el radicando: 'sqrt x' no parsea. Se toma el grupo entre
 * parentesis si lo hay, y si no el token pegado al simbolo.
 * '√(x+1)' -> 'sqrt(x+1)'   |   '√x' -> 'sqrt(x)'   |   '√16' -> 'sqrt(16)'
 */
function expandirRaices(s: string): string {
  let salida = '';
  let i = 0;
  while (i < s.length) {
    if (s.charAt(i) !== '√') {
      salida += s.charAt(i);
      i += 1;
      continue;
    }
    i += 1; // consumir el simbolo de raiz
    while (i < s.length && s.charAt(i) === ' ') i += 1;
    if (i < s.length && s.charAt(i) === '(') {
      // Copiar el grupo equilibrado tal cual: ya viene con sus parentesis.
      let profundidad = 0;
      let grupo = '';
      while (i < s.length) {
        const c = s.charAt(i);
        if (c === '(') profundidad += 1;
        else if (c === ')') profundidad -= 1;
        grupo += c;
        i += 1;
        if (profundidad === 0) break;
      }
      salida += 'sqrt' + grupo;
    } else {
      // Token simple: letras y digitos pegados al simbolo.
      let token = '';
      while (i < s.length && /[A-Za-z0-9.]/.test(s.charAt(i))) {
        token += s.charAt(i);
        i += 1;
      }
      salida += token.length > 0 ? 'sqrt(' + token + ')' : 'sqrt';
    }
  }
  return salida;
}

/**
 * Normaliza texto matematico a una forma comparable.
 * El resultado se usa SOLO para comparar, no para mostrar al alumno.
 */
export function normalizarTexto(entrada: string): string {
  let s = String(entrada);

  // ORDEN CRITICO: los superindices se expanden ANTES de NFKC.
  //
  // NFKC descompone '\u00B2' en el digito '2'. Si se normaliza primero, 'x\u00B2' pasa a
  // 'x2' y mathjs lo lee como una VARIABLE llamada x2: el exponente desaparece
  // sin error ninguno. Con eso, 'x\u00B2+1' contra 'x*x+1' daba NO_EQUIVALENTE, es
  // decir, acusabamos de equivocarse a un alumno que habia acertado.
  s = expandirSuperindices(s);

  // Si el motor trae normalize() lo aprovechamos; Hermes puede no tenerlo.
  if (typeof (s as { normalize?: unknown }).normalize === 'function') {
    try {
      s = s.normalize('NFKC');
    } catch {
      /* sin Intl: seguimos con el mapa manual, que cubre el caso real */
    }
  }

  for (let i = 0; i < SUSTITUCIONES.length; i += 1) {
    s = s.split(SUSTITUCIONES[i][0]).join(SUSTITUCIONES[i][1]);
  }

  s = expandirRaices(s);

  // Potencia estilo programador
  s = s.split('**').join('^');

  // El espacio no significa nada en matematicas: fuera.
  s = s.replace(/\s+/g, '');

  // '+-' y '--' que aparecen al mover terminos
  s = s.split('--').join('+');

  return s;
}

/**
 * Forma canonica via AST: parsea y vuelve a imprimir, lo que unifica
 * parentesis redundantes y formato. Devuelve null si no parsea.
 */
export function formaCanonicaAST(
  entrada: string,
  parsear: (s: string) => { toString: () => string },
): string | null {
  try {
    return parsear(entrada).toString().replace(/\s+/g, '');
  } catch {
    return null;
  }
}
