# Banco de pruebas de riesgo — como correrlo

Esta app no hace nada util: solo responde tres preguntas de las que depende que el
proyecto sea viable. **Aun no se ha ejecutado en ningun dispositivo.**

## Antes de empezar

Expo Go **no sirve**: hacen falta modulos nativos. Hay que hacer un development build.

```bash
cd calculadora/apps/banco-riesgo
npm install
npx expo run:ios      # o run:android
```

## (a) TTS y microfono a la vez — LA IMPORTANTE

**Hazla la primera, y en un iPhone fisico.** Si falla, la funcion de voz del
proyecto no existe tal y como esta planteada, y conviene saberlo hoy y no en la
fase 5.

1. Pulsa **(a)**, acepta los permisos de microfono y reconocimiento.
2. **No hables.** Deja que solo suene el movil.
3. El telefono dira "equis al cuadrado más dos equis más uno".
4. Mira el log.

| Lo que veas | Significa |
|---|---|
| `PASA` | La cancelacion de eco de iOS funciona. Se puede seguir. |
| `FALLA` + texto transcrito mientras hablaba | El microfono se oyo a si mismo. |

**Repitela con auriculares y sin ellos**: el altavoz del telefono es el caso malo.
Y repitela con el volumen al maximo, que es como la va a usar un alumno.

Si falla, las salidas son: cortar el reconocimiento mientras habla el TTS (modo
turnos, no simultaneo), o exigir auriculares. Las dos cambian el diseno de la
pantalla de voz, asi que mejor decidirlo antes de dibujarla.

## (b) Temml + speech-rule-engine bajo Hermes

Pulsa **(b)**. Lo que se comprueba aqui es que los dos modulos **arranquen en
Hermes**, que es lo que Node no puede responder: SRE carga sus mathmaps como JSON
y usa XML.

En Node ya esta medido: 5,9 ms por expresion, y `clearspeak` en espanol cae a
`mathspeak` sin avisar. El log te dira si en el dispositivo pasa lo mismo y cuanto
tarda. Si tarda mas de ~50 ms por expresion, habra que precalcular la lectura en
el servidor.

## (c) mathsteps por ESM

Pulsa **(c)**. Ya esta verificado en Node; aqui lo que se prueba es que **Metro**
resuelva la condicion `import`. Si falla, revisa que `metro.config.js` tenga
`unstable_enablePackageExports = true`.

## Que reportar

Copia el log entero de las tres. Con eso se decide si la fase 5 sigue el plan o
cambia.
