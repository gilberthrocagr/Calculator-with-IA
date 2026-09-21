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
  src/router/            Clasificador y router: que motor atiende cada entrada
  src/errores/           Catalogo de errores tipicos, detectados sin LLM
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
| 3 | Clasificador, router, nivel 1 | **router hecho, 38 tests**; falta el adaptador N1 |
| 5 | Tutor: catalogo de errores | **catalogo hecho, 40% medido**; faltan maquina de estados y escalera |
| 4 | Servidor, SymPy, streaming | no empezada |
| 5 | Voz | no empezada |

## Correr las pruebas

```bash
cd packages/mates-core
npm install
npm test          # bateria + unitarias
npm run typecheck
```

## El router

Decide que motor atiende cada entrada. **No ejecuta nada y no abre red:** devuelve
la decision con su motivo y sus rasgos, para que sea auditable y para que la
bateria de enrutado corra en CI sin motores ni servidor.

| Nivel | Motor | Que le toca |
|---|---|---|
| 1 | mathsteps-experimental-fork | Aritmetica, fracciones, terminos semejantes, distributiva, lineales de una variable |
| 2 | nerdamer-prime | Cuadraticas, factorizacion, radicales, funciones racionales |
| 3 | SymPy en servidor | Trascendentes, desigualdades, grado >= 3, varias variables, lo que no parsea |

**La regla que justifica el modulo:** mathsteps NO lanza con trigonometria.
`solveEquation('sin(x) = 1/2')` devuelve 3 pasos y la ecuacion sin tocar, sin un
solo error en el log. Por eso `sin/cos/tan/log/ln/exp` (y sus inversas,
hiperbolicas y variantes) se bloquean **antes del nivel 1**, no solo antes de
nerdamer. Hay test de regresion.

La **operacion** (`simplificar`, `resolver`, `factorizar`, `expandir`) es parte de
la peticion, no algo que se adivine: `x^2-1` expandido lo hace el nivel 1 y
factorizado no, porque mathsteps no factoriza. `auto` resuelve si hay `=` y
simplifica si no.

El **area del temario** es solo una pista para la interfaz y las metricas: el
router **no** la usa para enrutar. De una expresion suelta no se deduce si el
alumno queria factorizar o expandir, asi que sin senal clara vale `desconocida`.

## El catalogo de errores

Detecta el error concreto del alumno **sin gastar un token**. No adivina: para
cada error del catalogo predice que habria escrito el alumno si lo hubiera
cometido, y compara esa prediccion con lo que escribio usando el verificador.
Un diagnostico afirmado esta **probado**, no supuesto, y la prediccion queda
guardada para poder auditarlo.

**Medido sobre la bateria** (21-sep-2026): explica **46 de los 115 pasos malos
(40,0%)** con **0 falsos positivos sobre los 156 pasos buenos**.

El cero es el numero que manda. Acusar a un alumno de un error que no cometio es
peor que no diagnosticar nada: rompe su confianza justo cuando acaba de hacerlo
bien. La cobertura se sube despues; un falso positivo no se perdona. Cuando
ningun patron encaja, la respuesta es "no lo se" y el tutor pregunta.

Doce patrones, en dos familias: los de expresiones (linealidad ilusoria,
distribucion parcial, signo al distribuir, cancelacion ilegal, terminos no
semejantes, operaciones de fracciones en linea, reglas de exponentes mezcladas,
coeficientes multiplicados) y los de ecuaciones, que van por otro camino porque
mathjs lee el `=` como asignacion (transposicion sin cambio de signo, balance
roto).

Cada entrada del catalogo nombra la **creencia**, no el sintoma: en la cabeza del
alumno hay una regla, y si el tutor no la nombra, la regla sobrevive y el error
vuelve al ejercicio siguiente. Ante linealidad ilusoria y cancelacion ilegal la
respuesta por defecto es un **contraejemplo numerico** calculado, no el enunciado
de la regla correcta: `(3+4)^2 = 49` pero `9+16 = 25`.

`erroresDelArea(area)` existe por un numero: un LLM acierta el diagnostico el
**52,96%** con el catalogo entero delante y el **73,82%** restringido al tema del
problema. Al prompt del tutor nunca se le pasan los doce, solo los de su area.

## El verificador

Tres capas, se para en la primera que se pronuncie:

| Capa | Que hace | Para que sirve |
|---|---|---|
| 1 | Normaliza la cadena y compara | Descarta no-cambios. Traduce el Unicode real (−, ×, ², √, NBSP). |
| 2 | `rationalize(a-b)`, numerador = 0 | Exacta en polinomios y funciones racionales. |
| 3 | Muestreo en el plano complejo | Trigonometria, logaritmos, radicales. |

**Medido:** 271 casos, 100% de deteccion de errores (115/115), 100% de aceptacion
de pasos validos (156/156), **4,9 ms por paso**.

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

7. **El grado leido del arbol es el SINTACTICO, no el real.** Sobre la forma
   anulada de `x^2 + x = x^2 + 3` el recorrido da 2 porque ve un `x^2`;
   `rationalize` lo colapsa a `x - 3`, grado 1. Sin pasar por `rationalize`, una
   ecuacion lineal de verdad se va al nivel 2. El recorrido del arbol queda de
   reserva para cuando `rationalize` lanza (funciones, exponentes no enteros),
   que es justo donde el recorrido ya responde `null`.

8. **El exponente de una potencia no siempre es un ConstantNode.** Medido en
   mathjs 15.2.0: en `x^(1/2)` es un **ParenthesisNode** y en `x^-1` es un
   OperatorNode. Mirando solo `isConstantNode`, `x^(1/2)` no se reconocia como
   radical y se colaba al nivel 1: justo lo que el router existe para evitar.
   Si el subarbol no tiene variables libres, se evalua.

### Limite conocido

La capa 3 muestrea en **dominio positivo**, que es lo que garantiza que `sqrt` y
`log` esten definidos. El precio: no detecta errores de signo como
`sqrt(x^2) -> x`, validos en positivos y falsos en general. Esos tienen que
cazarse en el nivel 1 por regla. A cambio, `log(x^2) -> 2*log(x)` se acepta, que
es como se ensena en precalculo. Esta documentado con tests en ambos sentidos.
