/**
 * Las entradas del catalogo: que cree el alumno, donde aparece y como responder.
 *
 * El campo 'creencia' no es decoracion. En la cabeza del alumno hay una REGLA,
 * no un descuido; si el tutor no la nombra, la regla sobrevive y el error vuelve
 * al siguiente ejercicio. Por eso la respuesta por defecto ante linealidad
 * ilusoria y cancelacion ilegal es un contraejemplo numerico y no el enunciado
 * de la regla correcta: los numeros rompen la creencia, la regla solo la tapa.
 *
 * Frecuencia media por alumno a lo largo de un curso (Booth et al.): errores de
 * signo negativo 1,96 · aritmeticos 0,80 · variables 0,77 · igualdad 0,55 ·
 * fracciones 0,43 · propiedades 0,30. El signo es, con diferencia, el primero.
 */

import type { EntradaCatalogo, TipoError } from './tipos.js';
import type { Area } from '../bateria/tipos.js';

export const CATALOGO: ReadonlyArray<EntradaCatalogo> = [
  {
    tipo: 'linealidad-ilusoria',
    nombre: 'reparte sobre la suma algo que no se reparte',
    creencia: 'lo que le pasa a una suma le pasa a cada sumando por separado',
    areas: ['productos-notables', 'radicales', 'logaritmos', 'exponentes'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'distribucion-parcial',
    nombre: 'distribuye solo al primer termino',
    creencia: 'el factor de fuera basta con aplicarlo una vez',
    areas: ['distributiva', 'productos-notables'],
    estrategia: 'senalar-termino',
  },
  {
    tipo: 'signo-al-distribuir',
    nombre: 'no cambia el signo al repartir un factor negativo',
    creencia: 'el menos de delante solo afecta al primer termino',
    areas: ['distributiva', 'terminos-semejantes'],
    estrategia: 'preguntar-como',
  },
  {
    tipo: 'cancelacion-ilegal',
    nombre: 'tacha un sumando contra el denominador',
    creencia: 'lo que esta arriba y abajo se tacha, sea sumando o factor',
    areas: ['fracciones', 'factorizacion'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'terminos-no-semejantes',
    nombre: 'junta terminos que no son semejantes',
    creencia: 'dos terminos seguidos siempre se pueden juntar en uno',
    areas: ['terminos-semejantes'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'suma-de-fracciones',
    nombre: 'suma numeradores y denominadores en linea',
    creencia: 'las fracciones se suman como se multiplican',
    areas: ['fracciones', 'aritmetica'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'exponentes-sumados',
    nombre: 'suma los exponentes al sumar terminos',
    creencia: 'sumar terminos suma tambien sus exponentes',
    areas: ['terminos-semejantes', 'exponentes'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'reglas-de-exponentes',
    nombre: 'mezcla las reglas de los exponentes',
    creencia: 'todas las operaciones con potencias se hacen igual con los exponentes',
    areas: ['exponentes', 'aritmetica', 'radicales'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'operacion-de-fracciones',
    nombre: 'opera las fracciones en linea',
    creencia: 'las fracciones se operan como se multiplican: arriba con arriba, abajo con abajo',
    areas: ['fracciones', 'aritmetica'],
    estrategia: 'contraejemplo',
  },
  {
    tipo: 'transposicion-sin-signo',
    nombre: 'pasa un termino al otro lado sin cambiarle el signo',
    creencia: 'cambiar de lado es mover, no deshacer una operacion',
    areas: ['ecuaciones-lineales', 'cuadraticas'],
    estrategia: 'preguntar-como',
  },
  {
    tipo: 'balance-roto',
    nombre: 'opera en un solo lado de la igualdad',
    creencia: 'el signo igual separa dos cuentas independientes',
    areas: ['ecuaciones-lineales', 'cuadraticas'],
    estrategia: 'senalar-termino',
  },
  {
    tipo: 'coeficientes-multiplicados',
    nombre: 'multiplica los coeficientes en vez de sumarlos',
    creencia: 'juntar dos terminos es operarlos, y operar es multiplicar',
    areas: ['terminos-semejantes'],
    estrategia: 'preguntar-como',
  },
];

const PORTIPO = new Map<TipoError, EntradaCatalogo>(CATALOGO.map((e) => [e.tipo, e]));

export function entradaDe(tipo: TipoError): EntradaCatalogo {
  const e = PORTIPO.get(tipo);
  if (e === undefined) throw new Error('tipo de error desconocido: ' + tipo);
  return e;
}

/**
 * Los errores del catalogo que aplican a un area concreta.
 *
 * ESTA FUNCION EXISTE POR UN NUMERO: un benchmark de 55 errores documentados
 * midio que el LLM acierta el diagnostico el 52,96% de las veces con el catalogo
 * entero delante y el 73,82% restringido al tema del problema. Al prompt del
 * tutor NUNCA se le pasan los del catalogo completo: solo los de su area.
 */
export function erroresDelArea(area: Area): EntradaCatalogo[] {
  return CATALOGO.filter((e) => e.areas.indexOf(area) !== -1);
}
