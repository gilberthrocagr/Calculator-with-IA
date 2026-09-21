import { describe, expect, it, beforeAll } from 'vitest';
import { cargarN1, crearN1, pareceResuelta } from '../src/motor/index.js';

let n1: ReturnType<typeof crearN1>;
beforeAll(async () => { n1 = crearN1(await cargarN1()); }, 30000);

describe('carga del paquete', () => {
  it('REGRESION: el CJS esta roto, solo funciona por ESM', async () => {
    // El package.json trae exports condicionales pero su build CJS se genero
    // mal. Si alguien cambia el import() por un require, esto lo caza.
    await expect(cargarN1()).resolves.toBeDefined();
  });

  it('REGRESION: la API no esta en el default, sino en el namespace', async () => {
    // mod.default existe pero NO trae assessUserStep ni assessUserEquationStep.
    const mod = await import('mathsteps-experimental-fork');
    expect(typeof mod.simplifyExpression).toBe('function');
    expect(typeof mod.solveEquation).toBe('function');
    const porDefecto = (mod as unknown as { default?: Record<string, unknown> }).default ?? {};
    expect(Object.keys(porDefecto)).not.toContain('assessUserStep');
    expect(typeof (mod as unknown as Record<string, unknown>).assessUserStep).toBe('function');
  });
});

describe('simplificar expresiones', () => {
  it('da pasos con nombre de regla', () => {
    const r = n1.simplificar('(x+2)*(x+3)');
    expect(r.resuelto).toBe(true);
    expect(r.pasos.length).toBeGreaterThan(1);
    expect(r.pasos.map((p) => p.regla)).toContain('KEMU_DISTRIBUTE_MUL_OVER_ADD');
    expect(r.resultado).toBe('x ^ 2 + 5 * x + 6');
  });

  it('MEDIDO: los radicales numericos si salen, con reglas KEMU', () => {
    // Esto es lo que justifica que el router los deje en el nivel 1.
    expect(n1.simplificar('sqrt(8)').resultado).toBe('2 sqrt(2)');
    expect(n1.simplificar('sqrt(50)').resultado).toBe('5 sqrt(2)');
    expect(n1.simplificar('sqrt(12) + sqrt(3)').resultado).toBe('3 * sqrt(3)');
    expect(n1.simplificar('sqrt(8)').pasos.map((p) => p.regla)).toContain('KEMU_SQRT_FROM_CONST');
  });

  it('hace fracciones, que es el pan del temario', () => {
    const r = n1.simplificar('2/4 + 1/3');
    expect(r.resuelto).toBe(true);
    expect(r.pasos.length).toBeGreaterThan(1);
  });

  it('el primer paso es el enunciado, no un avance', () => {
    expect(n1.simplificar('(x+2)*(x+3)').pasos[0].regla).toBe('KEMU_ORIGINAL_EXPRESSION');
  });
});

describe('resolver ecuaciones', () => {
  it('resuelve las lineales, que es para lo que sirve', () => {
    const r = n1.resolver('2x + 5 = 13', 'x');
    expect(r.resuelto).toBe(true);
    expect(r.resultado).toBe('x = 4');
    expect(r.pasos.map((p) => p.regla)).toContain('div_by_c');
  });

  it('REGRESION: solveEquation EXIGE unknownVariable', () => {
    // Sin ella lanza "unset unknown variable name". No estaba en el brief.
    const api = { simplifyExpression: () => undefined, solveEquation: () => undefined };
    void api;
    const r = n1.resolver('2x + 5 = 13', '');
    expect(r.resuelto).toBe(false);
  });

  it('LA TRAMPA GORDA: el objeto Equation se muta en sitio', () => {
    // Todos los pasos comparten la MISMA instancia. Si se guardaran los objetos
    // y se serializaran despues, los seis pasos dirian 'x = 4'. El adaptador
    // serializa DENTRO del callback, y este test lo fija.
    const r = n1.resolver('2x + 5 = 13', 'x');
    const textos = r.pasos.map((p) => p.texto);
    expect(textos[0]).toBe('2x + 5 = 13');          // el enunciado, no la respuesta
    expect(new Set(textos).size).toBeGreaterThan(1); // los pasos son distintos
  });
});

describe('mathsteps miente sobre haber resuelto', () => {
  it('REGRESION: las cuadraticas dicen "solution" sin resolver', () => {
    // MEDIDO: x^2 = 16 devuelve el paso 'solution' con 'x^2 = 16'. Fiarse de
    // esa etiqueta seria ensenarle al alumno su propio enunciado como respuesta.
    const r = n1.resolver('x^2 = 16', 'x');
    expect(r.pasos.map((p) => p.regla)).toContain('solution');  // mathsteps lo dice
    expect(r.resuelto).toBe(false);                             // el adaptador no le cree
    expect(r.motivo).toContain('no lo es');
  });

  it('REGRESION: la trigonometria tampoco resuelve, y tampoco lanza', () => {
    const r = n1.resolver('sin(x) = 1/2', 'x');
    expect(r.resuelto).toBe(false);
  });

  it('una cuadratica a medio transformar tampoco cuela', () => {
    const r = n1.resolver('x^2 - 5x + 6 = 0', 'x');
    expect(r.resuelto).toBe(false);
  });
});

describe('pareceResuelta: el guardian', () => {
  it('acepta solo la forma "incognita = algo sin la incognita"', () => {
    expect(pareceResuelta('x = 4', 'x')).toBe(true);
    expect(pareceResuelta('x = 8/2', 'x')).toBe(true);
    expect(pareceResuelta('x = y + 1', 'x')).toBe(true);
  });

  it('rechaza lo que no lo es', () => {
    expect(pareceResuelta('x^2 = 16', 'x')).toBe(false);   // la incognita a la izquierda
    expect(pareceResuelta('2x = 8', 'x')).toBe(false);
    expect(pareceResuelta('x = x + 1', 'x')).toBe(false);  // vuelve a aparecer
    expect(pareceResuelta('sin(x) = 1/2', 'x')).toBe(false);
    expect(pareceResuelta('4', 'x')).toBe(false);          // sin igualdad
  });

  it('no confunde la incognita con otra variable que la contenga', () => {
    expect(pareceResuelta('x = x1 + 2', 'x')).toBe(true);   // x1 no es x
    expect(pareceResuelta('x = 2*xy', 'x')).toBe(true);
  });
});
