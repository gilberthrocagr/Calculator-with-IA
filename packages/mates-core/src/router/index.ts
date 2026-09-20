/**
 * Clasificador y router (fase 3).
 *
 * Decide que motor atiende cada entrada. No ejecuta ninguno y no abre red:
 * devuelve la decision con su motivo y sus rasgos, para que sea auditable.
 */
export * from './tipos.js';
export { extraerRasgos, gradoPolinomico, gradoDelArbol } from './rasgos.js';
export { clasificarArea } from './clasificador.js';
export { crearRouter, enrutar, bloqueosDeNivel1, resolverOperacion } from './router.js';
