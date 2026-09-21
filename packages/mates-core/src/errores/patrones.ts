/**
 * Los patrones: dado lo que el alumno tenia delante, ¿que habria escrito si
 * hubiera cometido este error?
 *
 * Cada patron devuelve CERO o MAS predicciones en texto. Cero significa que el
 * error ni siquiera es aplicable a esa expresion (no se puede repartir mal un
 * parentesis que no existe). Quien compara las predicciones con lo que escribio
 * el alumno es el verificador, en diagnostico.ts.
 */

import type { InstanciaMath, NodoMath } from '../verificador/math.js';

interface Nodo extends NodoMath {
  isParenthesisNode?: boolean;
  content?: unknown;
  value?: unknown;
}

function hijos(n: Nodo): Nodo[] {
  return Array.isArray(n.args) ? (n.args as Nodo[]) : [];
}

/** Quita los parentesis de envoltorio para poder mirar la forma de dentro. */
export function desenvolver(n: Nodo): Nodo {
  let actual = n;
  while (actual.isParenthesisNode === true && actual.content !== undefined) {
    actual = actual.content as Nodo;
  }
  return actual;
}

/** Texto de un nodo, siempre entre parentesis: evita sorpresas de precedencia. */
function t(n: Nodo): string {
  return '(' + n.toString() + ')';
}

export interface Termino {
  signo: 1 | -1;
  nodo: Nodo;
}

/**
 * Descompone una suma en sus terminos con signo. 'a - b + c' da tres terminos.
 * Devuelve un solo termino cuando no es una suma, que es lo correcto.
 */
export function terminos(n: Nodo): Termino[] {
  const salida: Termino[] = [];

  function recorrer(actual: Nodo, signo: 1 | -1): void {
    const d = desenvolver(actual);
    if (d.isOperatorNode === true) {
      const as = hijos(d);
      if ((d.op === '+' || d.op === '-') && as.length === 2) {
        recorrer(as[0], signo);
        const signoDerecho: 1 | -1 = d.op === '-' ? (signo === 1 ? -1 : 1) : signo;
        recorrer(as[1], signoDerecho);
        return;
      }
      // Menos unario: invierte el signo y sigue.
      if (d.op === '-' && as.length === 1) {
        recorrer(as[0], signo === 1 ? -1 : 1);
        return;
      }
    }
    salida.push({ signo, nodo: d });
  }

  recorrer(n, 1);
  return salida;
}

/** Reconstruye una suma a partir de sus terminos. */
function sumar(ts: ReadonlyArray<{ signo: 1 | -1; texto: string }>): string {
  let salida = '';
  for (let i = 0; i < ts.length; i += 1) {
    if (i === 0) salida += ts[i].signo === -1 ? '-' + ts[i].texto : ts[i].texto;
    else salida += (ts[i].signo === -1 ? '-' : '+') + ts[i].texto;
  }
  return salida === '' ? '0' : salida;
}

/** ¿Es 'K * (suma)' o '-(suma)'? Devuelve el factor y los terminos de dentro. */
export interface FactorPorSuma {
  /** Texto del factor que multiplica. '-1' en el caso de '-(...)'. */
  factor: string;
  /** El factor sin su signo, para el patron de signo al distribuir. */
  factorSinSigno: string;
  factorEsNegativo: boolean;
  interiores: Termino[];
}

