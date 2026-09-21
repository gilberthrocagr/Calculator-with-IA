/**
 * Banco de pruebas de riesgo — fase 0.
 *
 * Tres pruebas, una pantalla. No es la app: es el instrumento para decidir si
 * la app es viable. Cada prueba imprime un log crudo, porque lo que importa es
 * el dato, no que quede bonito.
 *
 * AVISO: este archivo NO se ha ejecutado en dispositivo. Se escribio contra la
 * documentacion de los paquetes. Si algo no compila a la primera, el fallo esta
 * aqui y no en la conclusion de la prueba.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

/** Frase que dira el TTS. Si el reconocedor la transcribe, la prueba (a) FALLA. */
const FRASE_TTS = 'equis al cuadrado más dos equis más uno';
/** Palabras delatoras: si aparecen en la transcripcion, vino del altavoz. */
const DELATORAS = ['cuadrado', 'equis', 'más dos'];

const VOCABULARIO_MATEMATICO = [
  'equis', 'ye', 'zeta', 'al cuadrado', 'al cubo', 'raíz cuadrada', 'raíz cúbica',
  'sobre', 'entre', 'más', 'menos', 'por', 'igual', 'paréntesis',
  'logaritmo', 'seno', 'coseno', 'tangente', 'elevado a', 'sub índice',
];

