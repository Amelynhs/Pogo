# Pogo — Fase 1 (adaptado a tu proyecto Expo Router)

Como ya tienes el proyecto creado con el template de Expo Router + TypeScript
(y `expo-av` / `expo-speech` ya instalados), no hace falta instalar nada.
Solo hay que agregar y reemplazar estos archivos.

## 1. Archivos a agregar / reemplazar

```
pogo/
└── src/
    ├── app/
    │   └── index.tsx                       (REEMPLAZA el que ya existe)
    ├── components/
    │   └── pogo/                           (carpeta nueva)
    │       ├── talk-button.tsx             (nuevo)
    │       └── conversation-log.tsx        (nuevo)
    ├── constants/
    │   └── pogo-theme.ts                   (nuevo, no toca tu theme.ts actual)
    └── utils/                              (carpeta nueva)
        ├── audio.ts                        (nuevo)
        └── tts.ts                          (nuevo)
```

No toqué `src/app/_layout.tsx` ni `src/app/explore.tsx` ni tu
`src/constants/theme.ts` original - todo eso queda igual. El tab **Home**
ahora muestra la interfaz de Pogo; el tab **Explore** lo dejamos tal cual
por ahora (en una fase futura puede convertirse en el explorador de
archivos).

## 2. Correr el proyecto

Desde la carpeta raíz del proyecto:

```bash
npx expo start
```

Escanea el QR con la app Expo Go en tu celular (Android) o con la Cámara
(iPhone).

## 3. Cómo usarlo

En el tab **Home**, mantén presionado el botón circular del centro y dile
algo a Pogo. Al soltar, "piensa" un momento y responde confirmando cuánto
grabó (todavía no entiende lo que dijiste - eso es la Fase 2).

## 4. Nota sobre `expo-av`

`expo-av` está marcado como deprecado en versiones recientes de Expo a
favor de `expo-audio`, pero como ya está en tu `package.json` y sigue
funcionando en SDK 57, lo usamos por ahora para no meterte otra migración
en medio de la Fase 1. Si más adelante da problemas o quieres adelantarte,
lo migramos a `expo-audio` sin mucho esfuerzo (la lógica es casi igual).

## 5. Si algo no funciona bien

- **Error de import `@/...`:** confirma que tu `tsconfig.json` tiene
  configurado el path alias `@/*` apuntando a `src/*` (ya debería estarlo,
  porque los archivos originales del template ya lo usan así).
- **No aparece el QR / error de conexión:** celular y computadora deben
  estar en la misma red WiFi. Si tu red lo bloquea, usa
  `npx expo start --tunnel`.
- **No hay sonido en la respuesta:** revisa que el celular no esté en modo
  silencio y que el volumen esté arriba.
- **Pide permiso de micrófono y no reacciona:** cierra la app en el celular
  y vuelve a escanear el QR.

## 6. Qué sigue

Fase 2: enviar el audio grabado a la API gratuita de Groq (transcripción) y
el texto resultante a la API gratuita de Gemini (respuesta real), en vez
del mensaje "placeholder" de esta fase.

Prueba esta fase primero y cuéntame cómo te fue.