export function factorPorSuma(n: Nodo, math: InstanciaMath): FactorPorSuma | null {
  const d = desenvolver(n);
  if (d.isOperatorNode !== true) return null;
  const as = hijos(d);

  // '-(a-b)': menos unario sobre una suma.
  if (d.op === '-' && as.length === 1) {
    const dentro = desenvolver(as[0]);
    const ts = terminos(dentro);
    if (ts.length < 2) return null;
    return { factor: '-1', factorSinSigno: '1', factorEsNegativo: true, interiores: ts };
  }

  if (d.op !== '*' || as.length !== 2) return null;

  // El factor puede estar a cualquier lado: 2*(x+3) o (x+3)*2.
  for (const [iFactor, iSuma] of [[0, 1], [1, 0]]) {
    const posibleSuma = desenvolver(as[iSuma]);
    const ts = terminos(posibleSuma);
    if (ts.length < 2) continue;

    const factorNodo = as[iFactor];
    const texto = factorNodo.toString();
    let negativo = false;
    let sinSigno = texto;
    try {
      const v = math.parse(texto).evaluate({});
      if (typeof v === 'number' && v < 0) {
        negativo = true;
        sinSigno = String(-v);
      }
    } catch {
      // Factor con variables: no se sabe su signo, se trata como positivo.
    }
    return { factor: texto, factorSinSigno: sinSigno, factorEsNegativo: negativo, interiores: ts };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Los patrones
// ---------------------------------------------------------------------------

/**
 * Linealidad ilusoria — "el sueno del novato".
 * El alumno reparte sobre una suma una operacion que NO es lineal:
 * (a+b)^2 -> a^2+b^2, sqrt(a+b) -> sqrt(a)+sqrt(b), log(a*b) mal usado,
 * 1/(a+b) -> 1/a+1/b. Es el error mas frecuente del temario.
 */
export function predecirLinealidadIlusoria(n: Nodo): string[] {
  const d = desenvolver(n);
  const salida: string[] = [];
  if (d.isOperatorNode !== true && d.isFunctionNode !== true) return salida;
  const as = hijos(d);

  // (A ± B)^k  ->  A^k ± B^k
  if (d.isOperatorNode === true && d.op === '^' && as.length === 2) {
    const base = desenvolver(as[0]);
    const ts = terminos(base);
    if (ts.length >= 2) {
      const exp = as[1].toString();
      salida.push(sumar(ts.map((x) => ({ signo: x.signo, texto: t(x.nodo) + '^(' + exp + ')' }))));
    }
  }

  // 1/(A ± B)  ->  1/A ± 1/B
  if (d.isOperatorNode === true && d.op === '/' && as.length === 2) {
    const den = desenvolver(as[1]);
    const ts = terminos(den);
    if (ts.length >= 2) {
      const num = t(as[0]);
      salida.push(sumar(ts.map((x) => ({ signo: x.signo, texto: num + '/' + t(x.nodo) }))));
    }
  }

  // f(A ± B)  ->  f(A) ± f(B)   con f no lineal
  if (d.isFunctionNode === true && as.length === 1) {
    const fn = d.fn;
    const nombre = typeof fn === 'string' ? fn : fn !== undefined ? fn.name : undefined;
    const NO_LINEALES = ['sqrt', 'cbrt', 'log', 'ln', 'log10', 'log2', 'exp', 'sin', 'cos', 'tan'];
    if (typeof nombre === 'string' && NO_LINEALES.indexOf(nombre) !== -1) {
      const ts = terminos(desenvolver(as[0]));
      if (ts.length >= 2) {
        salida.push(sumar(ts.map((x) => ({ signo: x.signo, texto: nombre + '(' + x.nodo.toString() + ')' }))));
      }
    }
  }

  return salida;
}

/**
 * Distribucion parcial: el factor llega al primer termino y se olvida del resto.
 * 2*(x+3) -> 2x+3 · x*(x+5) -> x^2+5 · a*(b+c) -> a*b+c
 */
export function predecirDistribucionParcial(n: Nodo, math: InstanciaMath): string[] {
  const f = factorPorSuma(n, math);
  if (f === null) return [];
  const ts = f.interiores;
  const salida: string[] = [];

  // Reparte solo a uno de los terminos y deja los demas intactos. Se prueban
  // todas las posiciones: el alumno suele olvidar el ultimo, pero no siempre.
  for (let saltado = 0; saltado < ts.length; saltado += 1) {
    const piezas = ts.map((x, i) => ({
      signo: x.signo,
      texto: i === saltado ? t(x.nodo) : '(' + f.factor + ')*' + t(x.nodo),
    }));
    salida.push(sumar(piezas));
  }
  return salida;
}

/**
 * Signo al distribuir un factor negativo: el alumno reparte el VALOR ABSOLUTO
 * del factor y conserva el signo interior.
 * -3*(x-4) -> -3x-12 · -(x-3) -> -x-3 · -2*(3-x) -> -6-2x
 */
export function predecirSignoAlDistribuir(n: Nodo, math: InstanciaMath): string[] {
  const f = factorPorSuma(n, math);
  if (f === null || !f.factorEsNegativo) return [];

  const piezas: Array<{ signo: 1 | -1; texto: string }> = f.interiores.map((x, i) => ({
    signo: x.signo,
    // El primer termino si recibe el factor con su signo; los demas, sin el.
    texto: i === 0 ? '(' + f.factor + ')*' + t(x.nodo) : '(' + f.factorSinSigno + ')*' + t(x.nodo),
  }));
  // El primero lleva el signo del factor, que ya va dentro del texto.
  const primero = piezas[0];
  const resto = piezas.slice(1);
  const uno: { signo: 1 | -1; texto: string } = { signo: 1, texto: primero.texto };
  return [sumar([uno].concat(resto))];
}

/**
 * Cancelacion ilegal: se tacha contra el denominador un SUMANDO, no un factor.
 * (x+3)/3 -> x · (x^2+x)/x -> x^2
 */
export function predecirCancelacionIlegal(n: Nodo, math: InstanciaMath): string[] {
  const d = desenvolver(n);
  if (d.isOperatorNode !== true || d.op !== '/') return [];
  const as = hijos(d);
  if (as.length !== 2) return [];

  const ts = terminos(desenvolver(as[0]));
  if (ts.length < 2) return [];
  const den = desenvolver(as[1]).toString();

  const salida: string[] = [];
  for (let i = 0; i < ts.length; i += 1) {
    // ¿Este sumando es identico al denominador? Entonces el alumno lo tacha
    // entero y deja los demas tal cual, sin dividirlos.
    let iguales = false;
    try {
      iguales = math.rationalize('(' + ts[i].nodo.toString() + ')-(' + den + ')').toString() === '0';
    } catch {
      iguales = ts[i].nodo.toString() === den;
    }
    if (!iguales) continue;
    const resto = ts.filter((_, j) => j !== i).map((x) => ({ signo: x.signo, texto: t(x.nodo) }));
    if (resto.length > 0) salida.push(sumar(resto));
  }
  return salida;
}

/**
 * Terminos no semejantes juntados a la fuerza: 2x+3y -> 5xy, y variantes.
 * La analogia que funciona con el alumno es de unidades: 9 manzanas + 1 pera.
 */
export function predecirTerminosNoSemejantes(n: Nodo): string[] {
  const ts = terminos(n);
  if (ts.length !== 2) return [];
  const [a, b] = ts;
  const ta = a.nodo.toString();
  const tb = b.nodo.toString();
  if (ta === tb) return [];

  const sa = a.signo === -1 ? '-(' + ta + ')' : '(' + ta + ')';
  const sb = b.signo === -1 ? '-(' + tb + ')' : '(' + tb + ')';
  // Suma los coeficientes y multiplica las partes literales.
  return ['(' + sa + '+' + sb + ')', '(' + sa + ')*(' + sb + ')'];
}

/** Suma de fracciones en linea: a/b + c/d -> (a+c)/(b+d). */
export function predecirSumaDeFracciones(n: Nodo): string[] {
  const ts = terminos(n);
  if (ts.length !== 2) return [];

  const partes: Array<{ num: string; den: string } | null> = ts.map((x) => {
    const d = desenvolver(x.nodo);
    if (d.isOperatorNode !== true || d.op !== '/') return null;
    const as = hijos(d);
    if (as.length !== 2) return null;
    const num = x.signo === -1 ? '-(' + as[0].toString() + ')' : '(' + as[0].toString() + ')';
    return { num, den: '(' + as[1].toString() + ')' };
  });

  if (partes[0] === null || partes[1] === null) return [];
  return ['(' + partes[0].num + '+' + partes[1].num + ')/(' + partes[0].den + '+' + partes[1].den + ')'];
}

/** Parte literal y coeficiente de un termino: '3*x^2' -> {coef:'3', literal:'x^2'}. */
function partirTermino(n: Nodo): { coef: string; literal: string } | null {
  const d = desenvolver(n);
  if (d.isOperatorNode === true && d.op === '*') {
    const as = hijos(d);
    if (as.length !== 2) return null;
    const izq = as[0].toString();
    if (/^[0-9.]+$/.test(izq)) return { coef: izq, literal: as[1].toString() };
    const der = as[1].toString();
    if (/^[0-9.]+$/.test(der)) return { coef: der, literal: izq };
    return null;
  }
  return { coef: '1', literal: d.toString() };
}

/** Base y exponente de una potencia: 'x^2' -> {base:'x', exp:'2'}; 'x' -> {base:'x', exp:'1'}. */
function partirPotencia(texto: string, math: InstanciaMath): { base: string; exp: string } | null {
  let n: Nodo;
  try {
    n = math.parse(texto) as Nodo;
  } catch {
    return null;
  }
  const d = desenvolver(n);
  if (d.isOperatorNode === true && d.op === '^') {
    const as = hijos(d);
    if (as.length === 2) return { base: as[0].toString(), exp: as[1].toString() };
  }
  if (d.isSymbolNode === true) return { base: d.toString(), exp: '1' };
  return null;
}

/**
 * Exponentes sumados al SUMAR terminos, que es distinto de sumarlos al
 * multiplicar (eso si es correcto).
 * x^2+3x^2 -> 4x^4 · x^2+x^3 -> x^5 · 3x+2x -> 5x^2
 */
export function predecirExponentesSumados(n: Nodo, math: InstanciaMath): string[] {
  const ts = terminos(n);
  if (ts.length !== 2) return [];

  const p0 = partirTermino(ts[0].nodo);
  const p1 = partirTermino(ts[1].nodo);
  if (p0 === null || p1 === null) return [];

  const q0 = partirPotencia(p0.literal, math);
  const q1 = partirPotencia(p1.literal, math);
  if (q0 === null || q1 === null || q0.base !== q1.base) return [];

  const c0 = ts[0].signo === -1 ? '-(' + p0.coef + ')' : '(' + p0.coef + ')';
  const c1 = ts[1].signo === -1 ? '-(' + p1.coef + ')' : '(' + p1.coef + ')';
  const coef = '(' + c0 + '+' + c1 + ')';
  const exp = '((' + q0.exp + ')+(' + q1.exp + '))';
  return [coef + '*(' + q0.base + ')^' + exp];
}

/** Coeficientes multiplicados en vez de sumados: 3x+2x -> 6x. */
export function predecirCoeficientesMultiplicados(n: Nodo): string[] {
  const ts = terminos(n);
  if (ts.length !== 2) return [];

  const p0 = partirTermino(ts[0].nodo);
  const p1 = partirTermino(ts[1].nodo);
  if (p0 === null || p1 === null) return [];
  if (p0.literal !== p1.literal) return [];

  const c0 = ts[0].signo === -1 ? '-(' + p0.coef + ')' : '(' + p0.coef + ')';
  const c1 = ts[1].signo === -1 ? '-(' + p1.coef + ')' : '(' + p1.coef + ')';
  return ['(' + c0 + '*' + c1 + ')*(' + p0.literal + ')'];
}

// ---------------------------------------------------------------------------
// Segunda tanda de patrones, anadida tras MEDIR la cobertura de la primera.
//
// La primera tanda explicaba 22 de los 115 pasos malos de la bateria. El
// desglose por area senalo tres familias enteras sin cubrir: exponentes (0/8),
// fracciones (2/15) y ecuaciones (0/19). Estas son esas tres.
// ---------------------------------------------------------------------------

/** ¿Es un numero literal? */
function esNumero(s: string): boolean {
  return /^-?[0-9]+(\.[0-9]+)?$/.test(s.trim());
}

/**
 * Las reglas de los exponentes, que el alumno mezcla entre si.
 * x^a*x^b -> x^(a*b) · (x^a)^b -> x^(a+b) · a^0 -> 0 · a^-n -> -(a^n)
 * 2^3 -> 6 (confunde potencia con producto) · sqrt(a) -> a/2
 */
export function predecirReglasDeExponentes(n: Nodo, math: InstanciaMath): string[] {
  const d = desenvolver(n);
  const salida: string[] = [];
  const as = hijos(d);

  if (d.isOperatorNode === true && d.op === '*' && as.length === 2) {
    // x^a * x^b -> x^(a*b), confundiendo el producto de potencias con la
    // potencia de una potencia.
    const i = desenvolver(as[0]);
    const j = desenvolver(as[1]);
    const pi = potenciaDe(i);
    const pj = potenciaDe(j);
    if (pi !== null && pj !== null && pi.base === pj.base) {
      salida.push('(' + pi.base + ')^((' + pi.exp + ')*(' + pj.exp + '))');
    }
  }

  if (d.isOperatorNode === true && d.op === '^' && as.length === 2) {
    const base = desenvolver(as[0]);
    const exp = as[1].toString();

    // (x^a)^b -> x^(a+b), confundiendola con el producto de potencias.
    const pb = potenciaDe(base);
    if (pb !== null) salida.push('(' + pb.base + ')^((' + pb.exp + ')+(' + exp + '))');

    // a^0 -> 0. El alumno arrastra "multiplicar por cero da cero".
    if (exp.trim() === '0') salida.push('0');

    // a^-n -> -(a^n). Cree que el menos del exponente sale fuera.
    let vExp: number | null = null;
    try {
      const v = math.parse(exp).evaluate({});
      if (typeof v === 'number') vExp = v;
    } catch { /* exponente con variables */ }
    if (vExp !== null && vExp < 0) {
      salida.push('-((' + base.toString() + ')^(' + String(-vExp) + '))');
    }

    // 2^3 -> 6. Potencia leida como producto.
    const tb = base.toString();
    if (esNumero(tb) && esNumero(exp)) salida.push('(' + tb + ')*(' + exp + ')');

    // (-2)^3 -> 8. Aplica el exponente y olvida el signo de la base.
    if (vExp === null && esNumero(exp)) {
      let vBase: number | null = null;
      try {
        const v = math.parse(tb).evaluate({});
        if (typeof v === 'number') vBase = v;
      } catch { /* base con variables */ }
      if (vBase !== null && vBase < 0) {
        salida.push('(' + String(-vBase) + ')^(' + exp + ')');
      }
    }
  }

  // sqrt(a) -> a/2. Confunde la raiz con dividir entre el indice.
  if (d.isFunctionNode === true && as.length === 1) {
    const fn = d.fn;
    const nombre = typeof fn === 'string' ? fn : fn !== undefined ? fn.name : undefined;
    if (nombre === 'sqrt') salida.push('(' + as[0].toString() + ')/2');
    if (nombre === 'cbrt') salida.push('(' + as[0].toString() + ')/3');
  }

  return salida;
}

/** Base y exponente de un nodo potencia; un simbolo suelto es exponente 1. */
function potenciaDe(n: Nodo): { base: string; exp: string } | null {
  const d = desenvolver(n);
  if (d.isOperatorNode === true && d.op === '^') {
    const as = hijos(d);
    if (as.length === 2) return { base: as[0].toString(), exp: as[1].toString() };
  }
  if (d.isSymbolNode === true) return { base: d.toString(), exp: '1' };
  return null;
}

/** Numerador y denominador de un nodo, si es una division. */
function fraccionDe(n: Nodo): { num: string; den: string } | null {
  const d = desenvolver(n);
  if (d.isOperatorNode !== true || d.op !== '/') return null;
  const as = hijos(d);
  if (as.length !== 2) return null;
  return { num: '(' + as[0].toString() + ')', den: '(' + as[1].toString() + ')' };
}

/**
 * Las operaciones con fracciones hechas "en linea", termino a termino.
 * Es la familia mas numerosa del temario de secundaria y la creencia de fondo
 * es siempre la misma: que las fracciones se operan como se multiplican.
 */
export function predecirOperacionDeFracciones(n: Nodo, math: InstanciaMath): string[] {
  const d = desenvolver(n);
  const salida: string[] = [];
  const as = hijos(d);

  // a/b * c/d -> (a*d)/(b*c). Multiplica en cruz.
  if (d.isOperatorNode === true && d.op === '*' && as.length === 2) {
    const f0 = fraccionDe(as[0]);
    const f1 = fraccionDe(as[1]);
    if (f0 !== null && f1 !== null) {
      salida.push('(' + f0.num + '*' + f1.den + ')/(' + f0.den + '*' + f1.num + ')');
    }
  }

  if (d.isOperatorNode === true && d.op === '/' && as.length === 2) {
    const f0 = fraccionDe(as[0]);
    const f1 = fraccionDe(as[1]);
    // (a/b)/(c/d) -> (a*c)/(b*d). Multiplica sin invertir la segunda.
    if (f0 !== null && f1 !== null) {
      salida.push('(' + f0.num + '*' + f1.num + ')/(' + f0.den + '*' + f1.den + ')');
    }
    // 1/(c/d) -> c/d. No invierte el reciproco.
    if (f1 !== null && as[0].toString().trim() === '1') {
      salida.push(f1.num + '/' + f1.den);
    }
    // (a+b)/k -> a + b/k. Divide solo el ultimo termino. Y su simetrica.
    const ts = terminos(desenvolver(as[0]));
    const den = '(' + as[1].toString() + ')';
    if (ts.length >= 2) {
      for (let saltado = 0; saltado < ts.length; saltado += 1) {
        salida.push(sumar(ts.map((x, i) => ({
          signo: x.signo,
          texto: i === saltado ? t(x.nodo) : t(x.nodo) + '/' + den,
        }))));
      }
    }
  }

  // (a/b)^k -> a/(b^k)  y  (a^k)/b. Eleva solo una de las dos partes.
  if (d.isOperatorNode === true && d.op === '^' && as.length === 2) {
    const f = fraccionDe(as[0]);
    if (f !== null) {
      const k = as[1].toString();
      salida.push(f.num + '/(' + f.den + '^(' + k + '))');
      salida.push('(' + f.num + '^(' + k + '))/' + f.den);
    }
  }

  // a/b ± c/d operado en linea, en los dos ordenes del denominador.
  const ts = terminos(n);
  if (ts.length === 2) {
    const f0 = fraccionDe(ts[0].nodo);
    const f1 = fraccionDe(ts[1].nodo);
    if (f0 !== null && f1 !== null) {
      const signo = ts[1].signo === -1 ? '-' : '+';
      const num = '(' + f0.num + signo + f1.num + ')';
      salida.push(num + '/(' + f0.den + signo + f1.den + ')');
      salida.push(num + '/(' + f1.den + signo + f0.den + ')');
      // Con el mismo denominador: opera arriba y TIRA el denominador.
      let mismos = false;
      try {
        mismos = math.rationalize(f0.den + '-' + f1.den).toString() === '0';
      } catch {
        mismos = f0.den === f1.den;
      }
      if (mismos) salida.push(num);
    }
  }

  return salida;
}

/**
 * Transposicion sin cambio de signo, en ecuaciones.
 * x+5=12 -> x=12+5 · 2x+5=13 -> 2x=13+5 · 5x=2x+9 -> 5x+2x=9
 *
 * Es el error de "igualdad" del catalogo de Booth, y va aparte porque una
 * ecuacion no se parsea como una expresion: hay que partirla primero.
 */
export function predecirTransposicion(
  izq: string,
  der: string,
  math: InstanciaMath,
): string[] {
  let nIzq: Nodo;
  let nDer: Nodo;
  try {
    nIzq = math.parse(izq) as Nodo;
    nDer = math.parse(der) as Nodo;
  } catch {
    return [];
  }

  const tIzq = terminos(nIzq);
  const tDer = terminos(nDer);
  const salida: string[] = [];

  const texto = (ts: ReadonlyArray<Termino>): string =>
    sumar(ts.map((x) => ({ signo: x.signo, texto: t(x.nodo) })));

  // Pasa un termino de la izquierda a la derecha SIN cambiarle el signo.
  if (tIzq.length >= 2) {
    for (let i = 0; i < tIzq.length; i += 1) {
      const quedan = tIzq.filter((_, j) => j !== i);
      if (quedan.length === 0) continue;
      const movido = { signo: tIzq[i].signo, texto: t(tIzq[i].nodo) };
      salida.push(texto(quedan) + '=' + sumar(tDer.map((x) => ({ signo: x.signo, texto: t(x.nodo) })).concat([movido])));
    }
  }

  // Y de la derecha a la izquierda, igual de mal.
  if (tDer.length >= 2) {
    for (let i = 0; i < tDer.length; i += 1) {
      const quedan = tDer.filter((_, j) => j !== i);
      if (quedan.length === 0) continue;
      const movido = { signo: tDer[i].signo, texto: t(tDer[i].nodo) };
      salida.push(sumar(tIzq.map((x) => ({ signo: x.signo, texto: t(x.nodo) })).concat([movido])) + '=' + texto(quedan));
    }
  }

  return salida;
}

/**
 * Operacion aplicada a un solo lado de la ecuacion: el balance se rompe.
 * 2x=8 -> x=8 (divide solo a la izquierda) · x+3=7 -> x=7
 */
export function predecirBalanceRoto(
  izq: string,
  der: string,
  math: InstanciaMath,
): string[] {
  let nIzq: Nodo;
  try {
    nIzq = math.parse(izq) as Nodo;
  } catch {
    return [];
  }
  const salida: string[] = [];

  // Quita un termino de la izquierda y no toca la derecha.
  const ts = terminos(nIzq);
  if (ts.length >= 2) {
    for (let i = 0; i < ts.length; i += 1) {
      const quedan = ts.filter((_, j) => j !== i);
      if (quedan.length === 0) continue;
      salida.push(sumar(quedan.map((x) => ({ signo: x.signo, texto: t(x.nodo) }))) + '=' + der);
    }
  }

  // Divide la izquierda por su coeficiente y no divide la derecha.
  const d = desenvolver(nIzq);
  if (d.isOperatorNode === true && d.op === '*') {
    const as = hijos(d);
    if (as.length === 2) {
      for (const [iCoef, iResto] of [[0, 1], [1, 0]]) {
        const coef = as[iCoef].toString();
        if (!esNumero(coef)) continue;
        salida.push(as[iResto].toString() + '=' + der);
      }
    }
  }
  void math;
  return salida;
}
