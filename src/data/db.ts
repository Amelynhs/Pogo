// src/data/db.ts
// Base de datos local de Pogo: esquema, migraciones y siembra inicial.
//
// Este modulo no importa nada. El tipo Db lo cumple el SQLiteDatabase de
// expo-sqlite tal cual, y en las pruebas se inyecta un adaptador sobre
// node:sqlite. Asi la capa de datos se prueba con SQL real.

export const DATABASE_NAME = 'pogo.db';
export const DATABASE_VERSION = 1;

/**
 * Lo que SQLite puede enlazar como parametro de una consulta. Refleja
 * SQLiteBindValue de expo-sqlite (ver node_modules/expo-sqlite/build/
 * NativeStatement.d.ts) sin importarlo, para que este modulo siga sin
 * depender de nada.
 */
type DbBindValue = string | number | null | boolean | Uint8Array | ArrayBuffer;

/** Lo minimo que la capa de datos necesita de una base de datos. */
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params: DbBindValue[]
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params: DbBindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: DbBindValue[]): Promise<T | null>;
};

const SCHEMA_V1 = `
CREATE TABLE scopes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  disk_name   TEXT    NOT NULL UNIQUE,
  mime_type   TEXT,
  size        INTEGER,
  scope_id    INTEGER REFERENCES scopes(id) ON DELETE SET NULL,
  imported_at INTEGER NOT NULL
);

CREATE INDEX idx_files_scope    ON files(scope_id);
CREATE INDEX idx_files_imported ON files(imported_at DESC);
`;

/** Ambitos con los que arranca la app la primera vez. */
const SEED_SCOPES = ['banda', 'universidad', 'pareja'];

/**
 * Migra el esquema. NO activa `PRAGMA foreign_keys`: ese pragma es por
 * *conexion*, no por migracion (SQLite no lo persiste), asi que le toca a
 * quien abre la conexion (`initDatabase`, abajo), no a quien migra. Antes
 * vivia aqui, y solo funcionaba porque `migrate` se llamaba una vez por
 * conexion desde `onInit`; cualquier otra apertura que se saltara `migrate`
 * se habria quedado sin la garantia de `ON DELETE SET NULL`.
 */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(SCHEMA_V1);

    const now = Date.now();
    for (const name of SEED_SCOPES) {
      await db.runAsync('INSERT INTO scopes (name, created_at) VALUES (?, ?)', [name, now]);
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

/**
 * Deja una conexion lista para usar: activa `foreign_keys` (por conexion,
 * no persiste, ver el comentario de `migrate` arriba) y despues migra.
 *
 * Vive aqui, y no solo en `app/_layout.tsx`, para que las pruebas puedan
 * llamar a la MISMA funcion en vez de retipear el pragma por su cuenta.
 * Ya paso una vez que ese pragma se le perdio a las pruebas sin que
 * ninguna fallara (por eso `createTestDb`, en `__tests__/test-db.ts`, deja
 * foreign_keys en OFF a proposito, para que la prueba de ON DELETE SET
 * NULL solo pueda pasar si de verdad se activo). Con producción y pruebas
 * compartiendo esta funcion, no hay una segunda copia que se pueda
 * desincronizar.
 *
 * NO incluye `PRAGMA journal_mode = 'wal'`: WAL es una optimizacion de
 * escritura sobre archivo real, no una garantia de correccion, y las bases
 * `:memory:` de las pruebas no la necesitan (SQLite ni siquiera puede usar
 * WAL en memoria). Ese pragma se queda en `app/_layout.tsx`, antes de
 * llamar a esta funcion.
 */
export async function initDatabase(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}
