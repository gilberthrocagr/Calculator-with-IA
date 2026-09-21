# CLAUDE.md — Calculadora con IA

Contexto permanente del proyecto. Léelo antes de tocar nada.

> ⛔ **Este proyecto NO tiene ninguna relación con Deliservy.** No toques, clones
> ni leas nada de la organización `sistemas-deliservy`. Ni código, ni credenciales,
> ni memoria. Son mundos separados.

- **Repo:** https://github.com/gilberthrocagr/Calculator-with-IA (privado, cuenta personal)
- **Ruta local:** `~/proyectos/calculator-with-ia`
- **Idioma:** todo el código, los comentarios, los commits y los textos en **español**.

---

## Qué es

Calculadora nativa iOS + Android donde el estudiante escribe, dicta o teclea su
problema (aritmética, fracciones, álgebra, precálculo) y la app lo resuelve
**mostrando los pasos**. Entrada por teclado matemático, chat y voz. Salida en
pantalla y leída en voz alta. Español primero, inglés después.

## Las cuatro invariantes de diseño

**1. El modelo de lenguaje NUNCA calcula.**
> Solo traduce lo que el estudiante escribió o dijo a una expresión matemática,
> y narra. Quien resuelve es un CAS. **Si el LLM produce un número, es un bug.**

**2. Ningún paso se muestra sin verificar.**
> Los benchmarks públicos miden la respuesta final, no la corrección de los pasos
> intermedios. Una app que muestra pasos expone justo lo que nadie mide.

**3. La pedagogía vive en código, no en el prompt.**
> Una máquina de estados decide qué nivel de pista toca; el prompt es solo la capa
> de tono. El equipo de Harvard lo dice literal tras lograr d=0,63: «a system
> prompt could not reliably provide enough structure to scaffold problems».
> Medido (PNAS 2025, ~1.000 alumnos): un LLM sin guardarraíles da **+48% de
> rendimiento durante la práctica y −17% en el examen sin ayuda**, y el alumno no
> percibe la degradación. Con guardarraíles el daño desaparece. Los guardarraíles
> que funcionaron no son de tono: solución verificada inyectada en el prompt,
> pistas incrementales y catálogo de errores típicos.

**4. La expresión reconocida se confirma antes de resolver.**
> El reconocimiento de voz tiene **29–35% de error en fórmulas** (hasta 35% con
> voces infantiles). Renderizar lo entendido y pedir un toque convierte un error
> silencioso en una corrección barata. No es un extra de UX, es un requisito.

---

## Estado de las fases

| Fase | Qué es | Estado |
|---|---|---|
| 0(c) | mathsteps por ESM | **SUPERADA** |
| 0(b) | Temml + speech-rule-engine | ❌ **FALLA** — SRE tumba la app bajo Hermes (`require("fs")`) |
| 0(a) | Voz simultánea en iOS | ✅ **SUPERADA** (21-sep-2026, iPhone 16 Pro Max) |
| 1 | Verificador + batería | **HECHA, 100%** |
| 2 | Calculadora nativa | no empezada |
| 3 | Clasificador + router + N1 | **HECHA** — router (42 tests) + adaptador N1 (17 tests) |
| 4 | Servidor + SymPy + streaming | no empezada |
| 5 | **Tutor** — máquina de estados, escalera de pistas, catálogo de errores | **catálogo de errores HECHO** (16 tests, 40% medido); faltan máquina de estados y escalera |
| 6 | Voz | no empezada |
| 7 | **Foto / OCR** del cuaderno | no empezada |
| 8 | **Lanzamiento** — legal, tiendas, accesibilidad, precio | no empezada |

**No se avanza de fase sin que la anterior tenga pruebas que pasen.**

⚠️ **Dependencia nueva del 21-sep-2026:** como SRE no corre en el dispositivo, la
lectura en voz alta tiene que calcularse en el servidor y cachearse. Eso significa
que **la fase 6 (voz) ya no puede ir antes que la fase 4 (servidor)**.

⚠️ **La numeración del «Plan técnico» en PDF NO es esta.** Allí la fase 3 es el
backend y la 4 el tutor. Cuando alguien diga «fase N», confirmar de qué documento
habla. Esta tabla es la que manda en el repo.

