# Fase 0 — Pruebas de riesgo

Estado a 20-sep-2026. Lo que dice "MEDIDO" se ejecuto de verdad y el comando esta
anotado. Lo que dice "PENDIENTE" no se ha probado y no se da por bueno.

| # | Prueba | Estado |
|---|---|---|
| a | TTS y reconocimiento de voz simultaneos en iOS sin realimentacion | **PENDIENTE — necesita iPhone real** |
| b | speech-rule-engine + Temml | **PARCIAL — cadena verificada en Node, falta Hermes en dispositivo** |
| c | mathsteps-experimental-fork importando por ESM | **SUPERADA** |

---

## (c) mathsteps-experimental-fork — SUPERADA

`mathsteps-experimental-fork@0.9.12`, Node 22.

### El CJS esta roto, tal y como decia el brief

```
require('mathsteps-experimental-fork')
  -> ReferenceError: exports is not defined in ES module scope
import('mathsteps-experimental-fork')
  -> OK
```

El `package.json` del paquete trae `"type": "module"` con `exports` condicionales
(`import` -> `dist/es/`, `require` -> `dist/cjs/`), pero el build CJS se genero mal.
**En Metro hay que activar `unstable_enablePackageExports`** o la condicion `import`
no se resuelve. Confirmada la recomendacion de vendorizarlo.

### El API no es el que asumia el brief. Cuatro correcciones

**1. Los pasos salen por callback, no por el retorno.**
`simplifyExpression` esta declarado `=> any` y no devuelve un array:

```js
const pasos = [];
ms.simplifyExpression({ expressionAsText: '2/4 + 1/3', onStepCb: (s) => pasos.push(s) });
```

**2. Expresiones y ecuaciones usan campos distintos.**

| | funcion | campo del tipo de paso | formato |
|---|---|---|---|
| Expresiones | `simplifyExpression` | `changeType` | `COMMON_DENOMINATOR` |
| Ecuaciones | `solveEquation` | `stepId` | `move_c_to_right` |

**3. `assessUserStep` es SOLO para expresiones.** Con una ecuacion lanza
`Invalid left hand side of assignment operator =`. Para ecuaciones hay que usar
`assessUserEquationStep`, que ademas devuelve otra forma: no trae `isValid`, sino
`{left, right, attemptedEquationChangeType, equationErrorType, reachesOriginalAnswer}`.
El discriminante de error es la PRESENCIA de `equationErrorType`.

**4. LA TRAMPA GORDA: el objeto `Equation` se muta en sitio.**

Todos los pasos que entrega `onStepCb` comparten la MISMA instancia. Si se guardan
los objetos y se serializan despues, los seis pasos muestran la respuesta final:

```
  Serializando DENTRO del callback        Guardando el objeto y serializando despues
  solving         2x + 5 = 13             solving         x = 4
  move_c_to_right 2x = 13 - 5             move_c_to_right x = 4
  simplify_right  2x = 8                  simplify_right  x = 4
  div_by_c        x = 8/2                 div_by_c        x = 4
  simplify_right  x = 4                   simplify_right  x = 4
```

Hay que llamar a `equation.toString()` o `equation.getAsTeX()` **dentro** del
callback. Verificado: `pasos.every(p => p.equation === pasos[0].equation) === true`.

### Trigonometria: no lanza, se queda callado

`solveEquation('sin(x) = 1/2')` no da error: devuelve 3 pasos y la ecuacion sin
tocar. El alumno veria "3 pasos" que no llevan a ninguna parte. **El router tiene
que bloquear sin/cos/tan/log/ln/exp ANTES del nivel 1**, no solo antes de nerdamer.

### Lo bueno

`StepInfo` trae justo lo que hace falta para corregir al alumno:
`isValid`, `attemptedChangeType`, `mistakenChangeType`, `availableChangeTypes`,
`allPossibleCorrectTos`. Y los pasos con nombre de regla son reales:

```
"(x+2)(x+3)" -> 11 pasos
   KEMU_DISTRIBUTE_MUL_OVER_ADD    x * (x + 3) + 2(x + 3)
   COLLECT_AND_COMBINE_LIKE_TERMS  1x^2 + (3 + 2) * x + 6
   SIMPLIFY_ARITHMETIC__ADD        x^2 + 5x + 6
```

