import { describe, expect, it, beforeAll } from 'vitest';
import { crearVerificador, cargarMath } from '../src/verificador/index.js';
import type { Verificador, ResultadoVerificacion } from '../src/verificador/index.js';
import { BATERIA } from '../src/bateria/index.js';
import type { CasoBateria } from '../src/bateria/index.js';

interface Fallo { caso: CasoBateria; obtenido: ResultadoVerificacion; ms: number }

describe('bateria del curriculo', () => {
  let v: Verificador;
  const fallos: Fallo[] = [];
  let totalMs = 0;

  beforeAll(async () => {
    v = crearVerificador(await cargarMath());
    for (const caso of BATERIA) {
      const t0 = performance.now();
      const r = v.verificarPaso(caso.antes, caso.despues);
      const ms = performance.now() - t0;
      totalMs += ms;
      if (r.veredicto !== caso.espera) fallos.push({ caso, obtenido: r, ms });
    }
  });

  it('no deja ningun caso sin veredicto correcto', () => {
    if (fallos.length > 0) {
      const lineas = fallos.map((f) =>
        `  [${f.caso.id}] ${f.caso.area}\n` +
        `      ${f.caso.antes}  ->  ${f.caso.despues}\n` +
        `      esperado=${f.caso.espera}  obtenido=${f.obtenido.veredicto} (capa ${f.obtenido.capa})\n` +
        `      motivo: ${f.obtenido.motivo}` +
        (f.caso.nota ? `\n      nota del caso: ${f.caso.nota}` : ''),
      );
      throw new Error(
        `\n${fallos.length} de ${BATERIA.length} casos fallaron:\n\n${lineas.join('\n\n')}\n`,
      );
    }
    expect(fallos.length).toBe(0);
  });

  it('detecta el 100% de los pasos malos', () => {
    const malos = BATERIA.filter((c) => c.espera === 'NO_EQUIVALENTE');
    const noDetectados = fallos.filter((f) => f.caso.espera === 'NO_EQUIVALENTE');
    const tasa = ((malos.length - noDetectados.length) / malos.length) * 100;
    console.log(`  deteccion de errores: ${tasa.toFixed(1)}% (${malos.length - noDetectados.length}/${malos.length})`);
    expect(noDetectados.length).toBe(0);
  });

  it('acepta el 100% de los pasos buenos', () => {
    const buenos = BATERIA.filter((c) => c.espera === 'EQUIVALENTE');
    const rechazados = fallos.filter((f) => f.caso.espera === 'EQUIVALENTE');
    const tasa = ((buenos.length - rechazados.length) / buenos.length) * 100;
    console.log(`  aceptacion de pasos validos: ${tasa.toFixed(1)}% (${buenos.length - rechazados.length}/${buenos.length})`);
    expect(rechazados.length).toBe(0);
  });

  it('se mantiene por debajo de 25 ms por paso de media', () => {
    const media = totalMs / BATERIA.length;
    console.log(`  ${BATERIA.length} casos | ${totalMs.toFixed(0)} ms totales | ${media.toFixed(2)} ms por paso`);
    expect(media).toBeLessThan(25);
  });
});
