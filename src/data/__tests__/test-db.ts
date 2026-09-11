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
