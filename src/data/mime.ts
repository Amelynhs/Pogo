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
 * Un subtipo de mimeType que SI se puede tomar tal cual como extension: solo
 * letras y digitos en minuscula, de 1 a 5 caracteres. Es una lista de
 * permitidos, no de prohibidos, a proposito: una lista de prohibidos tiene
 * que anticipar cada valor malo que exista (y aun asi se le escapan cosas,
 * ver el historial de este archivo); una de permitidos solo tiene que
 * describir como se ve una extension de verdad. Esta la describe: rechaza
 * "octet-stream" (tiene guion — es el valor que Android devuelve cuando NO
 * sabe que es el archivo, estampar una extension ahi seria mentir por el
 * sistema), cualquier "vnd.*" o "x-*" (tienen punto o guion), cualquier
 * "*+xml" (tiene '+'), cualquier resto de parametros mal cortado (tendria
 * espacios o '=') y cualquier cosa demasiado larga para ser una extension
 * real. Y sigue aceptando las genuinas: "bmp", "csv", "png", "mp3".
 */
const SAFE_SUBTYPE = /^[a-z0-9]{1,5}$/;

/**
 * Normaliza un mimeType para buscarlo: recorta espacios, pasa a minusculas
 * y descarta parametros (`; charset=utf-8` y similares). Sin esto,
 * "IMAGE/JPEG" o "text/plain; charset=utf-8" no encontraban su entrada en
 * la tabla (que esta en minuscula y sin parametros) y caian a la
 * heuristica -o peor, arrastraban el `;`/`=`/espacio hasta el resultado.
 */
function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

/**
 * Deriva la extension (con punto) a partir de un mimeType, o '' si no se
 * puede saber con confianza.
 *
 * Primero busca en la tabla de arriba, ya normalizado. Si no esta, aplica
 * la heuristica de `SAFE_SUBTYPE` (ver su comentario) solo sobre el
 * subtipo normalizado. Fuera de esos casos devuelve '': una extension
 * equivocada es peor que ninguna, porque el sistema operativo terminaria
 * mintiendo sobre el tipo del archivo.
 */
export function extensionFromMimeType(mimeType: string | null): string {
  if (!mimeType) return '';

  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return '';

  const known = MIME_TO_EXTENSION[normalized];
  if (known) return known;

  const slash = normalized.indexOf('/');
  if (slash < 0) return '';

  const subtype = normalized.slice(slash + 1);
  if (!SAFE_SUBTYPE.test(subtype)) return '';

  return `.${subtype}`;
}