type Estado = 'sin-probar' | 'corriendo' | 'pasa' | 'falla';

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [estadoA, setEstadoA] = useState<Estado>('sin-probar');
  const [estadoB, setEstadoB] = useState<Estado>('sin-probar');
  const [estadoC, setEstadoC] = useState<Estado>('sin-probar');
  const escuchadoDuranteTts = useRef<string[]>([]);
  const escuchadoEnControl = useRef<string[]>([]);
  const enControl = useRef(false);
  const ttsActivo = useRef(false);

  const anotar = useCallback((linea: string) => {
    setLog((prev) => [...prev, linea]);
    // Espejo a la consola del proceso. Es lo que permite leer el resultado
    // desde el Mac con `xcrun devicectl device process launch --console`,
    // sin depender de que alguien transcriba la pantalla a mano.
    console.log('[BANCO] ' + linea);
  }, []);

  // ---------------------------------------------------------------- (a) voz
  useSpeechRecognitionEvent('result', (ev) => {
    const texto = ev.results?.[0]?.transcript ?? '';
    if (texto.length === 0) return;
    anotar(`  oido${ttsActivo.current ? ' [MIENTRAS HABLABA EL TTS]' : ''}: "${texto}"`);
    if (ttsActivo.current) escuchadoDuranteTts.current.push(texto);
    else if (enControl.current) escuchadoEnControl.current.push(texto);
  });

  useSpeechRecognitionEvent('error', (ev) => {
    anotar(`  error de reconocimiento: ${ev.error} ${ev.message ?? ''}`);
  });

  const probarVozSimultanea = useCallback(async () => {
    setEstadoA('corriendo');
    escuchadoDuranteTts.current = [];
    anotar('');
    anotar('=== (a) TTS y microfono a la vez ===');

    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) {
      anotar('  sin permiso de microfono: no se puede probar');
      setEstadoA('falla');
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'es-ES',
      interimResults: true,
      continuous: true,
      contextualStrings: VOCABULARIO_MATEMATICO,
      // SIN esto el microfono capta el propio altavoz. Es la bandera que se prueba.
      iosVoiceProcessingEnabled: true,
      // ⚠️ SIN ESTO LA PRUEBA NO MIDE NADA Y DA UN FALSO "PASA".
      // Medido el 21-sep-2026: sin configurar la sesion de audio, en cuanto
      // Speech.speak() arranca iOS conmuta la sesion a reproduccion y el
      // microfono DEJA DE GRABAR. El log sale "no-speech / (nada)", que es
      // indistinguible de "la cancelacion de eco funciono". Tres pasadas
      // dieron PASA sin haber grabado un solo byte.
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
        mode: 'measurement',
      },
    });
    anotar('  reconocimiento arrancado (iosVoiceProcessingEnabled + playAndRecord)');

    // ---- CONTROL POSITIVO -------------------------------------------------
    // Antes de hacer sonar el TTS, comprobamos que el microfono OYE algo. Sin
    // este control, "no capto el TTS" y "no capto nada" dan el mismo log, y la
    // prueba puede pasar por el motivo equivocado.
    escuchadoEnControl.current = [];
    enControl.current = true;
    anotar('');
    anotar('  CONTROL: di algo en voz alta AHORA (5 segundos)...');
    await new Promise((r) => setTimeout(r, 5000));
    enControl.current = false;
    const oidoEnControl = escuchadoEnControl.current.join(' ').trim();
    anotar(`  control: microfono oyo "${oidoEnControl || '(nada)'}"`);
    const microVivo = oidoEnControl.length > 0;
    if (!microVivo) {
      anotar('  ⚠️ el microfono no oyo NADA en el control.');
    }
    anotar('');
    anotar('  Ahora CALLATE: solo debe sonar el movil.');

    await new Promise((r) => setTimeout(r, 1200));

    ttsActivo.current = true;
    anotar(`  el TTS dice: "${FRASE_TTS}"`);
    await new Promise<void>((resolver) => {
      Speech.speak(FRASE_TTS, {
        language: 'es-ES',
        onDone: () => resolver(),
        onError: () => resolver(),
      });
    });
    await new Promise((r) => setTimeout(r, 1500));
    ttsActivo.current = false;

    ExpoSpeechRecognitionModule.stop();

    const capturado = escuchadoDuranteTts.current.join(' ').toLowerCase();
    const seOyoASiMismo = DELATORAS.some((p) => capturado.includes(p));
    anotar(`  transcrito mientras hablaba: "${capturado || '(nada)'}"`);
    if (seOyoASiMismo) {
      anotar('  RESULTADO: FALLA — el microfono capto el TTS. Riesgo de bucle.');
      setEstadoA('falla');
    } else if (!microVivo) {
      // Misma regla que el verificador: sin evidencia suficiente no se firma un
      // veredicto. "No capto el TTS" con un microfono que no oye nada no
      // demuestra que la cancelacion de eco funcione.
      anotar('  RESULTADO: INDETERMINADO — el microfono no oyo nada en el control.');
      anotar('  No se puede concluir nada: repite la prueba hablando durante el control.');
      setEstadoA('falla');
    } else {
      anotar('  RESULTADO: PASA — el microfono oia, y aun asi no capto el TTS.');
      setEstadoA('pasa');
    }
  }, [anotar]);

  // ----------------------------------------------------------- (b) lectura
  const probarLecturaEnVozAlta = useCallback(async () => {
    setEstadoB('corriendo');
    anotar('');
    anotar('=== (b) Temml + speech-rule-engine bajo Hermes ===');
    try {
      const t0 = Date.now();
      const temml = await import('temml');
      const sre = await import('speech-rule-engine');
      anotar(`  modulos cargados en ${Date.now() - t0} ms`);

      await sre.setupEngine({
        locale: 'es', domain: 'clearspeak', style: 'default', modality: 'speech',
      });
      // Medido en Node: pedir clearspeak en espanol cae a mathspeak SIN error.
      // Hay que leer lo que SRE uso de verdad, no fiarse de lo que se pidio.
      const usado = sre.engineSetup().domain;
      anotar(`  pedido domain='clearspeak' -> SRE usa '${usado}'`);
      if (usado !== 'clearspeak') {
        anotar('  (confirmado: ClearSpeak no existe en espanol, cae a mathspeak)');
      }

      for (const latex of ['x^2 + 2x + 1', '\\frac{2}{4}', '\\sqrt{x+1}']) {
        const t1 = Date.now();
        const mathml = temml.renderToString(latex);
        const dicho = sre.toSpeech(mathml);
        anotar(`  ${latex}  ->  "${dicho}"  (${Date.now() - t1} ms)`);
      }
      anotar('  RESULTADO: PASA — la cadena corre bajo Hermes.');
      setEstadoB('pasa');
    } catch (e) {
      anotar(`  RESULTADO: FALLA — ${e instanceof Error ? e.message : String(e)}`);
      setEstadoB('falla');
    }
  }, [anotar]);

  // ---------------------------------------------------------- (c) mathsteps
  const probarMathsteps = useCallback(async () => {
    setEstadoC('corriendo');
    anotar('');
    anotar('=== (c) mathsteps por ESM en Metro ===');
    try {
      const t0 = Date.now();
      const ms = await import('mathsteps-experimental-fork');
      anotar(`  importado en ${Date.now() - t0} ms`);

      const pasos: string[] = [];
      ms.simplifyExpression({
        expressionAsText: '2/4 + 1/3',
        // Serializar DENTRO del callback: el objeto se muta en sitio.
        onStepCb: (s: { changeType?: string }) => pasos.push(String(s.changeType)),
      });
      anotar(`  2/4 + 1/3 -> ${pasos.length} pasos: ${pasos.join(', ')}`);
      anotar('  RESULTADO: PASA — Metro resolvio la condicion import.');
      setEstadoC('pasa');
    } catch (e) {
      anotar(`  RESULTADO: FALLA — ${e instanceof Error ? e.message : String(e)}`);
      anotar('  revisa unstable_enablePackageExports en metro.config.js');
      setEstadoC('falla');
    }
  }, [anotar]);

  // Ejecucion automatica al arrancar. Las tres pruebas son deterministas y no
  // necesitan a nadie pulsando: lo unico que la (a) necesita de un humano es
  // SILENCIO en la habitacion, no un dedo. Los botones siguen ahi para repetir
  // a mano, sobre todo la (a) con y sin auriculares.
  const yaArranco = useRef(false);
  useEffect(() => {
    if (yaArranco.current) return;
    yaArranco.current = true;
    (async () => {
      anotar('=== ARRANQUE AUTOMATICO ===');
      anotar('  las tres pruebas se ejecutan solas, en orden');
      await probarMathsteps();                              // (c), la mas barata
      await new Promise((r) => setTimeout(r, 400));
      // ⚠️ La (b) NO va en el arranque automatico: MATA LA APP.
      // Medido el 21-sep-2026 en un iPhone 16 Pro Max con iOS 26.6.2:
      //   RCTFatalException: Requiring unknown module "fs"
      // speech-rule-engine decide en system_external.js:30
      //   fs: documentSupported || webworker ? null : nodeRequire()('fs')
      // Bajo Hermes no hay window.document ni webworker, asi que concluye que
      // esta en Node y pide 'fs', que no existe en React Native. Es un fallo
      // fatal, no una excepcion que se pueda atrapar: el try/catch de
      // probarLecturaEnVozAlta no llega a verlo.
      // Queda como boton, para quien quiera reproducirlo.
      anotar('');
      anotar('  (b) NO se ejecuta sola: tumba la app. Ver el boton y el LEEME.');
      await new Promise((r) => setTimeout(r, 400));
      anotar('');
      anotar('  (a) EMPIEZA AHORA: no hables durante los proximos segundos');
      await probarVozSimultanea();                          // (a), la importante
      anotar('');
      anotar('=== FIN DE LAS TRES PRUEBAS ===');
    })();
  }, [anotar, probarMathsteps, probarLecturaEnVozAlta, probarVozSimultanea]);

  return (
    <View style={estilos.raiz}>
      <Text style={estilos.titulo}>Banco de riesgo — fase 0</Text>
      <Boton etiqueta="(a) TTS + microfono a la vez" estado={estadoA} onPress={probarVozSimultanea} />
      <Boton etiqueta="(b) Temml + SRE en Hermes" estado={estadoB} onPress={probarLecturaEnVozAlta} />
      <Boton etiqueta="(c) mathsteps por ESM" estado={estadoC} onPress={probarMathsteps} />
      <ScrollView style={estilos.log} contentContainerStyle={{ padding: 12 }}>
        {log.map((l, i) => (
          <Text key={i} style={estilos.linea}>{l}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

function Boton({ etiqueta, estado, onPress }: { etiqueta: string; estado: Estado; onPress: () => void }) {
  const color = estado === 'pasa' ? '#1a7f37' : estado === 'falla' ? '#b3261e' : '#2c2c31';
  return (
    <Pressable style={[estilos.boton, { backgroundColor: color }]} onPress={onPress} disabled={estado === 'corriendo'}>
      <Text style={estilos.botonTexto}>
        {estado === 'corriendo' ? '...' : estado === 'pasa' ? 'PASA' : estado === 'falla' ? 'FALLA' : '▶'}  {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#101014', paddingTop: 60, paddingHorizontal: 16 },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  boton: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 8 },
  botonTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  log: { flex: 1, backgroundColor: '#121215', borderRadius: 10, marginTop: 12, marginBottom: 24 },
  linea: { color: '#c8c8d0', fontSize: 12, fontFamily: 'Menlo', lineHeight: 18 },
});
