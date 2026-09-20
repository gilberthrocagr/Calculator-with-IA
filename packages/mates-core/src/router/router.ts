/**
 * Router: decide a que nivel del motor va una entrada.
 *
 *   Nivel 1  mathsteps-experimental-fork  offline, pasos con nombre de regla
 *   Nivel 2  nerdamer-prime               offline, factorizacion y cuadraticas
 *   Nivel 3  SymPy en servidor            lo que los otros dos no pueden
 *
 * El router NO ejecuta nada y NO abre red: devuelve la decision y se aparta.
 * Asi la bateria de enrutado corre en CI en milisegundos, sin motores ni
 * servidor, igual que la del verificador.
 *
 * LA REGLA QUE JUSTIFICA ESTE MODULO, medida en la fase 0:
 * mathsteps NO lanza con trigonometria. `solveEquation('sin(x) = 1/2')` devuelve
 * 3 pasos y la ecuacion sin tocar. El alumno veria "3 pasos" que no llevan a
 * ninguna parte, sin un solo error en el log. Por eso las trascendentes se
 * bloquean ANTES del nivel 1, no solo antes de nerdamer.
 * Ver docs/fase-0-pruebas-de-riesgo.md, seccion (c).
 */

import type { InstanciaMath } from '../verificador/math.js';
import { cargarMath } from '../verificador/math.js';
import { extraerRasgos } from './rasgos.js';
import { clasificarArea } from './clasificador.js';
import type { Decision, Nivel, Operacion, Rasgos } from './tipos.js';

/** 'auto' se resuelve por la forma: si hay comparador se resuelve, si no se simplifica. */
export function resolverOperacion(
  operacion: Operacion,
  rasgos: Rasgos,
): Exclude<Operacion, 'auto'> {
  if (operacion !== 'auto') return operacion;
  if (rasgos.esEcuacion || rasgos.esDesigualdad) return 'resolver';
  return 'simplificar';
}

/**
 * Por que esta entrada no puede ir al nivel 1. Lista vacia = podria.
 *
 * Se devuelve la lista entera y no el primer motivo: en el log de una sesion
 * real interesa ver todo lo que descarto el nivel 1, no solo lo primero que
 * salto. Es lo que permitira medir despues cuanto trabajo se va al servidor.
 */
export function bloqueosDeNivel1(
  rasgos: Rasgos,
  operacion: Exclude<Operacion, 'auto'>,
): string[] {
  const bloqueos: string[] = [];

  if (!rasgos.entradaValida) {
    bloqueos.push('la entrada no se pudo parsear');
    return bloqueos;
  }

  if (rasgos.esDesigualdad) {
    bloqueos.push('es una desigualdad y el nivel 1 no las trata');
  }

  if (rasgos.trascendentes.length > 0) {
    bloqueos.push(
      'funciones trascendentes (' + rasgos.trascendentes.join(', ') +
      '): mathsteps no lanza, devuelve la expresion sin tocar',
    );
  }

  if (rasgos.tieneRadicales) {
    bloqueos.push('hay radicales y el nivel 1 no los maneja con fiabilidad');
  }

  if (rasgos.tieneVariableEnDenominador) {
    bloqueos.push('hay variable en el denominador: es una funcion racional');
  }

  if (operacion === 'factorizar') {
    bloqueos.push('mathsteps simplifica y resuelve, pero no factoriza');
  }

  if (operacion === 'resolver') {
    if (!rasgos.esEcuacion && !rasgos.esDesigualdad) {
      bloqueos.push('se pidio resolver pero no hay ecuacion');
    } else if (!rasgos.esDesigualdad) {
      if (rasgos.variables.length !== 1) {
        bloqueos.push(
          'resolver en el nivel 1 necesita exactamente una variable, y hay ' +
          String(rasgos.variables.length),
        );
      }
      if (rasgos.grado === null) {
        bloqueos.push('la ecuacion no es polinomica');
      } else if (rasgos.grado !== 1) {
        bloqueos.push('el nivel 1 solo resuelve lineales, y el grado es ' + String(rasgos.grado));
      }
    }
  }

  return bloqueos;
}

