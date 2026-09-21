/**
 * Motor: los adaptadores de cada nivel.
 *
 * Nivel 1 mathsteps (aqui) · Nivel 2 nerdamer-prime · Nivel 3 SymPy en servidor.
 * El router decide cual toca; estos adaptadores solo ejecutan y NO se fian de
 * lo que el motor dice haber conseguido.
 */
export * from './n1.js';
