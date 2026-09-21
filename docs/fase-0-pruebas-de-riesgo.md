# Fase 0 — Pruebas de riesgo

Estado a 21-sep-2026. **Las tres pruebas se ejecutaron en un iPhone 16 Pro Max
fisico con iOS 26.6.2.** Lo que dice "MEDIDO" se ejecuto de verdad y el comando esta
anotado. Lo que dice "PENDIENTE" no se ha probado y no se da por bueno.

| # | Prueba | Estado |
|---|---|---|
| a | TTS y reconocimiento de voz simultaneos en iOS sin realimentacion | **SUPERADA** (21-sep-2026, dispositivo real) |
| b | speech-rule-engine + Temml | **FALLA** — SRE tumba la app bajo Hermes |
| c | mathsteps-experimental-fork importando por ESM | **SUPERADA**, tambien en dispositivo |

---

## (a) Voz simultanea en iOS — SUPERADA

iPhone 16 Pro Max, iOS 26.6.2, altavoz del telefono (sin auriculares).

```
control: microfono oyo "Hola Hola de micro"      <- el microfono ESTA VIVO
  Ahora CALLATE: solo debe sonar el movil.
oido: "Control de microfono 123"                  <- sigue transcribiendo
  el TTS dice: "equis al cuadrado mas dos equis mas uno"
  transcrito mientras hablaba: "(nada)"           <- NO capto el TTS
RESULTADO: PASA
```

**La cancelacion de eco de iOS funciona con `iosVoiceProcessingEnabled: true`.**
El alumno podra interrumpir al tutor mientras habla. Era el riesgo numero uno del
proyecto y queda despejado.

### ⚠️ LA TRAMPA QUE CASI NOS DA UN FALSO "PASA"

La primera version de esta prueba **daba PASA sin medir nada**, tres veces
seguidas, una de ellas con un Mac hablando a todo volumen al lado.

La causa: arrancaba el reconocimiento **sin configurar la sesion de audio**. En
cuanto `Speech.speak()` empieza, iOS conmuta la sesion a reproduccion y el
microfono DEJA DE GRABAR. El log sale `no-speech / (nada)`, que es
**indistinguible** de "la cancelacion de eco funciono".

Faltaba esto, que el brief si especificaba:

```js
iosCategory: {
  category: 'playAndRecord',
  categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
  mode: 'measurement',
}
```

**Y la leccion general: la prueba necesitaba un CONTROL POSITIVO.** Ahora escucha
5 segundos antes del TTS y exige haber oido algo; si no oyo nada, el veredicto es
**INDETERMINADO**, nunca PASA. Es la misma regla que gobierna el verificador: sin
evidencia suficiente no se firma un veredicto.

### Lo que NO se ha medido

Solo se probo con el **altavoz del telefono**. Falta repetirlo con auriculares y
con el volumen al maximo, que es como lo usara un alumno haciendo deberes.

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

### Dos correcciones mas, medidas el 21-sep-2026 al escribir el adaptador

**5. La API NO esta en el `default`.** `mod.default` existe, pero NO trae
`assessUserStep` ni `assessUserEquationStep`: solo doce claves. El namespace del
modulo trae treinta y una, incluidas esas dos. Hay que quedarse con el namespace
entero (`import * as ms`), no con el default.

**6. `solveEquation` EXIGE `unknownVariable`.** Sin ella lanza `error: unset
unknown variable name`. Medido:

```
solveEquation({equationAsText: '2x + 5 = 13'})                      -> LANZA
solveEquation({equationAsText: '2x + 5 = 13', unknownVariable:'x'}) -> 6 pasos
```

**7. La mutacion en sitio es SOLO de `solveEquation`.** En `simplifyExpression`
cada paso trae un `rootNode` distinto y se puede guardar sin peligro. Comprobado:
`pasos.every(p => p.equation === pasos[0].equation)` es `true` en ecuaciones y
`false` en expresiones.

**8. El campo del paso de expresiones es `rootNode`, no `newNode`.** Un paso de
`simplifyExpression` tiene exactamente dos claves: `changeType` y `rootNode`.

### ⚠️ MATHSTEPS MIENTE SOBRE HABER RESUELTO

Es el hallazgo mas importante de esta prueba, y no estaba en el brief. mathsteps
etiqueta su ultimo paso como `solution` **aunque no haya resuelto nada**:

```
x^2 = 16          ->  2 pasos | solution: x^2 = 16        (no toco nada)
x^2 - 5x + 6 = 0  ->  5 pasos | solution: x^2 - 5x = -6   (a medio hacer)
x^2 - 9 = 0       ->  4 pasos | solution: x^2 = 9
sin(x) = 1/2      ->  3 pasos | solution: sin(x) = 1/2    (no toco nada)
```

**Esto contradice al brief**, que ponia las cuadraticas factorizables en el nivel
1 con el ejemplo `x^2=16 -> x=±4`. No es cierto en 0.9.12.

Y es peor que el caso de la trigonometria: alli simplemente no avanzaba; aqui
ademas dice que ha terminado. Un adaptador que se fie de `stepId === 'solution'`
le ensena al alumno su propio enunciado como si fuera la respuesta.

**Consecuencia de diseno:** el adaptador comprueba la FORMA del resultado
(`pareceResuelta`) y devuelve `resuelto: false` cuando no lo es, para que el
router escale al nivel 2 o 3. Nunca se propaga la etiqueta de mathsteps.

### Los radicales numericos SI salen, y eso cambia el router

```
sqrt(8)             -> 2 sqrt(2)     KEMU_SQRT_FROM_CONST
sqrt(12) + sqrt(3)  -> 3 * sqrt(3)
sqrt(50)            -> 5 sqrt(2)
sqrt(16)            -> 4             KEMU_ROOT_FROM_CONST
```

Aqui el brief acertaba. El router se afino: los radicales **sin variables** se
quedan en el nivel 1; los que llevan variables siguen yendo al nivel 2.

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

## (b) Temml + speech-rule-engine — ❌ FALLA EN DISPOSITIVO

**Medido el 21-sep-2026 en un iPhone 16 Pro Max con iOS 26.6.2, build de Release
con bytecode de Hermes real. La app MUERE:**

```
*** Terminating app due to uncaught exception 'RCTFatalException:
    Unhandled JS Exception: Error: Requiring unknown module "fs".'
App terminated due to signal 6.
```

La linea culpable, en `speech-rule-engine/js/common/system_external.js:30`:

```js
fs: documentSupported || webworker ? null : nodeRequire()('fs'),
```

SRE decide donde se ejecuta mirando si existe `window.document` o si es un
webworker. Bajo Hermes no hay ninguno de los dos, asi que concluye "estoy en
Node", llama a `require('fs')`, y como en React Native no existe, la app se cae.
**Es un fallo fatal, no una excepcion que se pueda atrapar**: el try/catch de la
prueba no llega a verlo.

Temml, en cambio, carga sin problema.

### Que hacer con esto

1. **Plan B del brief, ascendido a plan A:** ejecutar SRE en el servidor y
   cachear las cadenas de lectura. Las expresiones de un temario son finitas.
   ⚠️ Esto crea una dependencia nueva: **la voz ya no puede ir antes que el
   servidor** en el orden de fases.
2. **Alternativa sin probar:** enganar a SRE definiendo `window.document` para
   que se crea un navegador, ponga `fs = null` y cargue sus mathmaps por fetch.
   Ahorraria la dependencia de red, pero podria fallar mas adelante.

## (b) — medicion previa en Node (sigue siendo valida)

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
