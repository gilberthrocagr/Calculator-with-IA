/**
 * El diagnostico: compara lo que escribio el alumno con lo que habria escrito
 * si hubiera cometido cada error del catalogo.
 *
 * La comparacion la hace el VERIFICADOR, no una igualdad de cadenas: asi
 * '2x+3' y '3+2*x' cuentan como el mismo error, que es lo que hace falta. Y
 * como el verificador esta al 100% sobre 271 casos, un diagnostico afirmado
 * aqui hereda esa fiabilidad.
 */

import type { InstanciaMath, NodoMath } from '../verificador/math.js';
import { cargarMath } from '../verificador/math.js';
import { crearVerificador, partirEcuacion } from '../verificador/index.js';
import { normalizarTexto } from '../verificador/normalizar.js';
import { variablesLibres } from '../verificador/variables.js';
import { entradaDe } from './catalogo.js';
import type { ContraejemploNumerico, Diagnostico, ErrorDetectado, TipoError } from './tipos.js';
import {
  predecirLinealidadIlusoria,
  predecirDistribucionParcial,
  predecirSignoAlDistribuir,
  predecirCancelacionIlegal,
  predecirTerminosNoSemejantes,
  predecirSumaDeFracciones,
  predecirExponentesSumados,
  predecirCoeficientesMultiplicados,
  predecirReglasDeExponentes,
  predecirOperacionDeFracciones,
  predecirTransposicion,
  predecirBalanceRoto,
} from './patrones.js';

interface Nodo extends NodoMath {
  isParenthesisNode?: boolean;
  content?: unknown;
}

/**
 * Numeros que rompen la creencia del alumno, para el contraejemplo.
 * Se eligen pequenos, enteros y distintos entre si: '3 y 4' convence,
 * '0,7412 y 1,9985' no convence a nadie.
 */
const VALORES_CONTRAEJEMPLO = [3, 4, 2, 5, 6, 7];

function construirContraejemplo(
  math: InstanciaMath,
  antes: string,
  despues: string,
): ContraejemploNumerico | undefined {
  let nodoA: Nodo;
  let nodoB: Nodo;
  try {
    nodoA = math.parse(normalizarTexto(antes)) as Nodo;
    nodoB = math.parse(normalizarTexto(despues)) as Nodo;
  } catch {
    return undefined;
  }

  const vars = variablesLibres(nodoA);
  const escenario: Record<string, number> = {};
  for (let i = 0; i < vars.length; i += 1) {
    escenario[vars[i]] = VALORES_CONTRAEJEMPLO[i % VALORES_CONTRAEJEMPLO.length];
  }

  try {
    const vA = nodoA.evaluate({ ...escenario });
    const vB = nodoB.evaluate({ ...escenario });
    if (typeof vA !== 'number' || typeof vB !== 'number') return undefined;
    if (!Number.isFinite(vA) || !Number.isFinite(vB)) return undefined;
    // Si en este punto coinciden, no sirve de contraejemplo: no ensena nada.
    if (Math.abs(vA - vB) < 1e-9) return undefined;
    return { escenario, valorCorrecto: vA, valorDelAlumno: vB };
  } catch {
    return undefined;
  }
}

type Predictor = (n: Nodo, math: InstanciaMath) => string[];

const PREDICTORES: Array<{ tipo: TipoError; predecir: Predictor }> = [
  { tipo: 'linealidad-ilusoria', predecir: (n) => predecirLinealidadIlusoria(n) },
  { tipo: 'signo-al-distribuir', predecir: (n, m) => predecirSignoAlDistribuir(n, m) },
  { tipo: 'distribucion-parcial', predecir: (n, m) => predecirDistribucionParcial(n, m) },
  { tipo: 'cancelacion-ilegal', predecir: (n, m) => predecirCancelacionIlegal(n, m) },
  { tipo: 'suma-de-fracciones', predecir: (n) => predecirSumaDeFracciones(n) },
  { tipo: 'exponentes-sumados', predecir: (n, m) => predecirExponentesSumados(n, m) },
  { tipo: 'coeficientes-multiplicados', predecir: (n) => predecirCoeficientesMultiplicados(n) },
  { tipo: 'terminos-no-semejantes', predecir: (n) => predecirTerminosNoSemejantes(n) },
  { tipo: 'operacion-de-fracciones', predecir: (n, m) => predecirOperacionDeFracciones(n, m) },
  { tipo: 'reglas-de-exponentes', predecir: (n, m) => predecirReglasDeExponentes(n, m) },
];

