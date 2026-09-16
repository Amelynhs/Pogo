/// <reference types="node" />

// Adaptador del SQLite incorporado de Node al tipo Db de la app.
//
// Existe para que las pruebas ejecuten SQL de verdad. jest-expo simula los
// modulos nativos, asi que probar expo-sqlite a traves de el no probaria nada.
// node:sqlite viene con Node 22+ y no necesita instalarse.

import { DatabaseSync } from 'node:sqlite';

import { migrate, type Db } from '../db.ts';

export type TestDb = Db & { close(): void };

export function createTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:');

  // node:sqlite deja foreign_keys en ON por defecto; la SQLite real (y por lo
  // tanto expo-sqlite en el dispositivo) lo deja en OFF. Lo apagamos aqui para
  // que la unica fuente de "ON" sea el PRAGMA que activa initTestDb() (abajo),
  // el equivalente de pruebas de initDatabase() en app/_layout.tsx, y asi las
  // pruebas realmente comprueben que ese PRAGMA se ejecuta.
  raw.exec('PRAGMA foreign_keys = OFF');

  return {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: unknown[] = []) {
      const result = raw.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as never[])) ?? null) as T | null;
    },
    close() {
      raw.close();
    },
  };
}

/**
 * Crea una base de pruebas y la deja lista para usar, reproduciendo lo que
 * hace `initDatabase()` en `app/_layout.tsx`: `PRAGMA foreign_keys = ON`
 * antes de migrar. `migrate()` ya no activa ese pragma (ver el comentario en
 * `data/db.ts`), asi que sin esto `ON DELETE SET NULL` no se aplicaria y las
 * pruebas que comprueban que borrar un ambito no borra sus archivos no
 * probarian nada.
 */
export async function initTestDb(): Promise<TestDb> {
  const db = createTestDb();
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
  return db;
}
