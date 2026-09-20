# Calculadora con IA — monorepo

Calculadora nativa iOS + Android donde el estudiante escribe, dicta o teclea su
problema y la app lo resuelve **mostrando los pasos**. Espanol primero.

## La regla de arquitectura

> **El modelo de lenguaje NUNCA calcula.** Solo traduce lo que el estudiante
> escribio o dijo a una expresion matematica, y narra. Quien resuelve es un CAS.
> **Si el LLM produce un numero, es un bug.**

## Estructura

```
packages/mates-core/     Logica matematica. TypeScript puro, SIN React Native:
                         la bateria corre en CI en segundos, sin simulador.
  src/verificador/       Verificador de pasos en tres capas
  src/bateria/           271 casos del curriculo
apps/banco-riesgo/       Banco de pruebas de la fase 0 (no es la app)
docs/                    Resultados medidos
```

## Estado

| Fase | Que es | Estado |
|---|---|---|
| 0 | Tres pruebas de riesgo | (c) superada, (b) parcial, **(a) pendiente de iPhone** |
| 1 | Verificador + bateria en CI | **271/271, 100% deteccion, 100% aceptacion** |
| 2 | Calculadora nativa | no empezada |
| 3 | Clasificador, router, nivel 1 | no empezada |
| 4 | Servidor, SymPy, streaming | no empezada |
| 5 | Voz | no empezada |

## Correr las pruebas

```bash
cd packages/mates-core
npm install
npm test          # bateria + unitarias
npm run typecheck
```

## El verificador

Tres capas, se para en la primera que se pronuncie:

| Capa | Que hace | Para que sirve |
|---|---|---|
| 1 | Normaliza la cadena y compara | Descarta no-cambios. Traduce el Unicode real (−, ×, ², √, NBSP). |
| 2 | `rationalize(a-b)`, numerador = 0 | Exacta en polinomios y funciones racionales. |
| 3 | Muestreo en el plano complejo | Trigonometria, logaritmos, radicales. |

**Medido:** 271 casos, 100% de deteccion de errores (115/115), 100% de aceptacion
de pasos validos (156/156), **9,6 ms por paso**.

### Lo que no se puede tocar sin romperlo

Cada uno de estos puntos costo una depuracion y esta fijado con un test de regresion:

1. **`math.symbolicEqual` no se usa: esta roto.** Devuelve `false` para
   `('(x+1)^2','x^2+2*x+1')` y para `('sin(x)^2+cos(x)^2','1')`.

2. **En mathjs el nombre de una funcion TAMBIEN es un SymbolNode.**
   `filter(isSymbolNode)` sobre `sin(x)+log(y)+z` devuelve `['sin','x','log','y','z']`.
   Si esos nombres entran al scope, tapan a las funciones. **Medido: sin la
   correccion, 0 de 8 casos con funciones se verifican; con ella, 8 de 8.**

3. **El test de cero de la capa 2 va sobre el NUMERADOR.** `rationalize` devuelve
   `"0 / (x^3-x^2-x+1)"` para equivalencias buenas: comparar la cadena con `'0'`
   las rechazaria.

4. **Un residuo de coma flotante no es prueba de desigualdad.**
   `rationalize('(2/4+1/3)-(10/12)')` da `-1.11e-16`, no `0`. Con `c !== 0` el
   verificador acusaba de equivocarse a un alumno que habia acertado.

5. **Los superindices se expanden ANTES de `normalize('NFKC')`.** NFKC convierte
   `x²` en `x2`, que mathjs lee como una variable llamada `x2`: el exponente
   desaparece sin dar error.

6. **Sin evidencia suficiente, el veredicto es INDETERMINADO, jamas
   NO_EQUIVALENTE.** A un alumno no se le dice que se equivoco porque a nosotros
   nos falto muestra.

### Limite conocido

La capa 3 muestrea en **dominio positivo**, que es lo que garantiza que `sqrt` y
`log` esten definidos. El precio: no detecta errores de signo como
`sqrt(x^2) -> x`, validos en positivos y falsos en general. Esos tienen que
cazarse en el nivel 1 por regla. A cambio, `log(x^2) -> 2*log(x)` se acepta, que
es como se ensena en precalculo. Esta documentado con tests en ambos sentidos.