/**
 * Predictores de ECUACIONES. Van aparte porque una ecuacion no se parsea como
 * una expresion: mathjs lee el '=' como una asignacion y lanza. Hay que partirla
 * primero con partirEcuacion, que es lo que ya hace el verificador.
 */
const PREDICTORES_ECUACION: Array<{
  tipo: TipoError;
  predecir: (izq: string, der: string, math: InstanciaMath) => string[];
}> = [
  { tipo: 'transposicion-sin-signo', predecir: predecirTransposicion },
  { tipo: 'balance-roto', predecir: predecirBalanceRoto },
];

export interface Diagnosticador {
  diagnosticar: (antes: string, despues: string) => Diagnostico;
}

export function crearDiagnosticador(math: InstanciaMath): Diagnosticador {
  const v = crearVerificador(math);

  function diagnosticar(antes: string, despues: string): Diagnostico {
    const paso = v.verificarPaso(antes, despues);

    // Un paso correcto no se diagnostica. Y uno que no se pudo verificar
    // tampoco: sin saber si hay error, buscarle nombre seria inventar.
    if (paso.veredicto === 'EQUIVALENTE') {
      return { hayError: false, errores: [], motivo: 'el paso es correcto' };
    }
    if (paso.veredicto === 'INDETERMINADO') {
      return {
        hayError: false,
        errores: [],
        motivo: 'el verificador no pudo pronunciarse: no se diagnostica nada',
      };
    }

    // ¿Ecuacion o expresion? Cada una tiene su juego de patrones.
    const ec = partirEcuacion(antes);

    let nodo: Nodo | null = null;
    if (ec === null) {
      try {
        nodo = math.parse(normalizarTexto(antes)) as Nodo;
      } catch {
        return { hayError: true, errores: [], motivo: 'no se pudo parsear el punto de partida' };
      }
    }

    const tareas: Array<{ tipo: TipoError; producir: () => string[] }> =
      ec === null
        ? PREDICTORES.map((p) => ({ tipo: p.tipo, producir: () => p.predecir(nodo as Nodo, math) }))
        : PREDICTORES_ECUACION.map((p) => ({
            tipo: p.tipo,
            producir: () => p.predecir(normalizarTexto(ec.izq), normalizarTexto(ec.der), math),
          }));

    const encontrados: ErrorDetectado[] = [];
    const vistos = new Set<TipoError>();

    for (let i = 0; i < tareas.length; i += 1) {
      const { tipo, producir } = tareas[i];
      if (vistos.has(tipo)) continue;

      let predicciones: string[] = [];
      try {
        predicciones = producir();
      } catch {
        continue; // un patron que falla no debe tumbar el diagnostico
      }

      for (let j = 0; j < predicciones.length; j += 1) {
        const pred = predicciones[j];

        // Si la "equivocacion" resulta ser correcta aqui, no distingue nada.
        let esCorrecta = false;
        try {
          esCorrecta = v.verificarPaso(antes, pred).veredicto === 'EQUIVALENTE';
        } catch {
          continue;
        }
        if (esCorrecta) continue;

        let coincide = false;
        try {
          coincide = v.verificarPaso(pred, despues).veredicto === 'EQUIVALENTE';
        } catch {
          continue;
        }
        if (!coincide) continue;

        const entrada = entradaDe(tipo);
        encontrados.push({
          tipo,
          nombre: entrada.nombre,
          creencia: entrada.creencia,
          estrategia: entrada.estrategia,
          prediccion: pred,
          contraejemplo: construirContraejemplo(math, antes, despues),
        });
        vistos.add(tipo);
        break;
      }
    }

    return {
      hayError: true,
      errores: encontrados,
      motivo:
        encontrados.length > 0
          ? 'el paso coincide con ' + String(encontrados.length) + ' error(es) del catalogo'
          : 'el paso es incorrecto pero ningun patron conocido lo explica',
    };
  }

  return { diagnosticar };
}

/** Version comoda: carga mathjs bajo demanda la primera vez. */
export async function diagnosticar(antes: string, despues: string): Promise<Diagnostico> {
  const math = await cargarMath();
  return crearDiagnosticador(math).diagnosticar(antes, despues);
}
