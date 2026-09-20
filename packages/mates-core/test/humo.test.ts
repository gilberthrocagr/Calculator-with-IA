import { describe, expect, it, beforeAll } from 'vitest';
import { crearVerificador, cargarMath } from '../src/verificador/index.js';
import type { Verificador } from '../src/verificador/index.js';

describe('humo', () => {
  let v: Verificador;
  beforeAll(async () => { v = crearVerificador(await cargarMath()); });

  it('acepta un paso bueno de fracciones', () => {
    expect(v.verificarPaso('2/4 + 1/3', '10/12').veredicto).toBe('EQUIVALENTE');
  });
  it('rechaza la suma cruzada', () => {
    expect(v.verificarPaso('2/4 + 1/3', '3/7').veredicto).toBe('NO_EQUIVALENTE');
  });
  it('acepta el binomio', () => {
    expect(v.verificarPaso('(x+1)^2', 'x^2+2*x+1').veredicto).toBe('EQUIVALENTE');
  });
  it('acepta la identidad pitagorica (donde symbolicEqual falla)', () => {
    expect(v.verificarPaso('sin(x)^2+cos(x)^2', '1').veredicto).toBe('EQUIVALENTE');
  });
  it('acepta un paso bueno de ecuacion', () => {
    expect(v.verificarPaso('2x + 5 = 13', '2x = 8').veredicto).toBe('EQUIVALENTE');
  });
  it('rechaza un paso malo de ecuacion', () => {
    expect(v.verificarPaso('2x + 5 = 13', '2x = 18').veredicto).toBe('NO_EQUIVALENTE');
  });
});
