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

## La regla de arquitectura

> **El modelo de lenguaje NUNCA calcula.** Solo traduce lo que el estudiante
> escribió o dijo a una expresión matemática, y narra. Quien resuelve es un CAS.
> **Si el LLM produce un número, es un bug.**

---

## Estado de las fases

| Fase | Qué es | Estado |
|---|---|---|
| 0(c) | mathsteps por ESM | **SUPERADA** |
| 0(b) | Temml + speech-rule-engine | **PARCIAL** — verificado en Node, falta Hermes en dispositivo |
| 0(a) | Voz simultánea en iOS | **PENDIENTE** — necesita iPhone físico |
| 1 | Verificador + batería | **HECHA, 100%** |
| 2 | Calculadora nativa | no empezada |
| 3 | Clasificador + router + N1 | **clasificador y router HECHOS** (38 tests); falta el adaptador N1 |
| 4 | Servidor + SymPy + streaming | no empezada |
| 5 | Voz | no empezada |

**No se avanza de fase sin que la anterior tenga pruebas que pasen.**

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

Última verificación: **20-sep-2026, todo en verde** (72/72, 115/115, 156/156).
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

## Decisiones abiertas

- **El nombre.** El repo en GitHub es `Calculator-with-IA`, pero dentro el paquete
  se llama `paso-a-paso`. Si se unifica, toca **tres sitios**: `package.json`,
  `packages/mates-core/package.json` y el comentario de
  `packages/mates-core/src/index.ts`.
- **El bundle id de la app.** Ahora es `com.pasoapaso.bancoriesgo` en
  `apps/banco-riesgo/app.json`. Hay que poner el dominio real antes de publicar
  nada en las tiendas.
