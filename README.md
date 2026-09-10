# Pogo — Fase 2

Asistente personal por voz, corriendo en Expo Go. Mantienes presionado el
botón, hablas, y Pogo te entiende y te responde en voz alta.

## Cómo funciona el ciclo

```
mantienes presionado  →  expo-audio graba (.m4a)
        ↓ sueltas
Groq / Whisper transcribe lo que dijiste
        ↓
Gemini piensa la respuesta (con el historial de la charla)
        ↓
expo-speech la dice en voz alta
```

## Claves de API

Las dos son gratis y no piden tarjeta:

| Servicio | Dónde sacarla | Para qué |
|---|---|---|
| Groq | https://console.groq.com → *API Keys* | Transcribir tu voz |
| Gemini | https://aistudio.google.com/apikey | Pensar la respuesta |

Van en un archivo `.env` en la raíz del proyecto:

```
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
EXPO_PUBLIC_GEMINI_API_KEY=AQ...
```

Ese archivo está en el `.gitignore`, así que no se sube a git. **Pero sí queda
dentro del bundle de la app** — es la única forma de hacerlo sin un servidor
propio. Son claves gratuitas y las puedes revocar y regenerar cuando quieras
desde las mismas páginas de arriba.

> Si editas el `.env`, reinicia con `npx expo start --clear`. El valor queda
> incrustado en el bundle al compilarlo, así que un reinicio normal no lo
> vuelve a leer.

## Correr el proyecto

```bash
npm install
npm start
```

Escanea el QR con Expo Go (Android) o con la Cámara (iPhone). Celular y
computadora tienen que estar en la misma red WiFi; si tu red lo bloquea, usa
`npm start -- --tunnel`.

> **Puerto 8082, no el 8081.** En esta máquina hay otro proyecto ocupando el
> puerto por defecto, así que los scripts de `npm` fijan el 8082. Si alguna vez
> liberas el 8081, quita el `--port 8082` de `package.json`.
>
> Si el celular muestra una versión vieja de la app: no basta con recargar.
> Cierra Expo Go del todo (deslízala fuera de las apps recientes) y vuelve a
> entrar. Un bundle viejo cargado en memoria sobrevive a los reinicios del
> servidor.

## Estructura

```
src/
├── app/
│   └── index.tsx          pantalla principal, orquesta el ciclo completo
├── components/pogo/
│   ├── talk-button.tsx    botón de mantener presionado
│   └── conversation-log.tsx
├── constants/
│   └── pogo-theme.ts      paleta gris oscura fija
└── utils/
    ├── audio.ts           grabación (hook usePogoRecorder, sobre expo-audio)
    ├── stt.ts             transcripción con Groq
    ├── llm.ts             respuestas con Gemini + historial de la sesión
    ├── tts.ts             voz de Pogo (expo-speech)
    ├── config.ts          lectura de las claves
    └── errors.ts          PogoError: errores que Pogo dice en voz alta
```

## Detalles que importan

- **Memoria:** Pogo recuerda la conversación mientras la app esté abierta. Se
  borra al cerrarla. Guardar conversaciones en disco es de una fase posterior.
- **Velocidad:** Gemini corre con `thinking_level: "low"`. Medido, baja la
  respuesta de unos 5 segundos a unos 2.5. En una app de voz se nota mucho.
- **Errores:** si se cae el internet, una clave es inválida o se acaba la
  cuota, Pogo lo dice hablado con un mensaje entendible en vez de trabarse.

## Si algo no funciona

- **"No tengo configurada mi clave..."** → falta el `.env` o falta reiniciar
  con `--clear`.
- **"Mi clave no es válida"** → revisa que la copiaste completa, sin espacios.
- **"Se me acabó la cuota"** → capa gratuita agotada; espera un rato.
- **No hay sonido** → revisa que el celular no esté en silencio.
- **`Unsupported FormDataPart implementation`** → alguien volvió a subir un
  archivo con el objeto `{uri, name, type}` de React Native. Desde el SDK 54 el
  `fetch` de Expo no lo acepta: hay que pasar un `File` de `expo-file-system`
  (ver [src/utils/stt.ts](src/utils/stt.ts)).

## Qué sigue

Fase 3: importar archivos al celular (PDFs, Word, imágenes) etiquetados por
ámbito de vida, guardados localmente.
