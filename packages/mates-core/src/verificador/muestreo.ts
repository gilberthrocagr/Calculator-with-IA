/**
 * Capa 3: muestreo numerico.
 *
 * Se evaluan las dos expresiones en puntos al azar del dominio positivo y se
 * comparan los resultados en el plano complejo (el resultado puede salirse de
 * los reales aunque la entrada sea positiva).
 *
 * TRES DECISIONES DE SEGURIDAD, en orden de importancia:
 *
 * 1. Si hay pocos puntos evaluables el veredicto es INDETERMINADO, jamas
 *    NO_EQUIVALENTE. A un alumno no se le dice que se equivoco porque a nosotros
 *    nos falto muestra.
 *
 * 2. Un unico desacuerdo pequeno (dentro de 1e-9..1e-6 relativo) tampoco basta:
 *    huele a cancelacion catastrofica, no a error del alumno. Para afirmar
 *    NO_EQUIVALENTE hace falta o un desacuerdo grande, o dos puntos que discrepen.
 *
 * 3. Un punto solo cuenta si evaluan AMBOS lados. Si uno lanza por dominio y el
 *    otro no, el punto se descarta en vez de tomarse como diferencia.
 *
 * DOMINIO POSITIVO, y lo que eso cuesta. Muestrear solo en positivos garantiza
 * que sqrt y log esten definidos, que es lo que da el 100% de puntos validos en
 * el temario real. El precio es que esta capa NO detecta errores de signo del
 * tipo sqrt(x^2) -> x (validos en positivos, falsos en general). Esos tienen que
 * cazarse en el nivel 1 por regla, no aqui. Con dominio 'mixto' si se detectan,
 * pero entonces log(x^2) -> 2*log(x) se marca como error, y en precalculo ese
 * paso se ensena como bueno. Por eso 'positivo' es el de fabrica.
 */

import type { Complejo, InstanciaMath, NodoMath } from './math.js';
import { variablesDeAmbos } from './variables.js';
import type { Contraejemplo, OpcionesVerificador, ResultadoVerificacion } from './tipos.js';
import { OPCIONES_POR_DEFECTO } from './tipos.js';

/** Umbral por encima del cual un desacuerdo se considera inequivoco. */
const DESACUERDO_ROTUNDO = 1e-6;

/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Con semilla fija el veredicto es reproducible, que es lo que hace falta en CI:
 * un verificador que cambia de opinion entre corridas no se puede auditar.
 */
