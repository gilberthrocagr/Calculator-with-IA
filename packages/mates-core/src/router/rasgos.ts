/**
 * Extraccion de rasgos estructurales de una expresion.
 *
 * Todo sale del AST de mathjs. Ni una heuristica sobre la cadena: el router
 * tiene que ser reproducible y auditable en CI, igual que el verificador.
 */

import type { InstanciaMath, NodoMath } from '../verificador/math.js';
import { variablesLibres, nombresDeFuncion, CONSTANTES_RESERVADAS } from '../verificador/variables.js';
import { partirEcuacion, esDesigualdad } from '../verificador/index.js';
import { normalizarTexto } from '../verificador/normalizar.js';
import { FUNCIONES_TRASCENDENTES, FUNCIONES_RADICALES } from './tipos.js';
import type { Rasgos } from './tipos.js';

/**
 * mathjs expone mas campos de los que declara nuestra superficie minima.
 * Se anaden aqui, en local, en vez de tocar math.ts: ese modulo lo usa el
 * verificador, que esta fijado con tests y no se toca para esto.
 */
interface Nodo extends NodoMath {
  isParenthesisNode?: boolean;
  content?: unknown;
  value?: unknown;
}

function hijos(n: Nodo): Nodo[] {
  return Array.isArray(n.args) ? (n.args as Nodo[]) : [];
}

/**
 * Valor numerico de un subarbol constante, o null si no lo es.
 *
 * NO basta con mirar isConstantNode. MEDIDO en mathjs 15.2.0: el exponente de
 * 'x^(1/2)' es un ParenthesisNode y el de 'x^-1' es un OperatorNode, no
 * ConstantNode. Quedandose en el caso facil, 'x^(1/2)' no se reconocia como
 * radical y se colaba al nivel 1, que es exactamente lo que este modulo existe
 * para evitar.
 *
 * Por eso, si el subarbol no tiene variables libres, se evalua. Sin variables
 * la evaluacion es cerrada y reproducible; con ellas ni se intenta.
 */
