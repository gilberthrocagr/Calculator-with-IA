import type { CasoBateria } from './tipos.js';
import { ARITMETICA, FRACCIONES } from './aritmetica.js';
import { TERMINOS_SEMEJANTES, DISTRIBUTIVA, PRODUCTOS_NOTABLES, FACTORIZACION } from './algebra.js';
import { ECUACIONES_LINEALES, CUADRATICAS } from './ecuaciones.js';
import { EXPONENTES, RADICALES, LOGARITMOS, TRIGONOMETRIA } from './precalculo.js';

export * from './tipos.js';

/** Bateria completa del curriculo. La fase 2 no empieza hasta que esto pase al 100%. */
export const BATERIA: CasoBateria[] = [
  ...ARITMETICA,
  ...FRACCIONES,
  ...TERMINOS_SEMEJANTES,
  ...DISTRIBUTIVA,
  ...PRODUCTOS_NOTABLES,
  ...FACTORIZACION,
  ...ECUACIONES_LINEALES,
  ...CUADRATICAS,
  ...EXPONENTES,
  ...RADICALES,
  ...LOGARITMOS,
  ...TRIGONOMETRIA,
];

export {
  ARITMETICA, FRACCIONES, TERMINOS_SEMEJANTES, DISTRIBUTIVA,
  PRODUCTOS_NOTABLES, FACTORIZACION, ECUACIONES_LINEALES, CUADRATICAS,
  EXPONENTES, RADICALES, LOGARITMOS, TRIGONOMETRIA,
};
