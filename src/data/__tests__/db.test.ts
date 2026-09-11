/// <reference types="node" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATABASE_VERSION, migrate } from '../db.ts';
import { createTestDb } from './test-db.ts';

test('migrate crea las tablas y deja la version puesta', async () => {
  const db = createTestDb();
  await migrate(db);

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  assert.equal(version?.user_version, DATABASE_VERSION);

  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    []
  );
  const names = tables.map((t) => t.name);
  assert.ok(names.includes('scopes'), 'falta la tabla scopes');
  assert.ok(names.includes('files'), 'falta la tabla files');
});

test('migrate siembra los tres ambitos iniciales', async () => {
  const db = createTestDb();
  await migrate(db);

  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM scopes ORDER BY name', []);
  assert.deepEqual(rows.map((r) => r.name), ['banda', 'pareja', 'universidad']);
});

test('migrate dos veces no duplica la siembra', async () => {
  const db = createTestDb();
  await migrate(db);
  await migrate(db);

  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM scopes', []);
  assert.equal(row?.total, 3);
});

test('borrar un ambito deja sus archivos sin ambito, no los borra', async () => {
  const db = createTestDb();
  await migrate(db);

  const scope = await db.runAsync('INSERT INTO scopes (name, created_at) VALUES (?, ?)', ['prueba', 1]);
  await db.runAsync(
    'INSERT INTO files (title, disk_name, scope_id, imported_at) VALUES (?, ?, ?, ?)',
    ['Partitura', 'a.pdf', scope.lastInsertRowId, 1]
  );

  await db.runAsync('DELETE FROM scopes WHERE id = ?', [scope.lastInsertRowId]);

  const file = await db.getFirstAsync<{ title: string; scope_id: number | null }>(
    'SELECT title, scope_id FROM files',
    []
  );
  assert.equal(file?.title, 'Partitura');
  assert.equal(file?.scope_id, null);
});
