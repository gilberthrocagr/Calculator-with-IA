import { describe, expect, it, beforeAll } from 'vitest';
import {
  crearVerificador, cargarMath, normalizarTexto,
  variablesLibres, nombresDeFuncion, partirEcuacion, esDesigualdad,
} from '../src/verificador/index.js';
import type { Verificador, InstanciaMath, NodoMath } from '../src/verificador/index.js';
import { crearAleatorio, distanciaRelativa, aComplejo } from '../src/verificador/muestreo.js';

let math: InstanciaMath;
let v: Verificador;
beforeAll(async () => { math = await cargarMath(); v = crearVerificador(math); });

describe('capa 1 - normalizacion', () => {
  it('traduce el Unicode que llega de WhatsApp y Word', () => {
    expect(normalizarTexto('2 − 3')).toBe('2-3');        // menos tipografico
    expect(normalizarTexto('2 × 3')).toBe('2*3');        // por
    expect(normalizarTexto('6 ÷ 2')).toBe('6/2');        // entre
    expect(normalizarTexto('x²')).toBe('x^2');           // superindice
    expect(normalizarTexto('x¹²')).toBe('x^(12)');  // superindice de dos cifras
    expect(normalizarTexto('√16')).toBe('sqrt(16)');
    expect(normalizarTexto('√(x+1)')).toBe('sqrt(x+1)');
    expect(normalizarTexto('2 + 3')).toBe('2+3');   // NBSP
    expect(normalizarTexto('2**3')).toBe('2^3');
  });

  it('REGRESION: NFKC se come los superindices si se normaliza primero', () => {
    // 'x\u00B2' -> NFKC -> 'x2', que mathjs lee como la variable x2 y el
    // exponente se pierde en silencio. De ahi que expandirSuperindices vaya antes.
    expect(normalizarTexto('x\u00B2')).toBe('x^2');
    expect(v.verificarPaso('x\u00B2+1', 'x*x+1').veredicto).toBe('EQUIVALENTE');
    expect(v.verificarPaso('x\u00B2', 'x*2').veredicto).toBe('NO_EQUIVALENTE');
  });

  it('NO pasa a minusculas: X y x son variables distintas', () => {
    expect(normalizarTexto('X+x')).toBe('X+x');
    expect(v.verificarPaso('X - x', '0').veredicto).toBe('NO_EQUIVALENTE');
  });

  it('marca los no-cambios', () => {
    const r = v.verificarPaso('2 * x + 1', '2*x+1');
    expect(r.veredicto).toBe('EQUIVALENTE');
    expect(r.sinCambio).toBe(true);
    expect(r.capa).toBe(1);
  });
});

describe('extraccion de variables - la correccion que sostiene todo', () => {
  it('el nombre de una funcion tambien es un SymbolNode', () => {
    const n = math.parse('sin(x) + log(y) + z');
    const crudo = n.filter((nd: NodoMath) => nd.isSymbolNode === true).map((nd: NodoMath) => nd.name);
    expect(crudo).toEqual(['sin', 'x', 'log', 'y', 'z']); // <- el problema
    expect(nombresDeFuncion(n)).toEqual(new Set(['sin', 'log']));
    expect(variablesLibres(n)).toEqual(['x', 'y', 'z']);  // <- la correccion
  });

  it('excluye las constantes de mathjs', () => {
    expect(variablesLibres(math.parse('pi*r^2'))).toEqual(['r']);
    expect(variablesLibres(math.parse('e^x'))).toEqual(['x']);
  });

  it('sin la correccion, TODA expresion con funciones queda sin verificar', () => {
    // Medido: con los nombres de funcion en el scope, mathjs 15.2.0 lanza
    // "'sin' is not a function", la capa 3 se queda sin puntos validos y
    // el resultado cae a INDETERMINADO. Antes: 0/8. Ahora: 8/8.
    const casos: Array<[string, string, string]> = [
      ['sin(x)^2+cos(x)^2', '1', 'EQUIVALENTE'],
      ['sin(2*x)', '2*sin(x)*cos(x)', 'EQUIVALENTE'],
      ['sin(2*x)', '2*sin(x)', 'NO_EQUIVALENTE'],
      ['log(x*y)', 'log(x)+log(y)', 'EQUIVALENTE'],
      ['exp(a+b)', 'exp(a)*exp(b)', 'EQUIVALENTE'],
      ['tan(x)', 'sin(x)/cos(x)', 'EQUIVALENTE'],
    ];
    for (const [a, b, esperado] of casos) {
      expect(v.verificarPaso(a, b).veredicto, `${a} vs ${b}`).toBe(esperado);
    }
  });
});

