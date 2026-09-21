/**
 * Catalogo de errores tipicos del alumno, detectables SIN gastar un token.
 *
 * COMO FUNCIONA, que es lo que lo hace fiable: no se adivina el error mirando lo
 * que escribio el alumno. Se hace al reves. Para cada error del catalogo se
 * PREDICE que habria escrito si hubiera cometido ese error concreto, y se compara
 * la prediccion con lo que escribio de verdad usando el verificador de tres capas
 * que ya esta al 100%. Solo si coinciden se emite el diagnostico.
 *
 * Consecuencia: un diagnostico afirmado esta PROBADO, no supuesto. Y cuando
 * ningun patron encaja, la respuesta es "no lo se", nunca una etiqueta inventada.
 * Es la misma regla que gobierna el verificador: sin evidencia, no se acusa.
 *
 * Por que importa acertar el error y no solo saber que hay uno: un benchmark de
 * 55 errores documentados midio que un LLM acierta el diagnostico el 52,96% de
 * las veces si se le da el catalogo entero, y el 73,82% si se le restringe al
 * tema del problema. Detectarlo en codigo, cuando se puede, es 100% y gratis.
 */

import type { Area } from '../bateria/tipos.js';

export type TipoError =
  | 'linealidad-ilusoria'
  | 'distribucion-parcial'
  | 'signo-al-distribuir'
  | 'cancelacion-ilegal'
  | 'terminos-no-semejantes'
  | 'suma-de-fracciones'
  | 'exponentes-sumados'
  | 'coeficientes-multiplicados'
  | 'reglas-de-exponentes'
  | 'operacion-de-fracciones'
  | 'transposicion-sin-signo'
  | 'balance-roto';

/**
 * Como debe responder el tutor ante el error.
 *
 * 'contraejemplo' es la estrategia por defecto en los errores de linealidad y de
 * cancelacion: ensenar numeros que rompen la regla que el alumno cree tener
 * convence mas que enunciarle la regla correcta, y no le da el paso hecho.
 */
export type Estrategia = 'contraejemplo' | 'senalar-termino' | 'preguntar-como';

export interface EntradaCatalogo {
  tipo: TipoError;
  /** Nombre corto, para el log y para la interfaz. */
  nombre: string;
  /** Que cree el alumno que es verdad. En su cabeza hay una regla, no un descuido. */
  creencia: string;
  /** Areas del temario donde aparece. Sirve para dar al LLM solo las de su tema. */
  areas: ReadonlyArray<Area>;
  estrategia: Estrategia;
}

/**
 * Numeros que rompen la creencia del alumno.
 *
 * Se llama ContraejemploNumerico y no Contraejemplo porque el verificador ya
 * exporta un Contraejemplo con otra forma (el punto del muestreo donde dos
 * expresiones difieren). Son cosas distintas: aquel es evidencia interna, este
 * es material didactico que se le ensena al alumno.
 */
export interface ContraejemploNumerico {
  /** Valores concretos que rompen la regla que el alumno cree. */
  escenario: Record<string, number>;
  /** Lo que vale la expresion de partida. */
  valorCorrecto: number;
  /** Lo que vale lo que escribio el alumno. */
  valorDelAlumno: number;
}

export interface ErrorDetectado {
  tipo: TipoError;
  nombre: string;
  creencia: string;
  estrategia: Estrategia;
  /**
   * La expresion que este error habria producido, y que resulto equivalente a lo
   * que escribio el alumno. Es la evidencia del diagnostico: se puede auditar.
   */
  prediccion: string;
  /** Numeros que rompen la creencia del alumno, cuando se pudieron calcular. */
  contraejemplo?: ContraejemploNumerico;
}

export interface Diagnostico {
  /** false cuando el paso era correcto: no hay nada que diagnosticar. */
  hayError: boolean;
  /**
   * Errores del catalogo que explican lo que escribio el alumno. Vacio no
   * significa que no haya error: significa que NINGUN patron conocido lo explica,
   * y entonces el tutor pregunta en vez de afirmar.
   */
  errores: ErrorDetectado[];
  /** Explicacion breve en espanol, para log. No es texto de cara al alumno. */
  motivo: string;
}
