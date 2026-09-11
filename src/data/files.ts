// src/data/files.ts
// Archivos importados: solo los metadatos. La copia en disco la maneja
// storage.ts, y la pantalla encadena las dos.

import type { Db } from './db';

export type StoredFile = {
  id: number;
  /** Titulo legible, editable. Empieza como el nombre original del archivo. */
  title: string;
  /** Como se llama el archivo dentro de la carpeta de la app. */
  diskName: string;
  mimeType: string | null;
  size: number | null;
  scopeId: number | null;
  scopeName: string | null;
  importedAt: number;
};

type FileRow = {
  id: number;
  title: string;
  disk_name: string;
  mime_type: string | null;
  size: number | null;
  scope_id: number | null;
  scope_name: string | null;
  imported_at: number;
};

const SELECT_FILES = `
  SELECT f.id, f.title, f.disk_name, f.mime_type, f.size,
         f.scope_id, s.name AS scope_name, f.imported_at
  FROM files f
  LEFT JOIN scopes s ON s.id = f.scope_id
`;

const ORDER_NEWEST_FIRST = ' ORDER BY f.imported_at DESC, f.id DESC';

function toStoredFile(row: FileRow): StoredFile {
  return {
    id: row.id,
    title: row.title,
    diskName: row.disk_name,
    mimeType: row.mime_type,
    size: row.size,
    scopeId: row.scope_id,
    scopeName: row.scope_name,
    importedAt: row.imported_at,
  };
}

function cleanTitle(title: string): string {
  const clean = title.trim();
  if (!clean) throw new Error('El archivo necesita un nombre.');
  return clean;
}

/**
 * El filtro de la pantalla tiene tres estados, y por eso el parametro
 * distingue undefined de null:
 *
 *   listFiles(db)       -> todos los archivos
 *   listFiles(db, 3)    -> los del ambito 3
 *   listFiles(db, null) -> los que no tienen ambito
 */
export async function listFiles(db: Db, scopeId?: number | null): Promise<StoredFile[]> {
  if (scopeId === undefined) {
    const rows = await db.getAllAsync<FileRow>(SELECT_FILES + ORDER_NEWEST_FIRST, []);
    return rows.map(toStoredFile);
  }

  if (scopeId === null) {
    const rows = await db.getAllAsync<FileRow>(
      `${SELECT_FILES} WHERE f.scope_id IS NULL ${ORDER_NEWEST_FIRST}`,
      []
    );
    return rows.map(toStoredFile);
  }

  const rows = await db.getAllAsync<FileRow>(
    `${SELECT_FILES} WHERE f.scope_id = ? ${ORDER_NEWEST_FIRST}`,
    [scopeId]
  );
  return rows.map(toStoredFile);
}

export async function getFile(db: Db, id: number): Promise<StoredFile | null> {
  const row = await db.getFirstAsync<FileRow>(`${SELECT_FILES} WHERE f.id = ?`, [id]);
  return row ? toStoredFile(row) : null;
}

/**
 * Inserta el archivo. `diskName` tiene que venir de storage.saveToLibrary:
 * primero se copia el archivo, despues se registra.
 */
export async function addFile(
  db: Db,
  data: {
    title: string;
    diskName: string;
    mimeType?: string | null;
    size?: number | null;
    scopeId: number | null;
  }
): Promise<StoredFile> {
  const title = cleanTitle(data.title);

  const { lastInsertRowId } = await db.runAsync(
    `INSERT INTO files (title, disk_name, mime_type, size, scope_id, imported_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, data.diskName, data.mimeType ?? null, data.size ?? null, data.scopeId, Date.now()]
  );

  const created = await getFile(db, lastInsertRowId);
  if (!created) throw new Error('No pude guardar el archivo.');
  return created;
}

export async function updateFile(
  db: Db,
  id: number,
  meta: { title: string; scopeId: number | null }
): Promise<void> {
  const title = cleanTitle(meta.title);
  await db.runAsync('UPDATE files SET title = ?, scope_id = ? WHERE id = ?', [
    title,
    meta.scopeId,
    id,
  ]);
}

/** Borra solo la fila. El archivo del disco lo borra quien llama, despues. */
export async function deleteFile(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM files WHERE id = ?', [id]);
}

/** Para decidir si mostrar el chip "Sin ambito" en el filtro. */
export async function hasUnscopedFiles(db: Db): Promise<boolean> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM files WHERE scope_id IS NULL',
    []
  );
  return (row?.total ?? 0) > 0;
}