export function crearAleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return function siguiente(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Valor de muestreo: real positivo en [0.3, 3.7], apartado de 0 y de 1.
 * En x=1 todas las potencias valen lo mismo y x^2 vs x^3 pareceria equivalente;
 * cerca de 0 se disparan los problemas de condicionamiento.
 */
function valorPositivo(rnd: () => number): number {
  let v = 0.3 + rnd() * 3.4;
  if (Math.abs(v - 1) < 0.08) v += 0.23;
  return v;
}

/** Convierte lo que devuelva mathjs a un complejo, o null si no es un numero utilizable. */
export function aComplejo(v: unknown): Complejo | null {
  if (typeof v === 'number') {
    return isFinite(v) ? { re: v, im: 0 } : null;
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as { re?: unknown; im?: unknown; toNumber?: unknown; valueOf?: unknown };
    if (typeof o.re === 'number' && typeof o.im === 'number') {
      return isFinite(o.re) && isFinite(o.im) ? { re: o.re, im: o.im } : null;
    }
    if (typeof o.toNumber === 'function') {
      const n = (o.toNumber as () => number)();
      return typeof n === 'number' && isFinite(n) ? { re: n, im: 0 } : null;
    }
    if (typeof o.valueOf === 'function') {
      const n = (o.valueOf as () => unknown)();
      if (typeof n === 'number' && isFinite(n)) return { re: n, im: 0 };
    }
  }
  return null;
}

/** Distancia relativa entre dos complejos, escalada por la magnitud mayor. */
export function distanciaRelativa(a: Complejo, b: Complejo): number {
  const dr = a.re - b.re;
  const di = a.im - b.im;
  const dist = Math.sqrt(dr * dr + di * di);
  const magA = Math.sqrt(a.re * a.re + a.im * a.im);
  const magB = Math.sqrt(b.re * b.re + b.im * b.im);
  const escala = Math.max(magA, magB);
  return escala > 0 ? dist / escala : dist;
}

function formatear(c: Complejo): string {
  if (c.im === 0) return String(Number(c.re.toPrecision(10)));
  const signo = c.im < 0 ? '-' : '+';
  return String(Number(c.re.toPrecision(10))) + signo + String(Number(Math.abs(c.im).toPrecision(10))) + 'i';
}

export function compararPorMuestreo(
  math: InstanciaMath,
  nodoA: NodoMath,
  nodoB: NodoMath,
  opciones: Required<OpcionesVerificador>,
): ResultadoVerificacion {
  const variables = variablesDeAmbos(nodoA, nodoB);
  const rnd = crearAleatorio(opciones.semilla);

  // Sin variables es aritmetica: un solo punto la decide por completo.
  const sinVariables = variables.length === 0;
  const intentos = sinVariables ? 1 : opciones.puntosMuestreo;
  const minimo = sinVariables ? 1 : opciones.minimoPuntosValidos;

  let validos = 0;
  let desacuerdos = 0;
  let desacuerdoRotundo = false;
  let primerContraejemplo: Contraejemplo | undefined;

  for (let intento = 0; intento < intentos; intento += 1) {
    const scope: Record<string, unknown> = {};
    for (let v = 0; v < variables.length; v += 1) {
      scope[variables[v]] = valorPositivo(rnd);
    }

    let crudoA: unknown;
    let crudoB: unknown;
    try {
      crudoA = nodoA.evaluate(scope);
      crudoB = nodoB.evaluate(scope);
    } catch {
      continue; // punto fuera de dominio: no cuenta ni a favor ni en contra
    }

    const valA = aComplejo(crudoA);
    const valB = aComplejo(crudoB);
    if (valA === null || valB === null) continue;

    validos += 1;

    const rel = distanciaRelativa(valA, valB);
    const abs = Math.sqrt(
      (valA.re - valB.re) * (valA.re - valB.re) + (valA.im - valB.im) * (valA.im - valB.im),
    );
    const dentroDeTolerancia =
      abs <= opciones.toleranciaAbsoluta || rel <= opciones.toleranciaRelativa;

    if (!dentroDeTolerancia) {
      desacuerdos += 1;
      if (rel > DESACUERDO_ROTUNDO) desacuerdoRotundo = true;
      if (primerContraejemplo === undefined) {
        const escenario: Record<string, string> = {};
        for (let v = 0; v < variables.length; v += 1) {
          escenario[variables[v]] = String(Number((scope[variables[v]] as number).toPrecision(6)));
        }
        primerContraejemplo = {
          escenario,
          valorA: formatear(valA),
          valorB: formatear(valB),
        };
      }
    }
  }

  if (validos < minimo) {
    return {
      veredicto: 'INDETERMINADO',
      capa: 3,
      motivo:
        'solo ' + String(validos) + ' de ' + String(intentos) +
        ' puntos resultaron evaluables (hacen falta ' + String(minimo) + ')',
      puntosValidos: validos,
      puntosIntentados: intentos,
    };
  }

  if (desacuerdos === 0) {
    return {
      veredicto: 'EQUIVALENTE',
      capa: 3,
      motivo: 'coinciden en los ' + String(validos) + ' puntos evaluados',
      puntosValidos: validos,
      puntosIntentados: intentos,
    };
  }

  // Un solo desacuerdo y ademas pequeno: mas parece cancelacion numerica que un
  // error del alumno. No se afirma nada.
  if (desacuerdos === 1 && !desacuerdoRotundo && validos > 1) {
    return {
      veredicto: 'INDETERMINADO',
      capa: 3,
      motivo: 'un unico desacuerdo marginal en ' + String(validos) + ' puntos: sospecha de cancelacion numerica',
      puntosValidos: validos,
      puntosIntentados: intentos,
      contraejemplo: primerContraejemplo,
    };
  }

  return {
    veredicto: 'NO_EQUIVALENTE',
    capa: 3,
    motivo: 'difieren en ' + String(desacuerdos) + ' de ' + String(validos) + ' puntos',
    puntosValidos: validos,
    puntosIntentados: intentos,
    contraejemplo: primerContraejemplo,
  };
}
