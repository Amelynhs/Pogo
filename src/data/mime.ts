// src/data/mime.ts
// Traduce un mimeType a una extension de archivo. Sin imports, a proposito
// (ver el comentario de db.ts): storage.ts importa expo-file-system, que no
// carga en Node, asi que esta funcion no puede vivir ahi si queremos poder
// probarla con la suite existente.

/**
 * Tabla de los tipos que de verdad usa esta app (ver el plan del proyecto):
 * PDF, Word/Excel/PowerPoint (OOXML y el formato viejo), imagenes, notas de
 * texto y audio. `image/jpeg` mapea a `.jpg` y no a `.jpeg` a proposito: es
 * la extension que el resto del ecosistema espera.
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',

  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',

  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/webp': '.webp',
  'image/gif': '.gif',

  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/rtf': '.rtf',

  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/wav': '.wav',

  'application/zip': '.zip',
};

/**
 * Deriva la extension (con punto) a partir de un mimeType, o '' si no se
 * puede saber con confianza.
 *
 * Primero busca en la tabla de arriba. Si no esta, aplica una heuristica
 * limitada a proposito: un subtipo sin '+' (como el "xml" de "+xml"), sin
 * '.' (como el "ms-excel" de vendor trees con puntos) y sin el prefijo
 * "vnd." (formatos especificos de un fabricante que no suelen coincidir con
 * su extension real) casi siempre ES su extension, por ejemplo
 * "image/png" -> ".png". Fuera de esos casos devuelve '': una extension
 * equivocada es peor que ninguna, porque el sistema operativo terminaria
 * mintiendo sobre el tipo del archivo.
 */
export function extensionFromMimeType(mimeType: string | null): string {
  if (!mimeType) return '';

  const known = MIME_TO_EXTENSION[mimeType];
  if (known) return known;

  const slash = mimeType.indexOf('/');
  if (slash < 0) return '';

  const subtype = mimeType.slice(slash + 1);
  if (!subtype || subtype.includes('+') || subtype.includes('.') || subtype.startsWith('vnd.')) {
    return '';
  }

  return `.${subtype}`;
}
