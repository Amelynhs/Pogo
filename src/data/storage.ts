// src/data/storage.ts
// Lo unico que toca el disco. Si vuelve a cambiar la API de
// expo-file-system, se arregla aqui y nada mas.
//
// Los archivos van a una carpeta plana, NO a carpetas por ambito: el ambito
// de un archivo se puede cambiar, y con carpetas habria que moverlo cada vez.
// Van a document/ y no a cache/ porque el sistema puede vaciar la cache.

import { Directory, File, Paths } from 'expo-file-system';

const LIBRARY_FOLDER = 'library';

/**
 * Archivo elegido por el usuario, todavia sin copiar a la biblioteca.
 * La pantalla lo trata como opaco: lo guarda en estado y se lo devuelve tal
 * cual a `saveToLibrary` cuando el usuario confirma.
 */
export type PickedFile = {
  file: File;
  name: string;
  mimeType: string | null;
  size: number | null;
};

/**
 * Abre el selector de archivos del sistema y devuelve lo elegido, o null si
 * el usuario cancelo.
 *
 * Usamos `File.pickFileAsync` (de expo-file-system) y no
 * `expo-document-picker`: en Expo Go, el `File` que este metodo devuelve fue
 * creado por el propio modulo que despues copia el archivo, asi que trae
 * consigo el permiso de lectura que le dieron. Con expo-document-picker el
 * archivo llega por una URI de otro modulo y ese permiso no viaja con ella
 * (ver la nota en saveToLibrary).
 */
export async function pickFileFromDevice(): Promise<PickedFile | null> {
  let outcome;
  try {
    outcome = await File.pickFileAsync();
  } catch (error) {
    console.log('Storage - fallo abriendo el selector de archivos:', error);
    throw new Error('No pude abrir el selector de archivos.');
  }

  if (outcome.canceled) return null;

  const file = outcome.result;
  return {
    file,
    name: file.name,
    mimeType: file.type || null,
    size: file.size,
  };
}

function libraryDirectory(): Directory {
  const directory = new Directory(Paths.document, LIBRARY_FOLDER);
  if (!directory.exists) {
    try {
      directory.create({ intermediates: true });
    } catch (error) {
      console.log('Storage - fallo creando la carpeta de la biblioteca:', error);
      throw new Error('No pude preparar el almacenamiento del teléfono para guardar archivos.');
    }
  }
  return directory;
}

export function libraryUri(diskName: string): string {
  return new File(libraryDirectory(), diskName).uri;
}

export function existsInLibrary(diskName: string): boolean {
  return new File(libraryDirectory(), diskName).exists;
}

/**
 * Copia el archivo elegido (ver `pickFileFromDevice`) a la carpeta de la app
 * y devuelve el nombre con el que quedo guardado.
 *
 * El nombre se genera: dos archivos pueden llamarse igual, y el nombre
 * original puede traer caracteres que rompan la ruta. El nombre legible vive
 * en la base de datos.
 *
 * Por que no usamos `expo-document-picker` + `new File(uri)`: en Expo Go,
 * expo-file-system acota su dominio al directorio de la experiencia, pero el
 * document picker deja el archivo elegido en la cache COMPARTIDA de Expo Go
 * (cache/DocumentPicker/...), fuera de ese dominio. Ahi `exists` respondia
 * false aunque el archivo estuviera y fuera legible (comprobado en
 * dispositivo: el mismo archivo daba exists=false y size=33803 a la vez), y
 * la copia fallaba con un error de permiso de lectura: el `File` construido
 * a mano a partir de esa URI no traia consigo ningun permiso sobre ella.
 *
 * Por eso el archivo se elige con `File.pickFileAsync` (en
 * `pickFileFromDevice`): el `File` que devuelve lo crea el propio
 * expo-file-system, así que no hay entrega de una URI entre modulos y el
 * permiso de lectura que le dieron viaja con el objeto.
 */
export async function saveToLibrary(picked: PickedFile): Promise<string> {
  const extension = picked.file.extension || extensionOf(picked.name);
  const diskName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const destination = new File(libraryDirectory(), diskName);

  try {
    await picked.file.copy(destination);
  } catch (error) {
    console.log('Storage - fallo copiando el archivo a la biblioteca:', error);
    try {
      if (destination.exists) {
        destination.delete();
      }
    } catch (cleanupError) {
      console.log('Storage - fallo limpiando la copia parcial:', cleanupError);
    }
    throw new Error(
      'No pude guardar el archivo. Puede que no haya espacio suficiente en el teléfono.'
    );
  }

  return diskName;
}

export function removeFromLibrary(diskName: string): void {
  const file = new File(libraryDirectory(), diskName);
  if (file.exists) {
    file.delete();
  }
}

/** Devuelve la extension con el punto, o cadena vacia si no tiene. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot) : '';
}