describe('capa 2 - racionalizacion', () => {
  it('no usa symbolicEqual, que esta roto para esto', () => {
    const roto = math as unknown as { symbolicEqual: (a: string, b: string) => boolean };
    expect(roto.symbolicEqual('(x+1)^2', 'x^2+2*x+1')).toBe(false);
    expect(roto.symbolicEqual('sin(x)^2+cos(x)^2', '1')).toBe(false);
    // ...y sin embargo el verificador acierta en los dos:
    expect(v.verificarPaso('(x+1)^2', 'x^2+2*x+1').veredicto).toBe('EQUIVALENTE');
    expect(v.verificarPaso('sin(x)^2+cos(x)^2', '1').veredicto).toBe('EQUIVALENTE');
  });

  it('el test de cero va sobre el NUMERADOR, no sobre la cadena entera', () => {
    // rationalize devuelve "0 / (x^3 - x^2 - x + 1)", que no es la cadena "0".
    expect(math.rationalize('((x+1)/(x^2-1))-(1/(x-1))').toString()).not.toBe('0');
    expect(v.verificarPaso('(x+1)/(x^2-1)', '1/(x-1)').veredicto).toBe('EQUIVALENTE');
    expect(v.verificarPaso('(x^2-1)/(x-1)', 'x+1').veredicto).toBe('EQUIVALENTE');
  });

  it('REGRESION: un residuo de coma flotante no es prueba de desigualdad', () => {
    // rationalize('(2/4+1/3)-(10/12)') da -1.1102230246251565e-16, no 0.
    // Con la comparacion ingenua 'c !== 0' esto acusaba a un alumno que acerto.
    const residuo = math.rationalize('(2/4+1/3)-(10/12)').toString();
    expect(Number(residuo)).not.toBe(0);
    expect(Math.abs(Number(residuo))).toBeLessThan(1e-15);
    expect(v.verificarPaso('2/4 + 1/3', '10/12').veredicto).toBe('EQUIVALENTE');
    expect(v.verificarPaso('0.1+0.2', '0.3').veredicto).toBe('EQUIVALENTE');
  });

  it('cede el turno a la capa 3 cuando rationalize lanza', () => {
    expect(() => math.rationalize('(sin(x))-(sin(x))')).toThrow();
    expect(v.verificarPaso('sin(x)*2', 'sin(x)+sin(x)').veredicto).toBe('EQUIVALENTE');
  });
});

describe('capa 3 - muestreo y seguridad', () => {
  it('el generador es reproducible con la misma semilla', () => {
    const a = crearAleatorio(1234); const b = crearAleatorio(1234);
    for (let i = 0; i < 20; i += 1) expect(a()).toBe(b());
  });

  it('dos corridas dan el mismo veredicto', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(v.verificarPaso('sin(2*x)', '2*sin(x)*cos(x)').veredicto).toBe('EQUIVALENTE');
    }
  });

  it('con pocos puntos validos el veredicto es INDETERMINADO, nunca NO_EQUIVALENTE', () => {
    // Con sin() la capa 2 no puede (rationalize lanza) y decide la capa 3.
    const r = v.verificarPaso('sin(x)+1', 'sin(x)+2', { puntosMuestreo: 3, minimoPuntosValidos: 20 });
    expect(r.veredicto).toBe('INDETERMINADO');
    expect(r.veredicto).not.toBe('NO_EQUIVALENTE');
  });

  it('da un contraejemplo concreto cuando rechaza', () => {
    const r = v.verificarPaso('(x+1)^2', 'x^2+1');
    expect(r.veredicto).toBe('NO_EQUIVALENTE');
    expect(r.contraejemplo).toBeDefined();
    expect(r.contraejemplo?.escenario.x).toBeDefined();
    expect(r.contraejemplo?.valorA).not.toBe(r.contraejemplo?.valorB);
  });

  it('distanciaRelativa escala con la magnitud', () => {
    expect(distanciaRelativa({ re: 1e10, im: 0 }, { re: 1e10 + 1, im: 0 })).toBeLessThan(1e-9);
    expect(distanciaRelativa({ re: 1, im: 0 }, { re: 2, im: 0 })).toBeGreaterThan(0.4);
  });

  it('aComplejo rechaza lo que no es numero utilizable', () => {
    expect(aComplejo(3)).toEqual({ re: 3, im: 0 });
    expect(aComplejo(Infinity)).toBeNull();
    expect(aComplejo(NaN)).toBeNull();
    expect(aComplejo('x')).toBeNull();
    expect(aComplejo({ re: 1, im: 2 })).toEqual({ re: 1, im: 2 });
  });
});

describe('ecuaciones', () => {
  it('parte una ecuacion y reconoce las desigualdades', () => {
    expect(partirEcuacion('2*x+5=13')).toEqual({ izq: '2*x+5', der: '13' });
    expect(partirEcuacion('2*x+5')).toBeNull();
    expect(esDesigualdad('x<=3')).toBe(true);
    expect(esDesigualdad('x=3')).toBe(false);
  });

  it('acepta multiplicar los dos lados por una constante', () => {
    expect(v.verificarPaso('2*x=8', 'x=4').veredicto).toBe('EQUIVALENTE');
    expect(v.verificarPaso('x/3=4', 'x=12').veredicto).toBe('EQUIVALENTE');
  });

  it('rechaza un paso que cambia las soluciones', () => {
    expect(v.verificarPaso('2*x+5=13', '2*x=18').veredicto).toBe('NO_EQUIVALENTE');
    expect(v.verificarPaso('x^2=9', 'x=3').veredicto).toBe('NO_EQUIVALENTE'); // pierde x=-3
  });

  it('las desigualdades quedan para el nivel 3, sin inventar veredicto', () => {
    const r = v.verificarPaso('2*x<=8', 'x<=4');
    expect(r.veredicto).toBe('INDETERMINADO');
    expect(r.motivo).toContain('nivel 3');
  });

  it('no compara una ecuacion contra una expresion', () => {
    expect(v.verificarPaso('2*x=8', 'x').veredicto).toBe('INDETERMINADO');
  });
});

describe('limites conocidos y documentados', () => {
  it('el dominio positivo no ve los errores de signo bajo radical', () => {
    // sqrt(x^2) es |x|, no x. En dominio positivo son iguales y la capa 3 lo
    // acepta. Este caso tiene que cazarlo el nivel 1 por regla, no el muestreo.
    expect(v.verificarPaso('sqrt(x^2)', 'x').veredicto).toBe('EQUIVALENTE');
  });

  it('a cambio, log(x^2) -> 2*log(x) se acepta, que es lo que se ensena', () => {
    expect(v.verificarPaso('log(x^2)', '2*log(x)').veredicto).toBe('EQUIVALENTE');
  });
});
