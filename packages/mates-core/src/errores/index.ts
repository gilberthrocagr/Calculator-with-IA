/**
 * Catalogo de errores tipicos y su deteccion simbolica, sin LLM.
 *
 * Es el primero de los tres guardarrailes que, medidos en PNAS 2025, eliminaron
 * el dano al aprendizaje: solucion verificada, pistas incrementales y catalogo
 * de errores tipicos. Los otros dos son de la fase 5.
 */
export * from './tipos.js';
export { CATALOGO, entradaDe, erroresDelArea } from './catalogo.js';
export { crearDiagnosticador, diagnosticar } from './diagnostico.js';
export type { Diagnosticador } from './diagnostico.js';
