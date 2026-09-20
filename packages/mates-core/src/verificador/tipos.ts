/**
 * Tipos del verificador de pasos.
 *
 * Regla de oro: un fallo del verificador NUNCA se traduce en "te equivocaste".
 * Si no hay evidencia suficiente el veredicto es INDETERMINADO, no NO_EQUIVALENTE.
 */

/**
 * - EQUIVALENTE:     hay prueba de que el paso conserva el valor.
 * - NO_EQUIVALENTE:  hay prueba de que NO lo conserva (contraejemplo o resto no nulo).
 * - INDETERMINADO:   no hay prueba ni en un sentido ni en el otro. Al alumno se le
 *                    dice "no pude comprobar este paso", nunca "esta mal".
 */
export type Veredicto = 'EQUIVALENTE' | 'NO_EQUIVALENTE' | 'INDETERMINADO';

/** Que capa emitio el veredicto. null cuando ninguna pudo pronunciarse. */
export type Capa = 1 | 2 | 3 | null;

export interface Contraejemplo {
  /** Valores que se asignaron a cada variable, ya formateados. */
  escenario: Record<string, string>;
  valorA: string;
  valorB: string;
}

export interface ResultadoVerificacion {
  veredicto: Veredicto;
  capa: Capa;
  /** Explicacion breve en espanol, para log y depuracion. No es texto de cara al alumno. */
  motivo: string;
  /** Capa 1: ambos lados normalizan igual. El paso es valido pero el alumno no avanzo. */
  sinCambio?: boolean;
  /** Capa 3: cuantos puntos de muestreo resultaron evaluables. */
  puntosValidos?: number;
  /** Capa 3: cuantos se intentaron. */
  puntosIntentados?: number;
  /** Capa 3: el punto concreto donde los dos lados difieren. */
  contraejemplo?: Contraejemplo;
}

export interface OpcionesVerificador {
  /** Puntos de muestreo a intentar en la capa 3. Por defecto 32. */
  puntosMuestreo?: number;
  /**
   * Minimo de puntos evaluables para que la capa 3 se atreva a decir NO_EQUIVALENTE
   * o EQUIVALENTE. Por debajo de esto el veredicto es INDETERMINADO. Por defecto 8.
   */
  minimoPuntosValidos?: number;
  /** Tolerancia relativa al comparar dos valores. Por defecto 1e-9. */
  toleranciaRelativa?: number;
  /** Tolerancia absoluta, para valores cercanos a cero. Por defecto 1e-12. */
  toleranciaAbsoluta?: number;
  /**
   * Semilla del generador pseudoaleatorio. Fijarla hace el veredicto reproducible,
   * que es lo que queremos en CI. Si se omite se usa una semilla fija por defecto:
   * un verificador que da veredictos distintos en cada corrida no es auditable.
   */
  semilla?: number;
}

export const OPCIONES_POR_DEFECTO: Required<OpcionesVerificador> = {
  puntosMuestreo: 32,
  minimoPuntosValidos: 8,
  toleranciaRelativa: 1e-9,
  toleranciaAbsoluta: 1e-12,
  semilla: 0x5EED,
};
