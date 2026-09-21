/**
 * Nivel 1 del motor: mathsteps-experimental-fork.
 *
 * Es el unico motor que da pasos con NOMBRE DE REGLA, que es lo que hace que la
 * app se sienta como un tutor y no como una calculadora. Funciona offline y sin
 * coste.
 *
 * TODO LO QUE SIGUE ESTA MEDIDO contra la version 0.9.12, no leido de su
 * documentacion. Las cuatro cosas que hay que saber antes de tocar esto:
 *
 * 1. EL CJS ESTA ROTO. require() lanza "exports is not defined in ES module
 *    scope". Solo funciona por import(), y en Metro hace falta
 *    unstable_enablePackageExports. Por eso aqui la carga es diferida.
 *
 * 2. LA API NO ESTA EN EL DEFAULT. `mod.default` existe pero NO trae
 *    assessUserStep ni assessUserEquationStep; esas viven en el namespace del
 *    modulo. Hay que quedarse con el namespace entero.
 *
 * 3. solveEquation EXIGE unknownVariable. Sin ella lanza "unset unknown
 *    variable name". La documentacion del brief no lo mencionaba.
 *
 * 4. MATHSTEPS MIENTE SOBRE HABER RESUELTO. Ver abajo.
 */

/**
 * ⚠️ LA REGLA QUE JUSTIFICA LA MITAD DE ESTE FICHERO.
 *
 * mathsteps etiqueta su ultimo paso como `solution` AUNQUE NO HAYA RESUELTO:
 *
 *     x^2 = 16          -> 2 pasos | solution: x^2 = 16        (no toco nada)
 *     x^2 - 5x + 6 = 0  -> 5 pasos | solution: x^2 - 5x = -6   (a medio hacer)
 *     sin(x) = 1/2      -> 3 pasos | solution: sin(x) = 1/2    (no toco nada)
 *
 * Es el mismo fallo que ya conociamos de la trigonometria, pero peor: alli
 * simplemente no avanzaba; aqui ademas dice que ha terminado. Si el adaptador
 * se fiara de `stepId === 'solution'`, le ensenariamos al alumno una "solucion"
 * que es su propio enunciado.
 *
 * Por eso `resolver()` COMPRUEBA la forma del resultado y devuelve
 * `resuelto: false` cuando no lo esta, para que el router escale al nivel 2 o 3
 * en vez de mostrar basura con aspecto de respuesta.
 */

/** Un paso con nombre de regla, ya serializado. */
export interface PasoN1 {
  /** El nombre de la regla: COMMON_DENOMINATOR, KEMU_SQRT_FROM_CONST, div_by_c... */
  regla: string;
  /** El estado despues de aplicarla, en texto. */
  texto: string;
}

export interface ResultadoN1 {
  /**
   * true solo si mathsteps LLEGO de verdad. En `resolver` significa que el
   * resultado tiene la forma `variable = algo sin la variable`; en `simplificar`,
   * que produjo al menos un paso util.
   */
  resuelto: boolean;
  pasos: PasoN1[];
  /** El resultado final en texto, o null si no lo hay. */
  resultado: string | null;
  /** En espanol, para log. Dice por que no se resolvio, cuando toca. */
  motivo: string;
}

interface PasoBruto {
  changeType?: unknown;
  stepId?: unknown;
  rootNode?: unknown;
  equation?: unknown;
}

interface ApiMathsteps {
  simplifyExpression: (opciones: {
    expressionAsText: string;
    onStepCb: (paso: PasoBruto) => void;
  }) => unknown;
  solveEquation: (opciones: {
    equationAsText: string;
    unknownVariable: string;
    onStepCb: (paso: PasoBruto) => void;
  }) => unknown;
}

let cache: ApiMathsteps | null = null;
let cargando: Promise<ApiMathsteps> | null = null;

/**
 * Carga mathsteps una sola vez, y tarde. Pesa, y como mathjs no puede estar en
 * el arranque de la app. Las llamadas concurrentes comparten la promesa.
 */
export async function cargarN1(): Promise<ApiMathsteps> {
  if (cache !== null) return cache;
  if (cargando !== null) return cargando;

  cargando = import('mathsteps-experimental-fork').then((mod) => {
    // El namespace ENTERO, no mod.default: ahi faltan funciones. Ver nota 2.
    const api = mod as unknown as ApiMathsteps;
    cache = api;
    cargando = null;
    return api;
  });
  return cargando;
}

/** Para pruebas: inyectar una api ya cargada. */
export function fijarN1(api: ApiMathsteps): void {
  cache = api;
}

