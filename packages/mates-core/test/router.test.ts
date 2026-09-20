import { describe, expect, it, beforeAll } from 'vitest';
import { cargarMath } from '../src/verificador/index.js';
import type { InstanciaMath } from '../src/verificador/index.js';
import { crearRouter, extraerRasgos, gradoPolinomico, gradoDelArbol } from '../src/router/index.js';
import type { Decision, Operacion } from '../src/router/index.js';

let math: InstanciaMath;
let r: { enrutar: (e: string, o?: Operacion) => Decision };
beforeAll(async () => { math = await cargarMath(); r = crearRouter(math); });

describe('rasgos - grado polinomico', () => {
  const grado = (s: string): number | null => {
    const g = extraerRasgos(math, s);
    return g.grado;
  };

  it('cuenta el grado de las formas normales', () => {
    expect(grado('7')).toBe(0);
    expect(grado('2*x + 5')).toBe(1);
    expect(grado('x^2 + 2*x + 1')).toBe(2);
    expect(grado('(x+1)*(x+2)')).toBe(2);        // producto: los grados se suman
    expect(grado('(x+1)^3')).toBe(3);
    expect(grado('-x^2')).toBe(2);                // menos unario
    expect(grado('(x^2+1)/4')).toBe(2);           // denominador constante
    expect(grado('x*y')).toBe(2);                 // dos variables
  });

  it('devuelve null en lo que no es polinomio', () => {
    expect(grado('1/x')).toBeNull();              // variable en el denominador
    expect(grado('2^x')).toBeNull();              // exponente variable
    expect(grado('x^(1/2)')).toBeNull();          // exponente fraccionario
    expect(grado('x^-1')).toBeNull();             // exponente negativo
    expect(grado('sin(x)')).toBeNull();
    expect(grado('sqrt(x)')).toBeNull();
  });

  it('las constantes de mathjs no suman grado', () => {
    // Si 'pi' contara como variable, 'pi*x' saldria de grado 2 y se iria de nivel.
    expect(grado('pi*x + e')).toBe(1);
    expect(extraerRasgos(math, 'pi*x + e').variables).toEqual(['x']);
  });

  it('REGRESION: el nombre de una funcion no es una variable', () => {
    // Trampa numero 2 del README: filter(isSymbolNode) sobre sin(x)+log(y)+z
    // devuelve ['sin','x','log','y','z']. Si 'sin' entrara como variable, el
    // router creeria que hay 5 variables y mandaria todo al nivel 3 por la
    // razon equivocada, tapando el motivo real (las trascendentes).
    const g = extraerRasgos(math, 'sin(x) + log(y) + z');
    expect(g.variables).toEqual(['x', 'y', 'z']);
    expect(g.funciones).toEqual(['log', 'sin']);
  });

  it('REGRESION: el grado sintactico no es el real, y manda el real', () => {
    // Sobre (x^2+x)-(x^2+3) el recorrido del arbol da 2 porque ve un x^2;
    // rationalize lo colapsa a 'x - 3', grado 1. Si gradoPolinomico se quedara
    // con el sintactico, una ecuacion lineal de verdad se iria al nivel 2.
    const nodo = math.parse('(x^2+x)-(x^2+3)');
    expect(gradoDelArbol(nodo, ['x'])).toBe(2);        // cota superior
    expect(gradoPolinomico(math, nodo, ['x'])).toBe(1); // el real
  });

  it('el fallback entra cuando rationalize lanza', () => {
    // MEDIDO: rationalize('sqrt(x)') lanza 'There is an unsolved function call'
    // y rationalize('x^(1/2)') lanza 'There is a non-integer exponent'. En ambos
    // el recorrido del arbol responde null, que es la respuesta correcta.
    expect(gradoPolinomico(math, math.parse('sqrt(x)'), ['x'])).toBeNull();
    expect(gradoPolinomico(math, math.parse('x^(1/2)'), ['x'])).toBeNull();
  });

  it('en una ecuacion el grado es el de la forma anulada', () => {
    expect(grado('2*x + 5 = 13')).toBe(1);
    expect(grado('x^2 = 4')).toBe(2);
    // x^2 a los dos lados se cancela: la ecuacion es lineal de verdad.
    expect(grado('x^2 + x = x^2 + 3')).toBe(1);
  });
});