Las fases 5, 7 y 8 se añadieron el 21-sep-2026 al revisar el plan en PDF: no
existían en el roadmap y son producto, no extras. La 5 es la que convierte esto
de «calculadora que explica» en tutor.

---

## Verificar la batería (lo primero de cada sesión)

```bash
cd ~/proyectos/calculator-with-ia
npm install
cd packages/mates-core && npm test
```

Tiene que dar exactamente: **271 casos, 100% de detección (115/115), 100% de
aceptación (156/156), 34 tests en verde.** Si no da eso, **parar y avisar antes
de tocar nada**.

Última verificación: **21-sep-2026, todo en verde** (107/107, 115/115, 156/156).
`npm run typecheck` también pasa. Medido en esta máquina: **~4,9 ms por paso**
(el README decía 9,6 ms de una máquina más lenta; ya está actualizado. El test
solo exige estar por debajo de 25 ms).

CI (`.github/workflows/ci.yml`) corre en cada push y pull request: Node 22,
`npm run typecheck` y luego `npm test` sobre `packages/mates-core`.
Local va con Node 24.14.1 / npm 11.11.0; ambos pasan.

---

## Las seis cosas que NO hay que revertir

Cada una costó una depuración y tiene test de regresión. Detalle completo en el
README, sección «Lo que no se puede tocar sin romperlo».

1. **`math.symbolicEqual` está roto. No usarlo.** Devuelve `false` para
   `('(x+1)^2','x^2+2*x+1')` y para `('sin(x)^2+cos(x)^2','1')`.
2. **En mathjs el nombre de una función TAMBIÉN es un SymbolNode.** Sin restarlos
   del scope tapan a las funciones: **0 de 8 casos con funciones se verifican**;
   con la corrección, 8 de 8.
3. **El test de cero de la capa 2 va sobre el NUMERADOR de `rationalize`**, no
   sobre la cadena entera (devuelve `"0 / (x^3-x^2-x+1)"` en equivalencias buenas).
4. **Un residuo de coma flotante NO es prueba de desigualdad.**
   `rationalize('(2/4+1/3)-(10/12)')` da `-1.11e-16`, no `0`.
5. **Los superíndices se expanden ANTES de `normalize('NFKC')`.** NFKC convierte
   `x²` en `x2`, que mathjs lee como una variable `x2`: el exponente desaparece
   sin dar error.
6. **Sin evidencia suficiente el veredicto es INDETERMINADO, jamás NO_EQUIVALENTE.**
   A un alumno no se le dice que se equivocó por un fallo nuestro de muestreo.
7. **El grado leído del árbol es el SINTÁCTICO, no el real.** `x^2 + x = x^2 + 3`
   da 2 en el recorrido y 1 tras `rationalize`. Sin `rationalize`, una lineal de
   verdad se va al nivel 2. El recorrido queda de reserva para cuando
   `rationalize` lanza (funciones, exponentes no enteros).
8. **El exponente de una potencia no siempre es un `ConstantNode`.** En `x^(1/2)`
   es un **ParenthesisNode** y en `x^-1` un OperatorNode. Mirando solo
   `isConstantNode`, `x^(1/2)` no se detectaba como radical y se colaba al nivel 1.

### Límite conocido del verificador

La capa 3 muestrea en **dominio positivo** (es lo que garantiza que `sqrt` y `log`
estén definidos). El precio: no detecta errores de signo como `sqrt(x^2) -> x`.
Esos hay que cazarlos en el nivel 1 por regla. A cambio `log(x^2) -> 2*log(x)` se
acepta, que es como se enseña en precálculo.

---

## Estructura

```
packages/mates-core/     Lógica matemática. TypeScript puro, SIN React Native:
                         la batería corre en CI en segundos, sin simulador.
  src/verificador/       Verificador de pasos en tres capas
  src/bateria/           271 casos del currículo
apps/banco-riesgo/       Banco de pruebas de la fase 0 (no es la app)
docs/                    Resultados medidos
```

El verificador para en la primera capa que se pronuncie:

| Capa | Qué hace | Para qué sirve |
|---|---|---|
| 1 | Normaliza la cadena y compara | Descarta no-cambios. Traduce el Unicode real (−, ×, ², √, NBSP). |
| 2 | `rationalize(a-b)`, numerador = 0 | Exacta en polinomios y funciones racionales. |
| 3 | Muestreo en el plano complejo | Trigonometría, logaritmos, radicales. |

---

## Stack para las fases que faltan

- **Expo SDK 57 / RN 0.86**, New Architecture. **Development build desde el día 1,
  Expo Go no sirve. No bajar de 57.0.17.**
- **Motores:**
  - N1 `mathsteps-experimental-fork` 0.9.12 (offline, pasos con nombre de regla)
  - N2 `nerdamer-prime` 1.5.0 (**NO** el nerdamer clásico)
  - N3 SymPy 1.14 en servidor
  - N4 el LLM **solo traduce enunciados**
- **El router debe BLOQUEAR `sin/cos/tan/log/ln/exp` ANTES del nivel 1.** Medido:
  mathsteps no lanza con trigonometría, devuelve la ecuación sin tocar y el alumno
  vería «3 pasos» que no llevan a ninguna parte.
- **mathjs 15.2.0** con `import()` diferido, nunca al arrancar.
- **Campo matemático:** MathLive 0.110.0 en WebView + teclado **nativo** por encima.
  Pasos: KaTeX en **un solo** WebView. **Exactamente DOS WebViews en toda la app.**
- **Persistencia:** `expo-sqlite` con `PRAGMA journal_mode = WAL`.
- **La API key del modelo vive SOLO en el servidor, nunca en la app.**

### Trampas ya medidas de la fase 0 (ver `docs/fase-0-pruebas-de-riesgo.md`)

- **mathsteps:** el CJS está roto; hay que importarlo por ESM y activar
  `unstable_enablePackageExports` en Metro. Se recomienda vendorizarlo.
- Los pasos salen **por callback** (`onStepCb`), no por el retorno.
- Expresiones usan `changeType`; ecuaciones usan `stepId`. `assessUserStep` es
  **solo** para expresiones; para ecuaciones, `assessUserEquationStep`.
- **El objeto `Equation` se muta en sitio:** hay que llamar a `toString()` /
  `getAsTeX()` **dentro** del callback o los seis pasos muestran la respuesta final.
- **SRE:** ClearSpeak en español cae a `mathspeak` **en silencio**. Comprobar
  `sre.engineSetup().domain` tras cada `setupEngine` y no fiarse de lo que se pidió.
- El bundle real de SRE es **101 KB gzip / 820 KB crudos** (base + en + es), no los
  ~192 KB del brief; `base.json` no es opcional.

---

## Cómo quiere trabajar Gilberth

- **Preguntar antes de asumir** cosas del servidor o del alcance.
- **No avanzar de fase** sin que la anterior tenga pruebas que pasen.
- Si algo que él dio por cierto está mal, **decírselo con la medición delante**.
  Ya pasó cinco veces y las cinco valieron la pena.
- Verificar de verdad antes de afirmar que algo está hecho.

---

## El router (fase 3, hecho)

`packages/mates-core/src/router/`. Decide el nivel y **no ejecuta nada ni abre
red**: devuelve la decisión con su motivo y sus rasgos.

- Nivel 1 mathsteps · Nivel 2 nerdamer-prime · Nivel 3 SymPy en servidor.
  No hay nivel 4 aquí: al router le llega la expresión ya en notación matemática.
- **Las trascendentes se bloquean antes del nivel 1** (la familia completa:
  inversas, hiperbólicas, `log10`/`log2`, y `ln` aunque mathjs no la conozca).
  Test de regresión sobre `sin(x) = 1/2`.
- La **operación** (`simplificar`/`resolver`/`factorizar`/`expandir`) es parte de
  la petición. `auto` resuelve si hay `=`, simplifica si no.
- El **área** del temario es solo pista para la interfaz; el router no la usa
  para enrutar, y vale `desconocida` cuando no hay señal clara.

Lo que falta de la fase 3: el **adaptador N1** de mathsteps, con la trampa del
objeto `Equation` mutable resuelta (llamar a `toString()` dentro del callback).