function aTexto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/**
 * Simplifica una expresion, devolviendo los pasos con nombre de regla.
 *
 * Nota medida: en simplifyExpression el `rootNode` de cada paso es una instancia
 * DISTINTA, asi que aqui no hay trampa de mutacion. La hay en `resolver`.
 */
export function crearN1(api: ApiMathsteps): {
  simplificar: (texto: string) => ResultadoN1;
  resolver: (texto: string, variable: string) => ResultadoN1;
} {
  function simplificar(texto: string): ResultadoN1 {
    const pasos: PasoN1[] = [];
    try {
      api.simplifyExpression({
        expressionAsText: texto,
        onStepCb: (s) => {
          pasos.push({ regla: aTexto(s.changeType), texto: aTexto(s.rootNode) });
        },
      });
    } catch (e) {
      return {
        resuelto: false,
        pasos,
        resultado: null,
        motivo: 'mathsteps lanzo: ' + (e instanceof Error ? e.message.split('\n')[0] : String(e)),
      };
    }

    // El primer paso es siempre KEMU_ORIGINAL_EXPRESSION: el enunciado, no un
    // avance. Si es el unico, mathsteps no supo hacer nada.
    const utiles = pasos.filter((p) => p.regla !== 'KEMU_ORIGINAL_EXPRESSION');
    if (utiles.length === 0) {
      return {
        resuelto: false,
        pasos,
        resultado: pasos.length > 0 ? pasos[pasos.length - 1].texto : null,
        motivo: 'mathsteps no produjo ningun paso util',
      };
    }

    return {
      resuelto: true,
      pasos,
      resultado: pasos[pasos.length - 1].texto,
      motivo: String(utiles.length) + ' pasos con nombre de regla',
    };
  }

  function resolver(texto: string, variable: string): ResultadoN1 {
    const pasos: PasoN1[] = [];
    try {
      api.solveEquation({
        equationAsText: texto,
        unknownVariable: variable,
        onStepCb: (s) => {
          // ⚠️ SERIALIZAR AQUI DENTRO. Todos los pasos comparten la MISMA
          // instancia de Equation, que se muta en sitio. Guardando el objeto y
          // serializando despues, los seis pasos muestran la respuesta final.
          // Comprobado: pasos.every(p => p.equation === pasos[0].equation).
          pasos.push({ regla: aTexto(s.stepId), texto: aTexto(s.equation) });
        },
      });
    } catch (e) {
      return {
        resuelto: false,
        pasos,
        resultado: null,
        motivo: 'mathsteps lanzo: ' + (e instanceof Error ? e.message.split('\n')[0] : String(e)),
      };
    }

    const final = pasos.length > 0 ? pasos[pasos.length - 1].texto : null;
    if (final === null) {
      return { resuelto: false, pasos, resultado: null, motivo: 'mathsteps no produjo ningun paso' };
    }

    // NO nos fiamos de stepId === 'solution'. Comprobamos la forma.
    if (!pareceResuelta(final, variable)) {
      return {
        resuelto: false,
        pasos,
        resultado: final,
        motivo:
          'mathsteps dijo "solution" pero el resultado no lo es: "' + final +
          '". Escalar al nivel 2 o 3.',
      };
    }

    return { resuelto: true, pasos, resultado: final, motivo: 'resuelta en ' + String(pasos.length) + ' pasos' };
  }

  return { simplificar, resolver };
}

/**
 * ¿Tiene el resultado la forma de una solucion? Es decir `x = algo` donde ese
 * algo YA NO contiene la incognita.
 *
 * Deliberadamente sintactico y estricto: su trabajo es desconfiar. Un falso
 * "no resuelta" solo cuesta escalar al nivel 2; un falso "resuelta" le ensena
 * al alumno su propio enunciado como si fuera la respuesta.
 */
export function pareceResuelta(texto: string, variable: string): boolean {
  const partes = texto.split('=');
  if (partes.length !== 2) return false;

  const izq = partes[0].trim();
  const der = partes[1].trim();
  if (izq.length === 0 || der.length === 0) return false;

  // El lado izquierdo tiene que ser la incognita a secas.
  if (izq !== variable) return false;

  // Y el derecho no puede volver a mencionarla.
  const suelta = new RegExp('(^|[^A-Za-z0-9_])' + variable + '([^A-Za-z0-9_]|$)');
  return !suelta.test(der);
}

/** Version comoda: carga mathsteps bajo demanda la primera vez. */
export async function simplificar(texto: string): Promise<ResultadoN1> {
  return crearN1(await cargarN1()).simplificar(texto);
}

/** Version comoda: carga mathsteps bajo demanda la primera vez. */
export async function resolver(texto: string, variable: string): Promise<ResultadoN1> {
  return crearN1(await cargarN1()).resolver(texto, variable);
}
