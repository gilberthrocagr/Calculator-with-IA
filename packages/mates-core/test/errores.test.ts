import { describe, expect, it, beforeAll } from 'vitest';
import { cargarMath } from '../src/verificador/index.js';
import type { InstanciaMath } from '../src/verificador/index.js';
import { crearDiagnosticador, CATALOGO, erroresDelArea } from '../src/errores/index.js';
import type { Diagnosticador, TipoError } from '../src/errores/index.js';
import { BATERIA } from '../src/bateria/index.js';

let math: InstanciaMath;
let d: Diagnosticador;
beforeAll(async () => { math = await cargarMath(); d = crearDiagnosticador(math); });

/** Comodidad: los tipos de error detectados en un paso. */
const tipos = (antes: string, despues: string): TipoError[] =>
  d.diagnosticar(antes, despues).errores.map((e) => e.tipo);

describe('lo que NO se diagnostica', () => {
  it('un paso correcto no recibe diagnostico', () => {
    const r = d.diagnosticar('2*(x+3)', '2*x+6');
    expect(r.hayError).toBe(false);
    expect(r.errores).toEqual([]);
  });

  it('un paso que el verificador no pudo juzgar tampoco se diagnostica', () => {
    // INDETERMINADO no es "esta mal": ponerle nombre a un error que no sabemos
    // que existe es exactamente lo que el proyecto no hace.
    const r = d.diagnosticar('2 +* (((', 'x');
    expect(r.hayError).toBe(false);
    expect(r.motivo).toContain('no pudo pronunciarse');
  });

  it('un paso malo sin patron conocido se admite como tal, sin inventar', () => {
    // 'pareja que suma bien pero no multiplica' no es un patron estructural:
    // es una eleccion equivocada. El catalogo NO debe forzar una etiqueta.
    const r = d.diagnosticar('x^2+5*x+6', '(x+1)*(x+6)');
    expect(r.hayError).toBe(true);
    expect(r.errores).toEqual([]);
    expect(r.motivo).toContain('ningun patron conocido');
  });
});

describe('los patrones, uno a uno', () => {
  it('linealidad ilusoria: el error mas frecuente del temario', () => {
    expect(tipos('(x+1)^2', 'x^2+1')).toContain('linealidad-ilusoria');
    expect(tipos('(a+b)^2', 'a^2+b^2')).toContain('linealidad-ilusoria');
    expect(tipos('(x+1)^3', 'x^3+1')).toContain('linealidad-ilusoria');
    expect(tipos('sqrt(x+9)', 'sqrt(x)+3')).toContain('linealidad-ilusoria');
  });

  it('distribucion parcial', () => {
    expect(tipos('2*(x+3)', '2*x+3')).toContain('distribucion-parcial');
    expect(tipos('x*(x+5)', 'x^2+5')).toContain('distribucion-parcial');
    expect(tipos('a*(b+c)', 'a*b+c')).toContain('distribucion-parcial');
  });

  it('signo al distribuir un factor negativo', () => {
    expect(tipos('-3*(x-4)', '-3*x-12')).toContain('signo-al-distribuir');
    expect(tipos('-(x-3)', '-x-3')).toContain('signo-al-distribuir');
  });

  it('operaciones con fracciones hechas en linea', () => {
    expect(tipos('1/2+1/3', '2/5')).toContain('operacion-de-fracciones');
    expect(tipos('3/4-1/6', '2/2')).toContain('operacion-de-fracciones');
    expect(tipos('(2/3)/(4/5)', '8/15')).toContain('operacion-de-fracciones');
  });

  it('reglas de exponentes mezcladas', () => {
    expect(tipos('2^3', '6')).toContain('reglas-de-exponentes');
    expect(tipos('3^0', '0')).toContain('reglas-de-exponentes');
    expect(tipos('sqrt(16)', '8')).toContain('reglas-de-exponentes');
  });

  it('transposicion sin cambio de signo, en ecuaciones', () => {
    // Las ecuaciones van por otro camino: mathjs lee el '=' como asignacion y
    // lanza, asi que hay que partirlas antes. Este test cubre ese camino.
    expect(tipos('2*x+5=13', '2*x=13+5')).toContain('transposicion-sin-signo');
    expect(tipos('x+5=12', 'x=12+5')).toContain('transposicion-sin-signo');
  });
});

