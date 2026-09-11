/// <reference types="node" />

// Adaptador del SQLite incorporado de Node al tipo Db de la app.
//
// Existe para que las pruebas ejecuten SQL de verdad. jest-expo simula los
// modulos nativos, asi que probar expo-sqlite a traves de el no probaria nada.
// node:sqlite viene con Node 22+ y no necesita instalarse.

import { DatabaseSync } from 'node:sqlite';

import type { Db } from '../db.ts';

export type TestDb = Db & { close(): void };

export function createTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:');

  // node:sqlite deja foreign_keys en ON por defecto; la SQLite real (y por lo
  // tanto expo-sqlite en el dispositivo) lo deja en OFF. Lo apagamos aqui para
  // que la unica fuente de "ON" sea el PRAGMA de migrate(), y asi las pruebas
  // realmente comprueben que ese PRAGMA se ejecuta.
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
