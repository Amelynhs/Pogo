# Plan del Proyecto: Pogo — React Native + Expo Go (v2)

**Para:** Amelyn
**Presupuesto:** $0 (APIs con capa gratuita, sin tarjeta de crédito)
**Plataforma:** App de celular, corre directo en la app Expo Go (sin compilación nativa)

---

## 1. Qué cambia respecto al plan original

El plan anterior era una app de escritorio en Python para Windows. Este es
el rediseño para que corra como app de celular en React Native dentro de
Expo Go. Expo Go no permite módulos nativos personalizados, así que varias
piezas se resuelven distinto:

| Pieza | Plan original (Windows) | Plan nuevo (Expo Go) |
|---|---|---|
| Activación por voz | Palabra "Pogo" en segundo plano | Botón de "mantén presionado para hablar" |
| Transcripción de voz (STT) | Whisper local (faster-whisper) | Se graba el audio en el celular y se envía a la API gratuita de Groq (Whisper) |
| Cerebro (LLM) | Ollama local | API gratuita de Gemini (Google), sin tarjeta de crédito |
| Voz de Pogo (TTS) | pyttsx3 local | `expo-speech` (nativo de Expo, funciona offline) |
| Conexión a internet | No necesaria | Necesaria (las APIs de STT y LLM son en la nube) |
| Archivos | Carpeta de Windows ya con tus partituras | Los importas al celular con el selector de archivos (los que están en la computadora los pasas al celular primero, ej. por WhatsApp/Drive/correo) |

---

## 2. Stack tecnológico

| Componente | Herramienta | Costo |
|---|---|---|
| Framework | React Native + Expo (JavaScript), corre en Expo Go | Gratis |
| Grabación de audio | `expo-av` (nativo de Expo, funciona en Expo Go) | Gratis |
| Transcripción de voz | API de Groq (Whisper) | Gratis (capa gratuita) |
| Cerebro / modelo de lenguaje | API de Gemini (Google AI Studio) | Gratis (capa gratuita) |
| Voz de Pogo | `expo-speech` | Gratis |
| Importar archivos | `expo-document-picker` | Gratis |
| Guardar archivos en el celular | `expo-file-system` | Gratis |
| Base de datos local (etiquetas, eventos, ideas) | `expo-sqlite` | Gratis |
| Interfaz visual | React Native + estilos propios, escala de grises oscura | Gratis |

---

## 3. Fases de construcción

### Fase 1 — Proyecto base + ciclo de voz con botón
Proyecto Expo funcionando, con un botón de "mantén presionado para hablar",
grabación de audio, y respuesta hablada (todavía sin inteligencia real -
solo para probar que el ciclo funciona).

### Fase 2 — Conectar transcripción y el cerebro
El audio grabado se transcribe con Groq y se envía a Gemini, que responde
de forma natural. Pogo ya conversa de verdad.

### Fase 3 — Importador de archivos
Pantalla para importar archivos desde el celular (PDFs, Word/Excel/PPT,
imágenes, notas), etiquetados por ámbito de vida (banda, universidad,
pareja, etc.), guardados localmente en el celular.

### Fase 4 — Búsqueda inteligente
Le pides algo por voz o texto y Pogo busca entre los archivos importados y
te muestra los relevantes.

### Fase 5 — Eventos y memoria de ideas
Puedes mencionar una fecha/actividad ("presentación el jueves a las 3") y
Pogo la cruza con archivos relevantes. También guarda ideas sueltas.

### Fase 6 — Pulir la interfaz visual
Estilo final: escala de grises oscura, serio, con indicadores claros de
estado (escuchando / pensando / hablando).

---

## 4. Siguiente paso

Empezar con la **Fase 1**: crear el proyecto Expo, con el botón de voz, la
grabación de audio, y la respuesta hablada básica — todo probado
directamente desde la app Expo Go en tu celular.
