/**
 * Clasificador de area del temario.
 *
 * AVISO DE ALCANCE, para que nadie construya encima mas de lo que aguanta:
 * de una expresion suelta NO se puede deducir con fiabilidad que queria hacer el
 * alumno. 'x^2-1' puede ser factorizacion, productos notables o simple
 * evaluacion, y las tres se escriben igual. Por eso:
 *
 *   - El area es SOLO una pista para la interfaz y las metricas.
 *   - El router NO la usa para decidir el nivel. Enruta con los rasgos.
 *   - Cuando no hay senal clara devuelve 'desconocida', que es mas honesto que
 *     inventar una etiqueta que luego alguien tome por buena.
 *
 * Las areas que dependen de la intencion (terminos-semejantes, distributiva,
 * productos-notables, factorizacion) solo se emiten cuando la operacion pedida
 * las delata, no adivinando.
 */

import type { Area } from '../bateria/tipos.js';
import type { Operacion, Rasgos } from './tipos.js';

const TRIGONOMETRICAS: ReadonlyArray<string> = [
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'asin', 'acos', 'atan', 'atan2', 'acsc', 'asec', 'acot',
  'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth',
  'asinh', 'acosh', 'atanh',
];

const LOGARITMICAS: ReadonlyArray<string> = [
  'log', 'ln', 'log10', 'log2', 'log1p', 'exp', 'expm1',
];

function alguna(nombres: ReadonlyArray<string>, familia: ReadonlyArray<string>): boolean {
  const set = new Set<string>(familia);
  for (let i = 0; i < nombres.length; i += 1) {
    if (set.has(nombres[i])) return true;
  }
  return false;
}

export function clasificarArea(
  rasgos: Rasgos,
  operacion: Exclude<Operacion, 'auto'>,
): Area | 'desconocida' {
  if (!rasgos.entradaValida) return 'desconocida';

  // Lo que se reconoce por la funcion que aparece, sin ambiguedad.
  if (alguna(rasgos.trascendentes, TRIGONOMETRICAS)) return 'trigonometria';
  if (alguna(rasgos.trascendentes, LOGARITMICAS)) return 'logaritmos';
  if (rasgos.tieneRadicales) return 'radicales';

  // Ecuaciones: el grado de la forma anulada las separa sin lugar a dudas.
  if (rasgos.esEcuacion) {
    if (rasgos.grado === 1) return 'ecuaciones-lineales';
    if (rasgos.grado === 2) return 'cuadraticas';
    return 'desconocida';
  }

  // Lo que delata la operacion pedida, no la forma de la expresion.
  if (operacion === 'factorizar') return 'factorizacion';
  if (operacion === 'expandir') return 'distributiva';

  // Sin variables es cuenta: con division es fracciones, sin ella aritmetica.
  if (rasgos.variables.length === 0) {
    return rasgos.tieneDivision ? 'fracciones' : 'aritmetica';
  }

  // Con variables y sin mas senal no se adivina. Ver el aviso de arriba.
  return 'desconocida';
}