function valorConstante(n: Nodo): number | null {
  if (n.isConstantNode === true) {
    const v = n.value;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    // BigNumber y Fraction de mathjs saben convertirse a number.
    if (v !== null && typeof v === 'object' && 'toNumber' in v) {
      const f = (v as { toNumber: () => number }).toNumber;
      if (typeof f === 'function') {
        const n2 = f.call(v);
        return typeof n2 === 'number' && Number.isFinite(n2) ? n2 : null;
      }
    }
    return null;
  }

  if (variablesLibres(n).length > 0) return null;
  try {
    const v = n.evaluate({});
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Grado del polinomio respecto de sus variables libres, o null si no lo es.
 *
 * Se recorre el arbol en vez de usar math.rationalize por dos razones: soporta
 * varias variables (rationalize detallado es univariante) y no depende de que
 * rationalize consiga reescribir la expresion, que es justo donde falla con las
 * formas raras que escribe un alumno.
 *
 * Devuelve null en cuanto aparece algo que no es polinomico: una funcion, un
 * exponente variable, un exponente fraccionario, o una variable en el denominador.
 */
export function gradoPolinomico(
  math: InstanciaMath,
  nodo: Nodo,
  variables: ReadonlyArray<string>,
): number | null {
  // rationalize colapsa los terminos que se cancelan. MEDIDO: sobre la forma
  // anulada de 'x^2 + x = x^2 + 3' el recorrido del arbol da 2 (el grado
  // SINTACTICO) y rationalize da 'x - 3', grado 1, que es el real. Sin esto una
  // ecuacion lineal de verdad se iria al nivel 2 por un x^2 que se cancela.
  //
  // MEDIDO tambien: rationalize lanza con funciones ('There is an unsolved
  // function call') y con exponentes no enteros ('There is a non-integer
  // exponent'), que son justo los casos en los que el recorrido del arbol ya
  // responde null. Por eso el fallback es correcto y no tapa nada.
  try {
    return gradoDelArbol(math.rationalize(nodo) as Nodo, variables);
  } catch {
    return gradoDelArbol(nodo, variables);
  }
}

/** Grado leido del arbol tal cual, sin canonizar. Cota superior del real. */
export function gradoDelArbol(nodo: Nodo, variables: ReadonlyArray<string>): number | null {
  const esVariable = new Set<string>(variables);

  function grado(n: Nodo): number | null {
    if (n.isConstantNode === true) return 0;

    if (n.isSymbolNode === true) {
      const nombre = n.name;
      if (typeof nombre !== 'string') return null;
      // Las constantes (pi, e) y los nombres de funcion no suman grado.
      return esVariable.has(nombre) ? 1 : 0;
    }

    if (n.isParenthesisNode === true) {
      const dentro = n.content as Nodo | undefined;
      return dentro === undefined ? null : grado(dentro);
    }

    if (n.isOperatorNode === true) {
      const as = hijos(n);
      const op = n.op;

      // Menos unario: -x tiene el grado de x.
      if (as.length === 1) return grado(as[0]);

      if (op === '+' || op === '-') {
        let maximo = 0;
        for (let i = 0; i < as.length; i += 1) {
          const g = grado(as[i]);
          if (g === null) return null;
          if (g > maximo) maximo = g;
        }
        return maximo;
      }

      if (op === '*') {
        let suma = 0;
        for (let i = 0; i < as.length; i += 1) {
          const g = grado(as[i]);
          if (g === null) return null;
          suma += g;
        }
        return suma;
      }

      if (op === '/') {
        if (as.length !== 2) return null;
        const gNum = grado(as[0]);
        const gDen = grado(as[1]);
        if (gNum === null || gDen === null) return null;
        // Variable en el denominador: es racional, no polinomica.
        if (gDen !== 0) return null;
        return gNum;
      }

      if (op === '^') {
        if (as.length !== 2) return null;
        const gBase = grado(as[0]);
        if (gBase === null) return null;
        const gExp = grado(as[1]);
        // Exponente con variable (2^x): no es polinomio.
        if (gExp === null || gExp !== 0) return null;
        const exp = valorConstante(as[1]);
        // Exponente no constante o no entero no negativo: sqrt disfrazado, x^-1...
        if (exp === null || !Number.isInteger(exp) || exp < 0) {
          return gBase === 0 ? 0 : null;
        }
        return gBase * exp;
      }

      return null;
    }

    // FunctionNode y cualquier otra cosa: fuera del mundo polinomico.
    return null;
  }

  return grado(nodo);
}

/** ¿Hay una potencia de exponente no entero? Es un radical escrito como potencia. */
function tienePotenciaFraccionaria(nodo: Nodo): boolean {
  let encontrada = false;
  nodo.traverse((bruto) => {
    const n = bruto as Nodo;
    if (encontrada) return;
    if (n.isOperatorNode !== true || n.op !== '^') return;
    const as = hijos(n);
    if (as.length !== 2) return;
    const exp = valorConstante(as[1]);
    if (exp !== null && !Number.isInteger(exp)) encontrada = true;
  });
  return encontrada;
}

/** ¿Aparece ese operador en algun punto del arbol? */
function tieneOperador(nodo: Nodo, op: string): boolean {
  let encontrado = false;
  nodo.traverse((bruto) => {
    const n = bruto as Nodo;
    if (n.isOperatorNode === true && n.op === op) encontrado = true;
  });
  return encontrado;
}

/** ¿Hay una division con variable en el denominador? */
function tieneVariableEnDenominador(nodo: Nodo, variables: ReadonlyArray<string>): boolean {
  const esVariable = new Set<string>(variables);
  let encontrada = false;
  nodo.traverse((bruto) => {
    const n = bruto as Nodo;
    if (encontrada) return;
    if (n.isOperatorNode !== true || n.op !== '/') return;
    const as = hijos(n);
    if (as.length !== 2) return;
    const den = as[1];
    const simbolos = den.filter((s) => s.isSymbolNode === true);
    for (let i = 0; i < simbolos.length; i += 1) {
      const nombre = simbolos[i].name;
      if (typeof nombre === 'string' && esVariable.has(nombre)) {
        encontrada = true;
        return;
      }
    }
  });
  return encontrada;
}

function interseccion(nombres: ReadonlyArray<string>, permitidas: ReadonlyArray<string>): string[] {
  const set = new Set<string>(permitidas);
  const salida: string[] = [];
  for (let i = 0; i < nombres.length; i += 1) {
    if (set.has(nombres[i]) && salida.indexOf(nombres[i]) === -1) salida.push(nombres[i]);
  }
  return salida;
}

/**
 * Rasgos de una entrada. Nunca lanza: si no se puede parsear lo dice en
 * entradaValida y el router decide que hacer con ello.
 */
export function extraerRasgos(math: InstanciaMath, entrada: string): Rasgos {
  const desigualdad = esDesigualdad(entrada);
  const ecuacion = partirEcuacion(entrada);
  const esEcuacion = ecuacion !== null;

  // Una desigualdad no la parsea nuestro camino normal, y tampoco hace falta:
  // el router la manda entera al nivel 3. Se devuelven los rasgos que se saben.
  if (desigualdad) {
    return {
      entradaValida: true,
      esEcuacion: false,
      esDesigualdad: true,
      variables: [],
      funciones: [],
      trascendentes: [],
      tieneRadicales: false,
      tieneDivision: false,
      tieneVariableEnDenominador: false,
      grado: null,
    };
  }

  // En una ecuacion se analiza la forma anulada izq-der: es la que decide como
  // se resuelve, y ademas permite reusar todo lo de las expresiones.
  const texto = esEcuacion
    ? '(' + normalizarTexto(ecuacion.izq) + ')-(' + normalizarTexto(ecuacion.der) + ')'
    : normalizarTexto(entrada);

  let nodo: Nodo;
  try {
    nodo = math.parse(texto) as Nodo;
  } catch (e) {
    return {
      entradaValida: false,
      errorDeParseo: e instanceof Error ? e.message.split('\n')[0] : String(e),
      esEcuacion,
      esDesigualdad: false,
      variables: [],
      funciones: [],
      trascendentes: [],
      tieneRadicales: false,
      tieneDivision: false,
      tieneVariableEnDenominador: false,
      grado: null,
    };
  }

  const variables = variablesLibres(nodo);
  const funciones = Array.from(nombresDeFuncion(nodo)).sort();
  const trascendentes = interseccion(funciones, FUNCIONES_TRASCENDENTES);
  const radicalesPorFuncion = interseccion(funciones, FUNCIONES_RADICALES).length > 0;

  return {
    entradaValida: true,
    esEcuacion,
    esDesigualdad: false,
    variables,
    funciones,
    trascendentes,
    tieneRadicales: radicalesPorFuncion || tienePotenciaFraccionaria(nodo),
    tieneDivision: tieneOperador(nodo, '/'),
    tieneVariableEnDenominador: tieneVariableEnDenominador(nodo, variables),
    grado: gradoPolinomico(math, nodo, variables),
  };
}

/** Reexportado para los tests: las constantes no cuentan como variables. */
export { CONSTANTES_RESERVADAS };
