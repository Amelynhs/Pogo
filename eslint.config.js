// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // storage.ts es el unico modulo que gestiona archivos en la biblioteca;
    // stt.ts es la unica otra importacion de expo-file-system, y no toca la
    // biblioteca (usa File solo como cuerpo de un FormData). Cualquier otro
    // archivo que necesite tocar expo-file-system deberia pasar por
    // storage.ts, no importarlo de nuevo: ver AGENTS.md sobre por que
    // pasar una URI de un modulo de Expo a otro es la fuente de bugs mas
    // dificil de ver en esta rama.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-file-system',
              message:
                'expo-file-system solo se importa desde src/data/storage.ts y src/utils/stt.ts. Si necesitas tocar archivos, usa las funciones de storage.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data/storage.ts', 'src/utils/stt.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