---

## (b) Temml + speech-rule-engine — PARCIAL

`temml@0.13.5`, `speech-rule-engine@5.0.0-rc.4`. **Ojo: SRE va por release
candidate, no por estable.**

### MEDIDO: ClearSpeak en espanol cae en silencio. Confirmado

```
  locale=es  domain='mathspeak'  -> SRE reporta 'mathspeak'
  locale=es  domain='clearspeak' -> SRE reporta 'mathspeak'   <-- sin error ninguno
  locale=en  domain='clearspeak' -> SRE reporta 'clearspeak'
```

La diferencia de calidad entre los dos estilos, sobre el mismo limite:

| | |
|---|---|
| es / mathspeak | `límite bajoíndice x flecha derecha 0 finalizar índices empezar fracción seno x entre x finalizar fracción` |
| en / clearspeak | `lim over x right arrow 0 of sine x over x` |

Es exactamente el problema que anticipaba el brief, y se puede detectar en
tiempo de ejecucion: `sre.engineSetup().domain` devuelve lo que SRE uso DE VERDAD.
**Hay que comprobarlo tras cada `setupEngine` y no fiarse de lo que se pidio.**

### MEDIDO: el espanol es mejor de lo que temiamos, y el trabajo esta acotado

Pasando 12 expresiones del curriculo, lo simple sale bien tal cual:

| LaTeX | SRE espanol | ¿sirve? |
|---|---|---|
| `x^2 + 2x + 1` | x al cuadrado más 2 x más 1 | si |
| `2x + 5 = 13` | 2 x más 5 igual 13 | si |
| `\sin^2 x + \cos^2 x = 1` | seno al cuadrado x más coseno al cuadrado x igual 1 | si |
| `\frac{2}{4}` | **empezar fracción** 2 entre 4 **finalizar fracción** | no |
| `\sqrt{x+1}` | **empezar raíz cuadrada** x más 1 **finalizar raíz cuadrada** | no |
| `x^{-2}` | x **superíndice** menos 2 | no |
| `\log_{10}(100)` | logaritmo **subíndice** 10 **línea base** paréntesis izquierdo 100 paréntesis derecho | no |

Lo que falla no son 30-50 casos sueltos: son **unos 15-20 marcadores
estructurales** que se repiten. Una tabla de sustitucion sobre esos patrones
(`empezar/finalizar fracción`, `empezar/finalizar raíz`, `superíndice`,
`subíndice ... línea base`, `bajoíndice`, `finalizar índices`,
`paréntesis izquierdo/derecho`) cubre casi todo el temario. Es bastante menos
trabajo del presupuestado.

### MEDIDO: el bundle

| | crudo | gzip |
|---|---|---|
| `base.json` | 216 KB | 25 KB |
| `en.json` | 356 KB | 43 KB |
| `es.json` | 248 KB | 33 KB |
| **base + en + es** | **820 KB** | **101 KB** |
| los 16 locales (mathmaps) | 4.2 MB | — |
| paquete completo | 8.8 MB | — |

El brief decia "~192 KB" para es+en: la cifra real es **101 KB gzip / 820 KB
crudos**, y hay que contar `base.json`, que no es opcional.

### MEDIDO: velocidad (Node, no Hermes)

12 expresiones, 70 ms de SRE en total, **5,9 ms cada una**. Arranque del motor
incluido, el corpus entero tarda 80 ms.

### Lo que queda PENDIENTE de esta prueba

Que SRE 5.0.0-rc.4 y Temml **arranquen bajo Hermes en dispositivo real** y cuanto
tardan alli. Node no responde esa pregunta: SRE carga sus mathmaps como JSON y usa
XML, y ahi es donde Hermes suele romperse.

---

## (a) Voz simultanea en iOS — PENDIENTE

**No se ha probado. Requiere un iPhone fisico**, y es el riesgo numero uno del
proyecto segun el propio brief: si el microfono capta el TTS, el sistema se
escucha a si mismo en bucle y la funcion de voz no existe.

No se puede simular: depende de `iosVoiceProcessingEnabled` y de como el hardware
hace la cancelacion de eco. Ver `apps/banco-riesgo/LEEME.md` para el procedimiento.
