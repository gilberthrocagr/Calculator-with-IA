/**
 * Verificador de pasos en tres capas.
 *
 *   Capa 1  normalizacion de cadena          barata, descarta no-cambios
 *   Capa 2  rationalize(a-b), numerador = 0  exacta en polinomios y racionales
 *   Capa 3  muestreo en el plano complejo    lo que las otras dos no alcanzan
 *
 * Se para en la primera capa que se pronuncie. Todo JavaScript, sin nada nativo,
 * compatible con Hermes.
 */

import { formaCanonicaAST, normalizarTexto } from './normalizar.js';
import { compararPorRacionalizacion } from './racional.js';
import { compararPorMuestreo, aComplejo, crearAleatorio } from './muestreo.js';
import { variablesDeAmbos } from './variables.js';
import { cargarMath } from './math.js';
import type { InstanciaMath, NodoMath } from './math.js';
import { OPCIONES_POR_DEFECTO } from './tipos.js';
import type { OpcionesVerificador, ResultadoVerificacion } from './tipos.js';

export * from './tipos.js';
export { cargarMath, fijarMath } from './math.js';
export type { InstanciaMath, NodoMath, Complejo } from './math.js';
export { variablesLibres, variablesDeAmbos, nombresDeFuncion } from './variables.js';
export { normalizarTexto } from './normalizar.js';

const COMPARADORES = ['<=', '>=', '!=', '==', '<', '>'];

/** Separa 'a = b' en sus dos lados. Devuelve null si no es una ecuacion. */
export function partirEcuacion(texto: string): { izq: string; der: string } | null {
  for (let i = 0; i < COMPARADORES.length; i += 1) {
    if (texto.indexOf(COMPARADORES[i]) !== -1) return null; // desigualdad: otro problema
  }
  const partes = texto.split('=');
  if (partes.length !== 2) return null;
  if (partes[0].trim().length === 0 || partes[1].trim().length === 0) return null;
  return { izq: partes[0], der: partes[1] };
}

/** ¿Lleva un comparador de desigualdad? Las desigualdades quedan fuera de la fase 1. */
export function esDesigualdad(texto: string): boolean {
  for (let i = 0; i < COMPARADORES.length; i += 1) {
    if (texto.indexOf(COMPARADORES[i]) !== -1) return true;
  }
  return false;
}

function completarOpciones(o?: OpcionesVerificador): Required<OpcionesVerificador> {
  return {
    puntosMuestreo: o?.puntosMuestreo ?? OPCIONES_POR_DEFECTO.puntosMuestreo,
    minimoPuntosValidos: o?.minimoPuntosValidos ?? OPCIONES_POR_DEFECTO.minimoPuntosValidos,
    toleranciaRelativa: o?.toleranciaRelativa ?? OPCIONES_POR_DEFECTO.toleranciaRelativa,
    toleranciaAbsoluta: o?.toleranciaAbsoluta ?? OPCIONES_POR_DEFECTO.toleranciaAbsoluta,
    semilla: o?.semilla ?? OPCIONES_POR_DEFECTO.semilla,
  };
}

export interface Verificador {
  verificarPaso: (antes: string, despues: string, opciones?: OpcionesVerificador) => ResultadoVerificacion;
}

