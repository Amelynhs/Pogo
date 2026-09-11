/// <reference types="node" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrate } from '../db.ts';
import { createScope, deleteScope, listScopes, renameScope } from '../scopes.ts';
import { createTestDb, type TestDb } from './test-db.ts';

async function freshDb(): Promise<TestDb> {
  const db = createTestDb();
  await migrate(db);
  await db.runAsync('DELETE FROM scopes');
  return db;
}

test('createScope guarda el ambito y lo devuelve sin archivos', async () => {
  const db = await freshDb();
  const scope = await createScope(db, 'orquesta');

  assert.equal(scope.name, 'orquesta');
  assert.equal(scope.fileCount, 0);
  assert.ok(scope.id > 0);
});

test('createScope recorta los espacios sobrantes', async () => {
  const db = await freshDb();
  const scope = await createScope(db, '   coro   ');
  assert.equal(scope.name, 'coro');
});

test('createScope rechaza un nombre vacio', async () => {
  const db = await freshDb();
  await assert.rejects(() => createScope(db, '   '), /nombre/i);
});

test('createScope rechaza un duplicado sin importar mayusculas', async () => {
  const db = await freshDb();
  await createScope(db, 'banda');
  await assert.rejects(() => createScope(db, 'BANDA'), /ya tienes/i);
});

test('listScopes ordena alfabeticamente y cuenta los archivos', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');
  await createScope(db, 'archivo muerto');

  await db.runAsync(
    'INSERT INTO files (title, disk_name, scope_id, imported_at) VALUES (?, ?, ?, ?)',
    ['Marcha', 'a.pdf', banda.id, 1]
  );
  await db.runAsync(
    'INSERT INTO files (title, disk_name, scope_id, imported_at) VALUES (?, ?, ?, ?)',
    ['Himno', 'b.pdf', banda.id, 2]
  );

  const scopes = await listScopes(db);
  assert.deepEqual(scopes.map((s) => s.name), ['archivo muerto', 'banda']);
  assert.equal(scopes[1].fileCount, 2);
  assert.equal(scopes[0].fileCount, 0);
});

test('renameScope cambia el nombre', async () => {
  const db = await freshDb();
  const scope = await createScope(db, 'banda');
  await renameScope(db, scope.id, 'banda sinfonica');

  const scopes = await listScopes(db);
  assert.equal(scopes[0].name, 'banda sinfonica');
});

test('renameScope rechaza chocar con otro ambito', async () => {
  const db = await freshDb();
  await createScope(db, 'banda');
  const otro = await createScope(db, 'coro');

  await assert.rejects(() => renameScope(db, otro.id, 'banda'), /ya tienes/i);
});

test('renameScope permite guardar el mismo nombre sin cambios', async () => {
  const db = await freshDb();
  const scope = await createScope(db, 'banda');
  await renameScope(db, scope.id, 'banda');

  const scopes = await listScopes(db);
  assert.equal(scopes[0].name, 'banda');
});

test('deleteScope borra el ambito pero conserva sus archivos', async () => {
  const db = await freshDb();
  const scope = await createScope(db, 'banda');
  await db.runAsync(
    'INSERT INTO files (title, disk_name, scope_id, imported_at) VALUES (?, ?, ?, ?)',
    ['Marcha', 'a.pdf', scope.id, 1]
  );

  await deleteScope(db, scope.id);

  assert.equal((await listScopes(db)).length, 0);
  const file = await db.getFirstAsync<{ title: string; scope_id: number | null }>(
    'SELECT title, scope_id FROM files'
  );
  assert.equal(file?.title, 'Marcha');
  assert.equal(file?.scope_id, null);
});
