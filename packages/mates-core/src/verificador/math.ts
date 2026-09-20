/**
 * Superficie minima de mathjs que usa el nucleo, y su carga diferida.
 *
 * mathjs pesa: su require tarda ~700 ms en Node y Hermes es mas lento. No puede
 * estar en el arranque de la app. Por eso aqui solo se declara la forma que
 * necesitamos y se carga con import() bajo demanda, cacheando la instancia.
 *
 * El nucleo recibe la instancia por parametro (inyeccion) en vez de importarla
 * arriba: asi el paquete sigue siendo TypeScript puro, comprobable en CI sin
 * simulador, y la app decide cuando pagar el coste de la carga.
 */

export interface NodoMath {
  isSymbolNode?: boolean;
  isFunctionNode?: boolean;
  isOperatorNode?: boolean;
  isConstantNode?: boolean;
  name?: string;
  op?: string;
  fn?: string | { name?: string };
  args?: unknown[];
  toString: () => string;
  evaluate: (scope?: Record<string, unknown>) => unknown;
  traverse: (cb: (n: NodoMath) => void) => void;
  filter: (cb: (n: NodoMath) => boolean) => NodoMath[];
}

export interface Complejo {
  re: number;
  im: number;
}

export interface InstanciaMath {
  parse: (expr: string) => NodoMath;
  rationalize: (expr: string | NodoMath, scope?: object, detallado?: boolean) => NodoMath;
  simplify: (expr: string | NodoMath) => NodoMath;
  complex: (re: number, im: number) => Complejo;
}

let cacheMath: InstanciaMath | null = null;
let cargando: Promise<InstanciaMath> | null = null;

/**
 * Carga mathjs una sola vez. Llamar lo mas tarde posible: nunca en el arranque.
 * Las llamadas concurrentes comparten la misma promesa, para no pagar dos veces.
 */
export async function cargarMath(): Promise<InstanciaMath> {
  if (cacheMath !== null) return cacheMath;
  if (cargando !== null) return cargando;

  cargando = import('mathjs').then((mod) => {
    const instancia = mod as unknown as InstanciaMath;
    cacheMath = instancia;
    cargando = null;
    return instancia;
  });
  return cargando;
}

/** Para pruebas: inyectar una instancia ya creada y saltarse el import(). */
export function fijarMath(instancia: InstanciaMath): void {
  cacheMath = instancia;
}
