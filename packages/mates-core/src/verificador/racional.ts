/**
 * Capa 2: igualdad simbolica exacta sobre polinomios y funciones racionales.
 *
 * Se calcula rationalize(a - b) y se mira si el NUMERADOR es cero.
 *
 * Por que el numerador y no la cadena entera. El brief original proponia
 * `math.rationalize(a - b).toString() === '0'`. Medido en mathjs 15.2.0, eso da
 * falso negativo en cuanto hay denominadores:
 *
 *     (x+1)/(x^2-1)  vs  1/(x-1)   ->  "0 / (x ^ 3 - x ^ 2 - x + 1)"   != "0"
 *     (x^2-1)/(x-1)  vs  x+1       ->  "0 / (x - 1)"                   != "0"
 *
 * Son equivalencias buenas que se rechazarian. Tomando el numerador y
 * simplificandolo, los cinco casos de prueba salen bien.
 *
 * NO se usa math.symbolicEqual: esta roto para esto. Comprobado en 15.2.0,
 * devuelve false para ('(x+1)^2', 'x^2+2*x+1') y para
 * ('sin(x)^2+cos(x)^2', '1').
 *
 * rationalize LANZA ("There is an unsolved function call") con trigonometria,
 * logaritmos y radicales simbolicos. Eso no es un error: es esta capa diciendo
 * "no es lo mio". Se captura y se deja pasar a la capa 3.
 */

import type { InstanciaMath, NodoMath } from './math.js';

export interface ResultadoCapa2 {
  /** true si la capa se pronuncia; false si cede el turno a la capa 3. */
  concluye: boolean;
  veredicto?: 'EQUIVALENTE' | 'NO_EQUIVALENTE';
  motivo: string;
}

/** Si el nodo es una division, devuelve su numerador; si no, el nodo tal cual. */
function numeradorDe(nodo: NodoMath): NodoMath {
  const esDivision =
    nodo.isOperatorNode === true &&
    (nodo.op === '/' || nodo.fn === 'divide') &&
    Array.isArray(nodo.args) &&
    nodo.args.length === 2;
  return esDivision ? (nodo.args as NodoMath[])[0] : nodo;
}

/**
 * Magnitud de referencia de las dos expresiones, para saber que cuenta como "cero".
 * Si no se pueden evaluar (llevan variables) se devuelve 1, que es la escala neutra.
 */
function magnitudDeReferencia(math: InstanciaMath, textoA: string, textoB: string): number {
  let mayor = 0;
  const lados = [textoA, textoB];
  for (let i = 0; i < lados.length; i += 1) {
    try {
      const v = math.parse(lados[i]).evaluate({});
      const n = typeof v === 'number' ? v
        : (v !== null && typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function')
          ? (v as { toNumber: () => number }).toNumber()
          : NaN;
      if (isFinite(n)) mayor = Math.max(mayor, Math.abs(n));
    } catch {
      /* lleva variables: no aporta escala */
    }
  }
  return mayor > 0 ? mayor : 1;
}

/** Devuelve el valor numerico del nodo si es una constante, o null. */
function comoConstante(math: InstanciaMath, nodo: NodoMath): number | null {
  try {
    const v = nodo.evaluate({});
    if (typeof v === 'number' && isFinite(v)) return v;
    if (v !== null && typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
      const n = (v as { toNumber: () => number }).toNumber();
      return isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function compararPorRacionalizacion(
  math: InstanciaMath,
  textoA: string,
  textoB: string,
): ResultadoCapa2 {
  let racionalizado: NodoMath;
  try {
    racionalizado = math.rationalize('(' + textoA + ')-(' + textoB + ')') as NodoMath;
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    return { concluye: false, motivo: 'rationalize no aplica (' + msg + ')' };
  }

  const numerador = numeradorDe(racionalizado);

  let simplificado: string;
  try {
    simplificado = math.simplify(numerador).toString().replace(/\s+/g, '');
  } catch {
    simplificado = numerador.toString().replace(/\s+/g, '');
  }

  if (simplificado === '0' || simplificado === '-0') {
    return {
      concluye: true,
      veredicto: 'EQUIVALENTE',
      motivo: 'rationalize(a-b) tiene numerador nulo: igualdad exacta',
    };
  }

  // Un numerador constante y no nulo no puede anularse nunca: conclusion segura...
  // ...pero SOLO si es no nulo de verdad, y eso en coma flotante no es 'c !== 0'.
  //
  // COSTO MEDIDO: rationalize evalua en double. Para '(2/4+1/3)-(10/12)', que es
  // exactamente 0, devuelve -1.1102230246251565e-16. Con la comparacion ingenua
  // 'c !== 0' el verificador declaraba NO_EQUIVALENTE una igualdad perfecta, que
  // es justo el error que no nos podemos permitir: acusar a un alumno que acerto.
  //
  // Se compara contra la escala de las propias expresiones. Si el residuo cae en
  // el ruido, esta capa NO concluye y le cede el turno a la capa 3, que compara
  // con tolerancia en condiciones.
  const constante = comoConstante(math, numerador);
  if (constante !== null) {
    const umbral = magnitudDeReferencia(math, textoA, textoB) * 1e-12;
    if (Math.abs(constante) <= umbral) {
      return {
        concluye: false,
        motivo: 'residuo ' + String(constante) + ' dentro del ruido de coma flotante: decide la capa 3',
      };
    }
    return {
      concluye: true,
      veredicto: 'NO_EQUIVALENTE',
      motivo: 'rationalize(a-b) deja la constante no nula ' + String(constante),
    };
  }

  // Numerador polinomico no nulo: casi seguro que difieren, pero se lo dejamos a la
  // capa 3 para poder ensenarle al alumno un contraejemplo concreto en vez de un
  // polinomio. Tambien cubre el caso de un simplify incompleto.
  return {
    concluye: false,
    motivo: 'numerador no nulo ("' + simplificado + '"): se confirma por muestreo',
  };
}
