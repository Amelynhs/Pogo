// src/data/storage.ts
// Lo unico que toca el disco. Si vuelve a cambiar la API de
// expo-file-system, se arregla aqui y nada mas.
//
// Los archivos van a una carpeta plana, NO a carpetas por ambito: el ambito
// de un archivo se puede cambiar, y con carpetas habria que moverlo cada vez.
// Van a document/ y no a cache/ porque el sistema puede vaciar la cache.

import { Directory, File, Paths } from 'expo-file-system';

const LIBRARY_FOLDER = 'library';

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
 * Copia el archivo elegido a la carpeta de la app y devuelve el nombre con el
 * que quedo guardado.
 *
 * El nombre se genera: dos archivos pueden llamarse igual, y el nombre
 * original puede traer caracteres que rompan la ruta. El nombre legible vive
 * en la base de datos.
 */
export async function saveToLibrary(sourceUri: string, originalName: string): Promise<string> {
  const source = new File(sourceUri);
  if (!source.exists) {
    throw new Error('No encontré el archivo que elegiste. Intenta de nuevo.');
  }

  const extension = source.extension || extensionOf(originalName);
  const diskName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const destination = new File(libraryDirectory(), diskName);

  try {
    await source.copy(destination);
  } catch (error) {
    console.log('Storage - fallo copiando el archivo a la biblioteca:', error);
    try {
      if (destination.exists) {
        destination.delete();
      }
    } catch (cleanupError) {
      console.log('Storage - fallo limpiando la copia parcial:', cleanupError);
    }
    throw new Error('No pude guardar el archivo. Puede que no haya espacio suficiente en el teléfono.');
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
