/**
 * Extraccion de las variables libres de una expresion.
 *
 * ESTE MODULO EXISTE POR UN BUG CONCRETO Y CARO. En mathjs el nombre de una
 * funcion TAMBIEN es un SymbolNode. Sobre 'sin(x) + log(y) + z':
 *
 *     nodo.filter((n) => n.isSymbolNode).map((n) => n.name)
 *     // -> ['sin', 'x', 'log', 'y', 'z']     <-- 'sin' y 'log' NO son variables
 *
 * Si esa lista alimenta el scope del muestreo, 'sin' entra como numero y tapa a
 * la funcion. En mathjs 15.2.0 eso lanza:
 *
 *     "'sin' is not a function; its value is: 0.3"
 *
 * Como la capa 3 trata una evaluacion que lanza como "punto no valido", el efecto
 * real no es dar un resultado falso: es que TODA expresion con sin/cos/log/exp se
 * queda sin puntos validos y cae a INDETERMINADO. El verificador deja de verificar
 * justo en el temario donde mas falta hace.
 *
 * (En versiones anteriores de mathjs la sustitucion no lanzaba y devolvia un numero
 * cualquiera, que es peor: veredictos con aspecto correcto y equivocados. De ahi el
 * 83% que medimos antes de arreglarlo. La correccion es la misma en ambos casos.)
 *
 * Solucion: recorrer los FunctionNode, recoger sus nombres, y restarlos.
 * Ademas se excluyen las constantes propias de mathjs: si metieramos 'pi' en el
 * scope con un valor al azar, ambos lados usarian el mismo pi falso y podriamos
 * declarar equivalentes dos expresiones que no lo son.
 */

import type { NodoMath } from './math.js';

/** Constantes que mathjs resuelve sola y que jamas deben entrar al scope. */
export const CONSTANTES_RESERVADAS: ReadonlyArray<string> = [
  'pi', 'PI', 'tau', 'e', 'E', 'phi',
  'i', 'Infinity', 'NaN', 'null', 'undefined',
  'true', 'false',
  'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2',
  'version',
];

/**
 * Nombres que aparecen como SymbolNode pero son en realidad nombres de funcion.
 * Se recogen recorriendo los FunctionNode del arbol.
 */
export function nombresDeFuncion(nodo: NodoMath): Set<string> {
  const nombres = new Set<string>();
  nodo.traverse((n) => {
    if (n.isFunctionNode === true) {
      // En un FunctionNode, fn es un SymbolNode con .name. En un OperatorNode es
      // un string ('divide'). En 'a.b(x)' es un AccessorNode y no tiene name.
      const fn = n.fn;
      const nombre =
        typeof fn === 'string' ? fn
        : fn !== undefined && typeof fn.name === 'string' ? fn.name
        : undefined;
      if (nombre !== undefined && nombre.length > 0) nombres.add(nombre);
    }
  });
  return nombres;
}

/**
 * Variables libres reales de la expresion, ya sin nombres de funcion ni constantes.
 * Orden estable (primera aparicion) para que el muestreo sea reproducible.
 */
export function variablesLibres(nodo: NodoMath): string[] {
  const funciones = nombresDeFuncion(nodo);
  const reservadas = new Set<string>(CONSTANTES_RESERVADAS);
  const vistas = new Set<string>();
  const salida: string[] = [];

  const simbolos = nodo.filter((n) => n.isSymbolNode === true);
  for (let i = 0; i < simbolos.length; i += 1) {
    const nombre = simbolos[i].name;
    if (typeof nombre !== 'string' || nombre.length === 0) continue;
    if (funciones.has(nombre)) continue;   // <- la correccion
    if (reservadas.has(nombre)) continue;
    if (vistas.has(nombre)) continue;
    vistas.add(nombre);
    salida.push(nombre);
  }
  return salida;
}

/** Union ordenada de las variables de dos expresiones. */
export function variablesDeAmbos(a: NodoMath, b: NodoMath): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  const empujar = (nombres: string[]) => {
    for (let i = 0; i < nombres.length; i += 1) {
      if (!vistas.has(nombres[i])) {
        vistas.add(nombres[i]);
        salida.push(nombres[i]);
      }
    }
  };
  empujar(variablesLibres(a));
  empujar(variablesLibres(b));
  return salida;
}