describe('rasgos - deteccion de formas', () => {
  it('distingue ecuacion, desigualdad y expresion', () => {
    expect(extraerRasgos(math, '2*x+5=13').esEcuacion).toBe(true);
    expect(extraerRasgos(math, '2*x+5').esEcuacion).toBe(false);
    const d = extraerRasgos(math, '2*x+5 > 13');
    expect(d.esDesigualdad).toBe(true);
    expect(d.esEcuacion).toBe(false);
  });

  it('reconoce radicales escritos de las dos maneras', () => {
    expect(extraerRasgos(math, 'sqrt(x+1)').tieneRadicales).toBe(true);
    expect(extraerRasgos(math, 'x^(1/2)').tieneRadicales).toBe(true);
    expect(extraerRasgos(math, 'cbrt(8)').tieneRadicales).toBe(true);
    expect(extraerRasgos(math, 'x^2').tieneRadicales).toBe(false);
  });

  it('lee el Unicode real antes de analizar', () => {
    // Mismo camino que el verificador: normalizarTexto va primero.
    expect(extraerRasgos(math, 'x² + 2x + 1').grado).toBe(2);
    expect(extraerRasgos(math, '√(x+1)').tieneRadicales).toBe(true);
    expect(extraerRasgos(math, '2 − 3').grado).toBe(0);
  });

  it('no lanza con basura: lo dice en entradaValida', () => {
    const g = extraerRasgos(math, '2 +* (((');
    expect(g.entradaValida).toBe(false);
    expect(typeof g.errorDeParseo).toBe('string');
  });
});

describe('router - el bloqueo de las trascendentes antes del nivel 1', () => {
  it('REGRESION: sin(x) = 1/2 NO va al nivel 1', () => {
    // Medido en la fase 0: mathsteps no lanza con esto. Devuelve 3 pasos y la
    // ecuacion sin tocar, y el alumno veria "3 pasos" que no llevan a ninguna
    // parte. Este test es la unica cosa que impide que vuelva a pasar.
    const d = r.enrutar('sin(x) = 1/2');
    expect(d.nivel).toBe(3);
    expect(d.rasgos.trascendentes).toContain('sin');
    expect(d.bloqueosDeNivel1.join(' ')).toContain('trascendentes');
  });

  it('bloquea toda la familia que nombra el brief', () => {
    for (const f of ['sin', 'cos', 'tan', 'log', 'exp']) {
      const d = r.enrutar(f + '(x) + 1');
      expect(d.nivel, f + ' deberia salir del nivel 1').toBe(3);
      expect(d.rasgos.trascendentes).toContain(f);
    }
  });

  it('bloquea tambien las que el brief no nombraba', () => {
    // El alumno las escribe igual y mathsteps se queda igual de callado.
    for (const f of ['asin', 'sinh', 'log10', 'log2', 'atanh', 'sec']) {
      const d = r.enrutar(f + '(x) + 1');
      expect(d.nivel, f + ' deberia salir del nivel 1').toBe(3);
    }
  });

  it("'ln' bloquea aunque mathjs no la conozca como funcion", () => {
    // En mathjs el logaritmo natural es 'log'; el alumno escribe 'ln'.
    const d = r.enrutar('ln(x) + 1');
    expect(d.nivel).toBe(3);
    expect(d.rasgos.trascendentes).toContain('ln');
  });
});

describe('router - nivel 1', () => {
  const casos: Array<[string, Operacion]> = [
    ['2/4 + 1/3', 'auto'],            // fracciones
    ['2 + 3 * 4', 'auto'],            // aritmetica
    ['2*x + 3*x', 'auto'],            // terminos semejantes
    ['(x+2)*(x+3)', 'expandir'],      // distributiva: medido, 11 pasos
    ['2*x + 5 = 13', 'auto'],         // lineal de una variable
    ['x/2 + 1 = 4', 'auto'],          // lineal con denominador constante
    ['x^2 + x = x^2 + 3', 'auto'],    // parece cuadratica, es lineal
  ];

  for (const [entrada, op] of casos) {
    it('acepta ' + entrada + ' (' + op + ')', () => {
      const d = r.enrutar(entrada, op);
      expect(d.bloqueosDeNivel1, 'bloqueos inesperados').toEqual([]);
      expect(d.nivel).toBe(1);
    });
  }
});

describe('router - nivel 2', () => {
  it('manda las cuadraticas de una variable a nerdamer', () => {
    expect(r.enrutar('x^2 - 5*x + 6 = 0').nivel).toBe(2);
    expect(r.enrutar('x^2 = 4').nivel).toBe(2);
  });

  it('manda a factorizar a nerdamer: mathsteps no factoriza', () => {
    const d = r.enrutar('x^2 - 1', 'factorizar');
    expect(d.nivel).toBe(2);
    expect(d.bloqueosDeNivel1.join(' ')).toContain('no factoriza');
  });

  it('manda los radicales y las racionales a nerdamer', () => {
    expect(r.enrutar('sqrt(8) + sqrt(2)').nivel).toBe(2);
    expect(r.enrutar('(x^2-1)/(x-1)').nivel).toBe(2);
  });
});