export function crearVerificador(math: InstanciaMath): Verificador {
  /** Verifica un paso entre dos EXPRESIONES (sin '='). */
  function verificarExpresiones(
    textoA: string,
    textoB: string,
    op: Required<OpcionesVerificador>,
  ): ResultadoVerificacion {
    // ---- Capa 1 -----------------------------------------------------------
    const normA = normalizarTexto(textoA);
    const normB = normalizarTexto(textoB);
    if (normA === normB) {
      return {
        veredicto: 'EQUIVALENTE',
        capa: 1,
        motivo: 'las dos cadenas normalizan igual',
        sinCambio: true,
      };
    }

    const parsear = (s: string) => math.parse(s);
    const astA = formaCanonicaAST(normA, parsear);
    const astB = formaCanonicaAST(normB, parsear);

    if (astA === null || astB === null) {
      return {
        veredicto: 'INDETERMINADO',
        capa: null,
        motivo: 'no se pudo parsear ' + (astA === null ? 'el lado izquierdo' : 'el lado derecho'),
      };
    }
    if (astA === astB) {
      return {
        veredicto: 'EQUIVALENTE',
        capa: 1,
        motivo: 'mismo arbol sintactico tras canonizar',
        sinCambio: true,
      };
    }

    // ---- Capa 2 -----------------------------------------------------------
    const capa2 = compararPorRacionalizacion(math, normA, normB);
    if (capa2.concluye && capa2.veredicto !== undefined) {
      return { veredicto: capa2.veredicto, capa: 2, motivo: capa2.motivo };
    }

    // ---- Capa 3 -----------------------------------------------------------
    let nodoA: NodoMath;
    let nodoB: NodoMath;
    try {
      nodoA = math.parse(normA);
      nodoB = math.parse(normB);
    } catch (e) {
      return {
        veredicto: 'INDETERMINADO',
        capa: null,
        motivo: 'no se pudo parsear para muestrear: ' + (e instanceof Error ? e.message.split('\n')[0] : String(e)),
      };
    }
    return compararPorMuestreo(math, nodoA, nodoB, op);
  }

  /**
   * Verifica un paso entre dos ECUACIONES.
   *
   * Dos ecuaciones L=R y L'=R' representan lo mismo cuando sus formas anuladas
   * dA = L-R y dB = L'-R' son proporcionales por una constante no nula:
   *
   *     2x+5 = 13   ->   dA = 2x-8
   *     x    = 4    ->   dB = x-4        dA/dB = 2, constante  ->  EQUIVALENTE
   *     2x   = 18   ->   dB = 2x-18      dA/dB depende de x    ->  NO_EQUIVALENTE
   *
   * Esto cubre exactamente las operaciones del nivel 1 (mover terminos, dividir
   * entre el coeficiente). Las transformaciones NO lineales de ambos lados
   * (elevar al cuadrado, tomar logaritmo) no dan razon constante y ademas pueden
   * introducir raices extranas: no son de esta capa, van al nivel 3 con SymPy.
   */
  function verificarEcuaciones(
    a: { izq: string; der: string },
    b: { izq: string; der: string },
    op: Required<OpcionesVerificador>,
  ): ResultadoVerificacion {
    const dA = '(' + normalizarTexto(a.izq) + ')-(' + normalizarTexto(a.der) + ')';
    const dB = '(' + normalizarTexto(b.izq) + ')-(' + normalizarTexto(b.der) + ')';

    // Caso facil: las formas anuladas son la misma expresion (mover terminos).
    const directo = verificarExpresiones(dA, dB, op);
    if (directo.veredicto === 'EQUIVALENTE') {
      return { ...directo, motivo: 'formas anuladas identicas: ' + directo.motivo, sinCambio: undefined };
    }

    // Caso general: ¿es dA/dB una constante no nula?
    let nodoA: NodoMath;
    let nodoB: NodoMath;
    try {
      nodoA = math.parse(dA);
      nodoB = math.parse(dB);
    } catch (e) {
      return {
        veredicto: 'INDETERMINADO',
        capa: null,
        motivo: 'no se pudo parsear la ecuacion: ' + (e instanceof Error ? e.message.split('\n')[0] : String(e)),
      };
    }

    const variables = variablesDeAmbos(nodoA, nodoB);
    const rnd = crearAleatorio(op.semilla);

    let validos = 0;
    let razonRe = 0;
    let razonIm = 0;
    let primera = true;
    let constante = true;

    for (let intento = 0; intento < op.puntosMuestreo; intento += 1) {
      const scope: Record<string, unknown> = {};
      for (let v = 0; v < variables.length; v += 1) {
        let val = 0.3 + rnd() * 3.4;
        if (Math.abs(val - 1) < 0.08) val += 0.23;
        scope[variables[v]] = val;
      }
      let cA: unknown;
      let cB: unknown;
      try {
        cA = nodoA.evaluate(scope);
        cB = nodoB.evaluate(scope);
      } catch {
        continue;
      }
      const vA = aComplejo(cA);
      const vB = aComplejo(cB);
      if (vA === null || vB === null) continue;

      const magB = Math.sqrt(vB.re * vB.re + vB.im * vB.im);
      if (magB < 1e-12) continue; // cerca de la raiz: la razon no esta definida

      // razon = vA / vB en complejos
      const den = vB.re * vB.re + vB.im * vB.im;
      const re = (vA.re * vB.re + vA.im * vB.im) / den;
      const im = (vA.im * vB.re - vA.re * vB.im) / den;

      validos += 1;
      if (primera) {
        razonRe = re;
        razonIm = im;
        primera = false;
      } else {
        const d = Math.sqrt((re - razonRe) * (re - razonRe) + (im - razonIm) * (im - razonIm));
        const escala = Math.max(Math.sqrt(re * re + im * im), Math.sqrt(razonRe * razonRe + razonIm * razonIm), 1);
        if (d / escala > 1e-8) constante = false;
      }
    }

    if (validos < Math.min(op.minimoPuntosValidos, op.puntosMuestreo)) {
      return {
        veredicto: 'INDETERMINADO',
        capa: 3,
        motivo: 'pocos puntos evaluables para comparar las ecuaciones (' + String(validos) + ')',
        puntosValidos: validos,
        puntosIntentados: op.puntosMuestreo,
      };
    }

    const magRazon = Math.sqrt(razonRe * razonRe + razonIm * razonIm);
    if (constante && magRazon > 1e-12) {
      return {
        veredicto: 'EQUIVALENTE',
        capa: 3,
        motivo: 'las formas anuladas son proporcionales (razon ' + String(Number(razonRe.toPrecision(6))) + ')',
        puntosValidos: validos,
        puntosIntentados: op.puntosMuestreo,
      };
    }

    return {
      veredicto: 'NO_EQUIVALENTE',
      capa: 3,
      motivo: 'las formas anuladas no son proporcionales: las dos ecuaciones no tienen las mismas soluciones',
      puntosValidos: validos,
      puntosIntentados: op.puntosMuestreo,
    };
  }

  function verificarPaso(
    antes: string,
    despues: string,
    opciones?: OpcionesVerificador,
  ): ResultadoVerificacion {
    const op = completarOpciones(opciones);

    if (esDesigualdad(antes) || esDesigualdad(despues)) {
      return {
        veredicto: 'INDETERMINADO',
        capa: null,
        motivo: 'las desigualdades no son de la fase 1: van al nivel 3 (SymPy)',
      };
    }

    const ecA = partirEcuacion(antes);
    const ecB = partirEcuacion(despues);

    if (ecA !== null && ecB !== null) return verificarEcuaciones(ecA, ecB, op);
    if (ecA !== null || ecB !== null) {
      return {
        veredicto: 'INDETERMINADO',
        capa: null,
        motivo: 'un lado es ecuacion y el otro expresion: no son comparables',
      };
    }
    return verificarExpresiones(antes, despues, op);
  }

  return { verificarPaso };
}

/** Version comoda: carga mathjs bajo demanda la primera vez. */
export async function verificarPaso(
  antes: string,
  despues: string,
  opciones?: OpcionesVerificador,
): Promise<ResultadoVerificacion> {
  const math = await cargarMath();
  return crearVerificador(math).verificarPaso(antes, despues, opciones);
}
