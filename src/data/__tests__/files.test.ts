/// <reference types="node" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrate } from '../db.ts';
import {
  addFile,
  deleteFile,
  getFile,
  hasUnscopedFiles,
  listFiles,
  updateFile,
} from '../files.ts';
import { createScope } from '../scopes.ts';
import { createTestDb, type TestDb } from './test-db.ts';

async function freshDb(): Promise<TestDb> {
  const db = createTestDb();
  await migrate(db);
  await db.runAsync('DELETE FROM scopes');
  return db;
}

test('addFile guarda y devuelve el archivo con el nombre del ambito', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');

  const file = await addFile(db, {
    title: 'Marcha',
    diskName: '1-abc.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    scopeId: banda.id,
  });

  assert.equal(file.title, 'Marcha');
  assert.equal(file.diskName, '1-abc.pdf');
  assert.equal(file.mimeType, 'application/pdf');
  assert.equal(file.size, 2048);
  assert.equal(file.scopeId, banda.id);
  assert.equal(file.scopeName, 'banda');
  assert.ok(file.importedAt > 0);
});

test('addFile acepta un archivo sin ambito', async () => {
  const db = await freshDb();
  const file = await addFile(db, { title: 'Suelto', diskName: 'x.pdf', scopeId: null });

  assert.equal(file.scopeId, null);
  assert.equal(file.scopeName, null);
});

test('addFile rechaza un titulo vacio', async () => {
  const db = await freshDb();
  await assert.rejects(
    () => addFile(db, { title: '  ', diskName: 'x.pdf', scopeId: null }),
    /nombre/i
  );
});

test('listFiles sin filtro devuelve todo, lo mas reciente primero', async () => {
  const db = await freshDb();
  await addFile(db, { title: 'Viejo', diskName: 'a.pdf', scopeId: null });
  await addFile(db, { title: 'Nuevo', diskName: 'b.pdf', scopeId: null });

  const files = await listFiles(db);
  assert.deepEqual(files.map((f) => f.title), ['Nuevo', 'Viejo']);
});

test('listFiles con un id de ambito filtra por ese ambito', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');
  const uni = await createScope(db, 'universidad');

  await addFile(db, { title: 'Marcha', diskName: 'a.pdf', scopeId: banda.id });
  await addFile(db, { title: 'Tesis', diskName: 'b.pdf', scopeId: uni.id });

  const files = await listFiles(db, banda.id);
  assert.deepEqual(files.map((f) => f.title), ['Marcha']);
});

test('listFiles con null devuelve solo los que no tienen ambito', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');

  await addFile(db, { title: 'Marcha', diskName: 'a.pdf', scopeId: banda.id });
  await addFile(db, { title: 'Suelto', diskName: 'b.pdf', scopeId: null });

  const files = await listFiles(db, null);
  assert.deepEqual(files.map((f) => f.title), ['Suelto']);
});

test('updateFile cambia titulo y ambito', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');
  const file = await addFile(db, { title: 'Sin nombre', diskName: 'a.pdf', scopeId: null });

  await updateFile(db, file.id, { title: 'Marcha fúnebre', scopeId: banda.id });

  const updated = await getFile(db, file.id);
  assert.equal(updated?.title, 'Marcha fúnebre');
  assert.equal(updated?.scopeId, banda.id);
  assert.equal(updated?.scopeName, 'banda');
});

test('updateFile rechaza un titulo vacio', async () => {
  const db = await freshDb();
  const file = await addFile(db, { title: 'Marcha', diskName: 'a.pdf', scopeId: null });

  await assert.rejects(() => updateFile(db, file.id, { title: '   ', scopeId: null }), /nombre/i);
});

test('deleteFile quita la fila', async () => {
  const db = await freshDb();
  const file = await addFile(db, { title: 'Marcha', diskName: 'a.pdf', scopeId: null });

  await deleteFile(db, file.id);

  assert.equal(await getFile(db, file.id), null);
  assert.equal((await listFiles(db)).length, 0);
});

test('hasUnscopedFiles detecta si hay archivos sin ambito', async () => {
  const db = await freshDb();
  const banda = await createScope(db, 'banda');

  await addFile(db, { title: 'Marcha', diskName: 'a.pdf', scopeId: banda.id });
  assert.equal(await hasUnscopedFiles(db), false);

  await addFile(db, { title: 'Suelto', diskName: 'b.pdf', scopeId: null });
  assert.equal(await hasUnscopedFiles(db), true);
});