## El catálogo de errores (fase 5, primera pieza)

`packages/mates-core/src/errores/`. Detecta el error concreto del alumno **sin
LLM**. Es el primero de los tres guardarraíles que, medidos en PNAS 2025,
eliminaron el daño al aprendizaje.

**Cómo funciona, y por qué es fiable:** no adivina el error. Para cada entrada del
catálogo **predice** qué habría escrito el alumno si hubiera cometido ese error, y
compara la predicción con lo que escribió usando el verificador de tres capas. Un
diagnóstico afirmado está **probado**; la predicción queda guardada para auditarlo.

**Medido el 21-sep-2026: 46/115 pasos malos explicados (40,0%), 0 falsos
positivos sobre 156 pasos buenos.**

- ⚠️ **El cero es el número que manda.** Acusar a un alumno de un error que no
  cometió es peor que no diagnosticar: rompe su confianza justo cuando acaba de
  hacerlo bien. Hay test que lo fija. La cobertura es un suelo, no un objetivo.
- Cuando ningún patrón encaja, `errores` viene vacío y `hayError` es `true`: el
  paso está mal pero no sabemos por qué, y el tutor **pregunta** en vez de afirmar.
- Si el verificador dice INDETERMINADO, no se diagnostica nada.
- Las **ecuaciones van por otro camino**: mathjs lee el `=` como asignación y
  lanza, así que hay que partirlas con `partirEcuacion` antes de predecir.
- Cada entrada nombra la **creencia**, no el síntoma. Si el tutor no nombra la
  regla que el alumno cree tener, la regla sobrevive y el error vuelve.
- `erroresDelArea(area)` existe por un número: el LLM acierta el diagnóstico el
  **52,96%** con el catálogo entero y el **73,82%** restringido al tema. Nunca
  pasarle los doce al prompt, solo los de su área.

**Lo que no cubre y por qué** (medido, no supuesto): factorización 0/9 — «pareja
que suma bien pero no multiplica» no es un patrón estructural, es una elección
equivocada. Aritmética 5/15 — la mayoría son errores de orden de operaciones
(`2+3*4 → 20`), que necesitan otro tipo de detector. Ahí es donde el LLM sí
aporta, con el catálogo del área delante.

## Fase 0, cerrada el 21-sep-2026 en un iPhone real

- **(a) voz simultánea: SUPERADA.** La cancelación de eco funciona con
  `iosVoiceProcessingEnabled: true`. El alumno podrá interrumpir al tutor.
  ⚠️ Solo probado con el **altavoz**; falta con auriculares y a volumen máximo.
  ⚠️ **La prueba daba un falso PASA** por no configurar `iosCategory:
  playAndRecord`: al hablar el TTS, iOS apagaba el micrófono y el log salía
  igual que si la cancelación funcionara. Ahora lleva **control positivo** y sin
  él el veredicto es INDETERMINADO.
- **(b) SRE bajo Hermes: FALLA.** `RCTFatalException: Requiring unknown module
  "fs"`. En `system_external.js:30` SRE decide que está en Node porque no hay
  `window.document`, y pide `fs`. Fatal, no atrapable. Temml sí carga.
- **(c) mathsteps por ESM: SUPERADA** también en dispositivo — importa en
  ~550–670 ms y da los 6 pasos con nombre de regla.

## El nivel 1 (fase 3, completa) — ⚠️ mathsteps miente

`packages/mates-core/src/motor/n1.ts`. Único motor con **pasos con nombre de
regla**, offline. `import()` diferido: su CJS está roto.

**El hallazgo del 21-sep-2026, que no estaba en ningún brief: mathsteps etiqueta
su último paso como `solution` aunque no haya resuelto.**

```
x^2 = 16          ->  solution: x^2 = 16        (no tocó nada)
x^2 - 5x + 6 = 0  ->  solution: x^2 - 5x = -6   (a medio hacer)
sin(x) = 1/2      ->  solution: sin(x) = 1/2
```

Peor que el fallo conocido de la trigonometría: allí no avanzaba, aquí además
dice que terminó. El adaptador **comprueba la forma** con `pareceResuelta()` y
devuelve `resuelto: false`; nunca propaga la etiqueta. Un falso «no resuelta»
cuesta escalar al nivel 2; un falso «resuelta» le enseña al alumno su propio
enunciado como respuesta.

