// src/utils/alert-error.ts
// Un solo lugar para el mismo problema repetido por toda la interfaz: una
// funcion async invocada desde un callback sincrono (un boton de Alert, un
// Pressable, useFocusEffect) cuya promesa se descartaba. Si esa funcion
// fallaba, la promesa quedaba sin manejar y no se veia nada en pantalla.
//
// Los mensajes de la capa de datos ya son en español por construccion (ver
// storage.ts, data/files.ts y data/scopes.ts), asi que mostrar
// error.message tal cual es correcto en todas partes.

import { Alert } from 'react-native';

/**
 * Ejecuta `action` y, si falla, registra el error original en consola y
 * muestra un Alert con `titulo` y el mensaje del error. Nunca relanza: esta
 * pensada para usarse desde un callback sincrono sin dejar una promesa sin
 * manejar.
 */
export async function runOrAlert(titulo: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.log(`${titulo}:`, error);
    Alert.alert(titulo, (error as Error).message);
  }
}
