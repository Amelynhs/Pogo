// src/data/scopes.ts
// Ambitos de vida: las etiquetas con las que Amelyn organiza sus archivos.

import type { Db } from './db';

export type Scope = {
  id: number;
  name: string;
  /** Cuantos archivos tienen este ambito. */
  fileCount: number;
};

type ScopeRow = { id: number; name: string; file_count: number };

/**
 * Pliega mayusculas a minusculas con la collation de español.
 * SQLite NOCASE no funciona con acentos, asi que lo hacemos en JS.
 */
function foldCase(name: string): string {
  return name.trim().toLocaleLowerCase('es');
}

/**
 * Comprueba que no exista ya un ambito con ese nombre.
 *
 * El UNIQUE de SQLite distingue mayusculas, asi que "Banda" y "banda"
 * pasarian los dos. Para la usuaria son el mismo ambito, asi que lo
 * comparamos sin distinguir. Usamos JavaScript para la collation porque
 * SQLite NOCASE no maneja acentos.
 */
async function ensureNameIsFree(db: Db, name: string, exceptId?: number): Promise<void> {
  const folded = foldCase(name);
  const scopes = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM scopes');

  const clash = scopes.find((s) => foldCase(s.name) === folded && s.id !== (exceptId ?? -1));

  if (clash) throw new Error(`Ya tienes un ámbito llamado "${name}".`);
}

function cleanName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error('El ámbito necesita un nombre.');
  return clean;
}

/** Ambitos ordenados alfabeticamente, con cuantos archivos tiene cada uno. */
export async function listScopes(db: Db): Promise<Scope[]> {
  const rows = await db.getAllAsync<ScopeRow>(`
    SELECT s.id, s.name, COUNT(f.id) AS file_count
    FROM scopes s
    LEFT JOIN files f ON f.scope_id = s.id
    GROUP BY s.id, s.name
  `);

  const scopes = rows.map((row) => ({ id: row.id, name: row.name, fileCount: row.file_count }));
  scopes.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return scopes;
}

export async function createScope(db: Db, name: string): Promise<Scope> {
  const clean = cleanName(name);
  await ensureNameIsFree(db, clean);

  const { lastInsertRowId } = await db.runAsync(
    'INSERT INTO scopes (name, created_at) VALUES (?, ?)',
    [clean, Date.now()]
  );

  return { id: lastInsertRowId, name: clean, fileCount: 0 };
}

export async function renameScope(db: Db, id: number, name: string): Promise<void> {
  const clean = cleanName(name);
  await ensureNameIsFree(db, clean, id);

  await db.runAsync('UPDATE scopes SET name = ? WHERE id = ?', [clean, id]);
}

/**
 * Borra el ambito. Sus archivos NO se borran: quedan sin ambito, gracias al
 * ON DELETE SET NULL del esquema. Borrar una etiqueta no deberia borrar las
 * partituras.
 */
export async function deleteScope(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM scopes WHERE id = ?', [id]);
}