describe('router - nivel 3', () => {
  it('las desigualdades van al servidor', () => {
    // Coherente con el verificador, que ya las deja fuera de la fase 1.
    for (const e of ['2*x + 1 > 5', 'x <= 3', 'x != 0']) {
      expect(r.enrutar(e).nivel, e).toBe(3);
    }
  });

  it('el grado 3 o mas se va al servidor', () => {
    expect(r.enrutar('x^3 - 2*x = 5').nivel).toBe(3);
  });

  it('una ecuacion con dos variables se va al servidor', () => {
    const d = r.enrutar('x + y = 10');
    expect(d.nivel).toBe(3);
    expect(d.bloqueosDeNivel1.join(' ')).toContain('una variable');
  });

  it('lo que no parsea se va al servidor, no se rompe', () => {
    const d = r.enrutar('2 +* (((');
    expect(d.nivel).toBe(3);
    expect(d.rasgos.entradaValida).toBe(false);
  });
});

describe('router - la operacion es parte de la peticion', () => {
  it("'auto' resuelve si hay '=' y simplifica si no", () => {
    expect(r.enrutar('2*x + 5 = 13').operacion).toBe('resolver');
    expect(r.enrutar('2*x + 5').operacion).toBe('simplificar');
  });

  it('la misma expresion va a niveles distintos segun lo que se pida', () => {
    // 'x^2-1' expandido lo hace mathsteps; factorizado no, no sabe.
    expect(r.enrutar('x^2 - 1', 'expandir').nivel).toBe(1);
    expect(r.enrutar('x^2 - 1', 'factorizar').nivel).toBe(2);
  });

  it('pedir resolver algo que no es ecuacion se bloquea, no se adivina', () => {
    const d = r.enrutar('2*x + 5', 'resolver');
    expect(d.bloqueosDeNivel1.join(' ')).toContain('no hay ecuacion');
    expect(d.nivel).toBe(3);
  });
});

describe('clasificador de area', () => {
  it('reconoce lo que no es ambiguo', () => {
    expect(r.enrutar('sin(x) = 1/2').area).toBe('trigonometria');
    expect(r.enrutar('log(x) + 1').area).toBe('logaritmos');
    expect(r.enrutar('sqrt(8)').area).toBe('radicales');
    expect(r.enrutar('2*x + 5 = 13').area).toBe('ecuaciones-lineales');
    expect(r.enrutar('x^2 - 5*x + 6 = 0').area).toBe('cuadraticas');
    expect(r.enrutar('2/4 + 1/3').area).toBe('fracciones');
    expect(r.enrutar('2 + 3 * 4').area).toBe('aritmetica');
  });

  it('la delata la operacion pedida, no la forma', () => {
    expect(r.enrutar('x^2 - 1', 'factorizar').area).toBe('factorizacion');
    expect(r.enrutar('(x+2)*(x+3)', 'expandir').area).toBe('distributiva');
  });

  it('dice "desconocida" en vez de inventarse una etiqueta', () => {
    // 'x^2-1' a secas puede ser factorizacion, productos notables o evaluacion.
    // Adivinar aqui seria meterle a la interfaz una etiqueta que parece medida.
    expect(r.enrutar('x^2 - 1', 'simplificar').area).toBe('desconocida');
    expect(r.enrutar('2*x + 3*x').area).toBe('desconocida');
  });

  it('el area NO decide el nivel', () => {
    // Misma area, niveles distintos: la prueba de que el router no la mira.
    const a = r.enrutar('2*x + 5 = 13');
    const b = r.enrutar('x/2 + 1 = 4');
    expect(a.area).toBe(b.area);
    expect(a.nivel).toBe(1);
    expect(b.nivel).toBe(1);
    // Y al reves: mismo nivel 3, areas distintas.
    expect(r.enrutar('sin(x) = 1/2').area).not.toBe(r.enrutar('x + y = 10').area);
  });
});

describe('la decision siempre es utilizable', () => {
  it('nunca lanza y siempre trae motivo y rasgos', () => {
    const entradas = [
      '', '   ', '=', '2=', '=2', 'x', '2 +* (((', 'sin(x)=1/2',
      'x^2-1', '2/4+1/3', 'x+y=10', 'x <= 3', 'sqrt(-1)', '1/0',
    ];
    for (const e of entradas) {
      const d = r.enrutar(e);
      expect([1, 2, 3], 'nivel invalido para ' + JSON.stringify(e)).toContain(d.nivel);
      expect(d.motivo.length, 'sin motivo para ' + JSON.stringify(e)).toBeGreaterThan(0);
      expect(d.rasgos).toBeDefined();
    }
  });

  it('es determinista: la misma entrada da la misma decision', () => {
    // Igual que el verificador con su semilla fija: sin esto no es auditable.
    for (const e of ['x^2-1', 'sin(x)=1/2', '2*x+5=13']) {
      expect(JSON.stringify(r.enrutar(e))).toBe(JSON.stringify(r.enrutar(e)));
    }
  });
});