/** Cuando el nivel 1 queda descartado, ¿nivel 2 offline o nivel 3 en servidor? */
function elegirNivelSuperior(
  rasgos: Rasgos,
  operacion: Exclude<Operacion, 'auto'>,
): { nivel: Nivel; motivo: string } {
  if (!rasgos.entradaValida) {
    return {
      nivel: 3,
      motivo: 'mathjs no pudo parsear la entrada: al servidor, que parsea mas formas',
    };
  }

  if (rasgos.esDesigualdad) {
    return { nivel: 3, motivo: 'las desigualdades se resuelven con SymPy' };
  }

  // Las trascendentes se van al servidor: nerdamer tampoco da pasos didacticos
  // con ellas, y era el bloqueo que ya existia antes de la fase 0.
  if (rasgos.trascendentes.length > 0) {
    return {
      nivel: 3,
      motivo: 'trascendentes (' + rasgos.trascendentes.join(', ') + '): ni nivel 1 ni nivel 2',
    };
  }

  if (operacion === 'resolver') {
    if (rasgos.variables.length === 1 && rasgos.grado === 2) {
      return { nivel: 2, motivo: 'ecuacion cuadratica de una variable: nerdamer' };
    }
    return {
      nivel: 3,
      motivo:
        'ecuacion fuera del alcance offline (variables: ' + String(rasgos.variables.length) +
        ', grado: ' + String(rasgos.grado) + ')',
    };
  }

  if (operacion === 'factorizar') {
    if (rasgos.grado !== null && rasgos.variables.length >= 1) {
      return { nivel: 2, motivo: 'factorizacion de un polinomio: nerdamer' };
    }
    return { nivel: 3, motivo: 'factorizar algo que no es polinomico: al servidor' };
  }

  // simplificar y expandir
  if (rasgos.tieneRadicales) {
    return { nivel: 2, motivo: 'hay radicales: nerdamer los simplifica' };
  }
  if (rasgos.tieneVariableEnDenominador) {
    return { nivel: 2, motivo: 'funcion racional: nerdamer' };
  }
  if (rasgos.grado !== null) {
    return { nivel: 2, motivo: 'polinomica pero fuera del nivel 1: nerdamer' };
  }
  return { nivel: 3, motivo: 'no es polinomica ni racional reconocible: al servidor' };
}

/** Decide el nivel. Version sincrona, con la instancia de mathjs ya cargada. */
export function crearRouter(math: InstanciaMath): {
  enrutar: (entrada: string, operacion?: Operacion) => Decision;
} {
  function enrutar(entrada: string, operacion: Operacion = 'auto'): Decision {
    const rasgos = extraerRasgos(math, entrada);
    const op = resolverOperacion(operacion, rasgos);
    const bloqueos = bloqueosDeNivel1(rasgos, op);
    const area = clasificarArea(rasgos, op);

    if (bloqueos.length === 0) {
      return {
        nivel: 1,
        operacion: op,
        motivo: 'sin bloqueos: mathsteps da los pasos con nombre de regla, offline',
        bloqueosDeNivel1: bloqueos,
        rasgos,
        area,
      };
    }

    const superior = elegirNivelSuperior(rasgos, op);
    return {
      nivel: superior.nivel,
      operacion: op,
      motivo: superior.motivo,
      bloqueosDeNivel1: bloqueos,
      rasgos,
      area,
    };
  }

  return { enrutar };
}

/** Version comoda: carga mathjs bajo demanda la primera vez. */
export async function enrutar(entrada: string, operacion: Operacion = 'auto'): Promise<Decision> {
  const math = await cargarMath();
  return crearRouter(math).enrutar(entrada, operacion);
}
