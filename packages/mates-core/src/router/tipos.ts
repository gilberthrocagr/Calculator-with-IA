/**
 * Tipos del clasificador y del router.
 *
 * El router NO ejecuta nada: mira la expresion, extrae rasgos estructurales y
 * devuelve a que nivel del motor corresponde. Quien la ejecute es cosa de la app
 * (niveles 1 y 2, offline) o del servidor (nivel 3). Este paquete sigue siendo
 * puro: no abre red, no carga motores.
 */

import type { Area } from '../bateria/tipos.js';

/**
 * - 1: mathsteps-experimental-fork. Offline, pasos con nombre de regla.
 *      Aritmetica, fracciones, terminos semejantes, distributiva, lineales.
 * - 2: nerdamer-prime. Offline. Factorizacion, cuadraticas, radicales.
 * - 3: SymPy en servidor. Todo lo que los otros dos no pueden o hacen mal.
 *
 * NO hay nivel 4 aqui: el nivel 4 es el LLM traduciendo enunciados, y al router
 * le llega la expresion YA en notacion matematica.
 */
export type Nivel = 1 | 2 | 3;

/**
 * Que se le pide al motor. mathsteps ya distingue simplifyExpression de
 * solveEquation, asi que la operacion es parte de la peticion, no algo que se
 * adivine: 'x^2-1' se simplifica, se factoriza o se resuelve, y cada una va a
 * un motor distinto.
 *
 * 'auto' decide por la forma: si hay '=' resuelve, si no simplifica.
 */
export type Operacion = 'auto' | 'simplificar' | 'resolver' | 'factorizar' | 'expandir';

/** Rasgos estructurales. Todo esto sale del AST, sin heuristicas de lenguaje. */
export interface Rasgos {
  /** false cuando mathjs no pudo parsear la entrada. */
  entradaValida: boolean;
  /** Mensaje del parser cuando entradaValida es false. */
  errorDeParseo?: string;
  esEcuacion: boolean;
  esDesigualdad: boolean;
  /** Variables libres reales, sin nombres de funcion ni constantes. */
  variables: string[];
  /** Todos los nombres de funcion del arbol. */
  funciones: string[];
  /**
   * Las funciones que BLOQUEAN el nivel 1. Medido en la fase 0: mathsteps no
   * lanza con trigonometria, devuelve la ecuacion sin tocar y el alumno veria
   * "3 pasos" que no llevan a ninguna parte. Ver docs/fase-0-pruebas-de-riesgo.md.
   */
  trascendentes: string[];
  /** sqrt, cbrt, nthRoot, o una potencia de exponente no entero. */
  tieneRadicales: boolean;
  /**
   * Los radicales no llevan variables: sqrt(8), sqrt(12)+sqrt(3).
   *
   * MEDIDO contra mathsteps 0.9.12: los resuelve bien con reglas KEMU.
   *   sqrt(8)            -> 2 sqrt(2)   KEMU_SQRT_FROM_CONST
   *   sqrt(12) + sqrt(3) -> 3 * sqrt(3)
   *   sqrt(50)           -> 5 sqrt(2)
   * Por eso NO bloquean el nivel 1, al contrario que los radicales con
   * variables, que si van al nivel 2.
   */
  radicalesSoloNumericos: boolean;
  /** Hay al menos una division. Distingue 'fracciones' de 'aritmetica'. */
  tieneDivision: boolean;
  /** Division con la variable en el denominador: funcion racional. */
  tieneVariableEnDenominador: boolean;
  /**
   * Grado del polinomio, o null si no lo es. En una ecuacion es el grado de la
   * forma anulada izq-der, que es lo que decide como se resuelve.
   */
  grado: number | null;
}

export interface Decision {
  nivel: Nivel;
  /** La operacion que se resolvio, ya sin 'auto'. */
  operacion: Exclude<Operacion, 'auto'>;
  /** Por que ese nivel. En espanol, para log y depuracion. */
  motivo: string;
  /**
   * Razones por las que la entrada NO puede ir al nivel 1. Vacio si podria.
   * Se guarda aunque el nivel elegido sea el 1 por otra via: sirve de traza.
   */
  bloqueosDeNivel1: string[];
  rasgos: Rasgos;
  /**
   * Area del temario, SOLO como pista para la interfaz y las metricas.
   * NUNCA se usa para enrutar: de una expresion suelta no se puede deducir con
   * fiabilidad si el alumno queria factorizar o expandir. Cuando no hay senal
   * clara vale 'desconocida', que es mas honesto que inventar una etiqueta.
   */
  area: Area | 'desconocida';
}

/**
 * Familia trascendente completa. El brief nombraba sin/cos/tan/log/ln/exp; aqui
 * van tambien las inversas, las hiperbolicas y las variantes de logaritmo,
 * porque el alumno las escribe igual y mathsteps se queda igual de callado.
 *
 * 'ln' no es una funcion de mathjs (alli el logaritmo natural es 'log'), pero el
 * alumno la escribe: se deja en la lista para que el bloqueo actue tambien
 * cuando la entrada venga de MathLive o del traductor.
 */
export const FUNCIONES_TRASCENDENTES: ReadonlyArray<string> = [
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'asin', 'acos', 'atan', 'atan2', 'acsc', 'asec', 'acot',
  'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth',
  'asinh', 'acosh', 'atanh',
  'log', 'ln', 'log10', 'log2', 'log1p', 'exp', 'expm1',
];

/** Funciones que introducen radicales. */
export const FUNCIONES_RADICALES: ReadonlyArray<string> = ['sqrt', 'cbrt', 'nthRoot'];