Otras cuatro cosas medidas, ninguna en el brief:

- **La API no está en `mod.default`** (12 claves, sin `assessUserStep`), sino en
  el namespace del módulo (31 claves). Usar `import * as ms`.
- **`solveEquation` exige `unknownVariable`**. Sin ella lanza `unset unknown
  variable name`.
- **La mutación en sitio es solo de `solveEquation`.** En `simplifyExpression`
  cada paso trae un `rootNode` distinto y se puede guardar.
- **El campo del paso de expresiones es `rootNode`, no `newNode`.**

Y el router se afinó con lo medido: **radicales sin variables → nivel 1**
(`sqrt(8) → 2 sqrt(2)`, KEMU); con variables → nivel 2. Cuadráticas → nivel 2.

## El servidor (fase 4) — y cómo NO tocar Deliservy

Hoy **no hay nada alojado** y no hace falta: `mates-core` es puro y no abre red.
Cuando toque son dos piezas, ~8 USD/mes:

| Pieza | Dónde | Coste |
|---|---|---|
| Proxy del modelo (guarda la API key, streaming, caché) | Cloudflare Workers | ~5 USD/mes |
| Servicio SymPy (nivel 3) | Fly.io `shared-cpu-1x` **512 MB** | ~3,19 USD/mes |

512 MB, no 256: SymPy ocupa 62 MB de RSS y con 256 queda demasiado justo.

**Las cinco separaciones obligatorias** (regla de Gilberth, dicha tres veces):

1. **Máquina nueva.** Nada de la VM de Deliservy, ni su nginx, ni su pm2.
2. **Cuentas propias** en Cloudflare y Fly, con su propio método de pago.
3. **Dominio propio.** Nada de un subdominio bajo el dominio de Deliservy.
4. **Credenciales propias**: clave SSH, secretos y variables de entorno aparte.
5. **⚠️ Cuenta y API key de Anthropic PROPIAS.** Es la única que puede afectar de
   verdad a Deliservy: la key es **de organización**, así que compartirla haría
   que el consumo de la calculadora se comiera el saldo de Alisa y que ambas
   compartieran los límites de peticiones por minuto. Un pico de tráfico escolar
   dejaría a Alisa sin responder en producción sin que nadie tocara nada.

**Dónde está el dinero de verdad:** medido en el plan, a 900.000 consultas/mes los
tokens del modelo son el **99,2%** de la factura y todo el hosting junto el
**0,09%**. Elegir servidor por sus propiedades técnicas, no por el precio;
optimizar `max_tokens` y la tasa de acierto de caché vale cien veces más.

## Decisiones abiertas

- **El nombre.** El repo en GitHub es `Calculator-with-IA`, pero dentro el paquete
  se llama `paso-a-paso`. Si se unifica, toca **tres sitios**: `package.json`,
  `packages/mates-core/package.json` y el comentario de
  `packages/mates-core/src/index.ts`.
- **El bundle id de la app.** Ahora es `com.pasoapaso.bancoriesgo` en
  `apps/banco-riesgo/app.json`. Hay que poner el dominio real antes de publicar
  nada en las tiendas.
- **⚠️ ¿Tutor adaptativo en la UE?** El Anexo III del AI Act clasifica como **alto
  riesgo** los sistemas que evalúan resultados del aprendizaje «incluido cuando
  dichos resultados se utilizan para orientar el proceso de aprendizaje». Un
  solucionador que solo explica pasos no cae; un tutor que estima dominio por
  skill y decide qué practicar, probablemente sí. Es decisión de **arquitectura**,
  no de empaquetado: hay que tomarla antes de construir el knowledge tracing de la
  fase 5. Consulta legal obligatoria.
- ~~¿Cuadráticas factorizables y radicales numéricos en el nivel 1?~~
  **RESUELTO el 21-sep-2026, midiendo contra mathsteps 0.9.12.** Los radicales
  numéricos sí (`√8 → 2√2`), y el router se afinó. Las cuadráticas **no**: el
  brief estaba equivocado. Ver abajo.
