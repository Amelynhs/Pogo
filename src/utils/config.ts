// src/utils/config.ts
// Claves de API. Viven en el archivo .env de la raíz del proyecto, que NO se
// sube a git. Expo inyecta en la app cualquier variable que empiece con
// EXPO_PUBLIC_, sin necesidad de librerías extra.
//
// Ojo: si editas el .env hay que reiniciar el servidor con `npx expo start --clear`,
// porque el valor queda incrustado en el bundle al compilarlo.

export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