describe('el contraejemplo', () => {
  it('trae numeros concretos que rompen la creencia del alumno', () => {
    const r = d.diagnosticar('(a+b)^2', 'a^2+b^2');
    const e = r.errores.find((x) => x.tipo === 'linealidad-ilusoria');
    expect(e).toBeDefined();
    const c = e?.contraejemplo;
    expect(c).toBeDefined();
    // a=3, b=4: (3+4)^2 = 49, pero 9+16 = 25. Es el ejemplo del plan.
    expect(c?.valorCorrecto).toBe(49);
    expect(c?.valorDelAlumno).toBe(25);
    expect(c?.valorCorrecto).not.toBe(c?.valorDelAlumno);
  });

  it('la prediccion queda guardada: el diagnostico es auditable', () => {
    const r = d.diagnosticar('2*(x+3)', '2*x+3');
    expect(r.errores[0].prediccion.length).toBeGreaterThan(0);
  });
});

describe('el catalogo', () => {
  it('cada entrada nombra la creencia, no solo el sintoma', () => {
    // Si el tutor no nombra la regla que el alumno cree tener, la regla
    // sobrevive y el error vuelve en el ejercicio siguiente.
    for (const e of CATALOGO) {
      expect(e.creencia.length, e.tipo).toBeGreaterThan(10);
      expect(e.areas.length, e.tipo).toBeGreaterThan(0);
    }
  });

  it('se puede restringir al area del problema', () => {
    // EXISTE POR UN NUMERO: un LLM acierta el diagnostico el 52,96% con el
    // catalogo entero y el 73,82% restringido al tema. Nunca los 50 a la vez.
    const deFracciones = erroresDelArea('fracciones');
    expect(deFracciones.length).toBeGreaterThan(0);
    expect(deFracciones.length).toBeLessThan(CATALOGO.length);
    expect(erroresDelArea('ecuaciones-lineales').map((e) => e.tipo))
      .toContain('transposicion-sin-signo');
  });
});

describe('medido sobre la bateria del curriculo', () => {
  const malos = BATERIA.filter((c) => c.espera === 'NO_EQUIVALENTE');
  const buenos = BATERIA.filter((c) => c.espera === 'EQUIVALENTE');

  it('CERO falsos positivos sobre los 156 pasos buenos', () => {
    // EL TEST QUE MAS IMPORTA DE ESTE FICHERO. Acusar a un alumno de un error
    // que no cometio es peor que no diagnosticar nada: rompe su confianza en la
    // app justo cuando acaba de hacerlo bien. La cobertura se puede subir
    // despues; un falso positivo no se perdona.
    const fallos = buenos
      .filter((c) => d.diagnosticar(c.antes, c.despues).errores.length > 0)
      .map((c) => `${c.id}: ${c.antes} -> ${c.despues}`);
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('explica al menos el 40% de los 115 pasos malos', () => {
    const conDiagnostico = malos.filter((c) => d.diagnosticar(c.antes, c.despues).errores.length > 0);
    const pct = (100 * conDiagnostico.length) / malos.length;
    console.log(`  catalogo de errores: ${conDiagnostico.length}/${malos.length} (${pct.toFixed(1)}%)`);
    // Suelo, no objetivo. Medido 46/115 el 21-sep-2026. Si alguien rompe un
    // patron, este test lo dice en vez de dejarlo pasar en silencio.
    expect(conDiagnostico.length).toBeGreaterThanOrEqual(46);
  });

  it('nunca lanza, sobre los 271 casos', () => {
    for (const c of BATERIA) {
      expect(() => d.diagnosticar(c.antes, c.despues), c.id).not.toThrow();
    }
  });
});
