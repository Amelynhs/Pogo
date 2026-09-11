# Fase 3 — Importador de archivos: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Amelyn pueda importar archivos desde su celular, etiquetarlos por ámbito de vida, y abrirlos, editarlos o borrarlos desde Pogo.

**Architecture:** Una capa de datos en `src/data/` que no sabe nada de la interfaz y recibe la base como parámetro, y dos pantallas nuevas que la consumen. Los metadatos van en SQLite; los archivos se copian a una carpeta plana en almacenamiento permanente y el ámbito vive sólo en la base, para poder cambiarlo sin mover nada en disco.

**Tech Stack:** Expo SDK 57, expo-sqlite, expo-document-picker, expo-sharing, expo-file-system, expo-router (NativeTabs). Pruebas con el runner incorporado de Node 24 (`node --test`) sobre `node:sqlite`.

**Spec:** `docs/superpowers/specs/2026-09-10-fase-3-importador-archivos-design.md`

## Global Constraints

- **Expo SDK 57.** Antes de usar cualquier API de Expo, consultar `https://docs.expo.dev/versions/v57.0.0/`. El SDK cambió mucho; la memoria no sirve.
- **Todo debe funcionar en Expo Go.** Nada de módulos nativos personalizados.
- **Idioma:** identificadores y nombres de archivo en inglés; comentarios y textos de interfaz en español. Sigue el patrón de `src/utils/stt.ts`.
- **Paleta:** usar `PogoColors`, `PogoSpacing` y `PogoTypography` de `src/constants/pogo-theme.ts`. No usar el `theme.ts` del template.
- **Puerto del servidor:** 8082. Los scripts de npm ya lo fijan; arrancar con `npm start`.
- **No commitear `.env`.** Ya está en `.gitignore`; verificar con `git status` antes de cada commit.
- **Errores de esta capa se muestran en `Alert`, no se hablan.** `PogoError` (`src/utils/errors.ts`) queda reservado para el ciclo de voz.
- **Node 24** para las pruebas: ejecuta TypeScript sin transpilar y trae `node:sqlite`. Verificado.

## Desviación respecto a la especificación

La especificación describe `importFile(db, source, meta)` haciendo la copia a disco y la inserción en la base. El plan lo divide en dos:

- `storage.saveToLibrary(sourceUri, originalName)` copia y devuelve el nombre en disco
- `files.addFile(db, {...diskName})` inserta la fila

La pantalla las encadena. El motivo es que así `files.ts` queda como SQL puro y se puede probar automáticamente; mezclado con el sistema de archivos no se podría. La garantía de la especificación ("no se inserta nada si la copia falló") se mantiene: la copia va primero, y si la inserción falla se borra el archivo copiado.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/data/db.ts` | Tipo `Db`, esquema, migraciones, siembra. Sin imports: SQL y tipos puros |
| `src/data/scopes.ts` | Ámbitos: listar con conteo, crear, renombrar, borrar |
| `src/data/files.ts` | Archivos: listar con filtro, añadir, editar, borrar |
| `src/data/storage.ts` | Copiar y borrar del disco. Único módulo que toca `expo-file-system` |
| `src/data/__tests__/test-db.ts` | Adaptador de `node:sqlite` al tipo `Db` |
| `src/data/__tests__/*.test.ts` | Pruebas de la capa de datos |
| `src/components/pogo/scope-chips.tsx` | Fila de chips de ámbito. Se usa en el filtro y en el formulario |
| `src/components/pogo/file-row.tsx` | Una fila de la lista de archivos |
| `src/components/pogo/file-form-sheet.tsx` | Hoja de importar y de editar (es la misma) |
| `src/components/pogo/file-actions-sheet.tsx` | Hoja de las tres acciones |
| `src/app/files.tsx` | Pantalla Archivos (sustituye a `explore.tsx`) |
| `src/app/settings.tsx` | Pantalla Ajustes |
| `src/app/_layout.tsx` | Modificar: envolver en `SQLiteProvider` |
| `src/components/app-tabs.tsx` | Modificar: renombrar pestaña y añadir la tercera |
| `src/components/app-tabs.web.tsx` | Modificar: lo mismo. **Es fácil olvidar este** |

---

### Task 1: Base de datos, esquema y migraciones

**Files:**
- Modify: `package.json` (dependencias y script `test`)
- Create: `src/data/db.ts`
- Create: `src/data/__tests__/test-db.ts`
- Test: `src/data/__tests__/db.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `Db`, `DATABASE_NAME`, `DATABASE_VERSION`, `migrate(db: Db): Promise<void>`, y `createTestDb(): TestDb` para las pruebas de las tareas siguientes

- [ ] **Step 1: Instalar las dependencias**

```bash
npx expo install expo-sqlite expo-document-picker expo-sharing
```

No se instala nada para pruebas: Node 24 trae el runner y SQLite.

- [ ] **Step 2: Añadir el script de pruebas**

En `package.json`, dentro de `"scripts"`:

```json
"test": "node --test src/data/__tests__/"
```

- [ ] **Step 3: Escribir la prueba que falla**

Crear `src/data/__tests__/db.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATABASE_VERSION, migrate } from '../db';
import { createTestDb } from './test-db';

test('migrate crea las tablas y deja la version puesta', async () => {
  const db = createTestDb();
  await migrate(db);

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(version?.user_version, DATABASE_VERSION);

  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  );
  const names = tables.map((t) => t.name);
  assert.ok(names.includes('scopes'), 'falta la tabla scopes');
  assert.ok(names.includes('files'), 'falta la tabla files');
});

test('migrate siembra los tres ambitos iniciales', async () => {
  const db = createTestDb();
  await migrate(db);

  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM scopes ORDER BY name');
  assert.deepEqual(rows.map((r) => r.name), ['banda', 'pareja', 'universidad']);
});

test('migrate dos veces no duplica la siembra', async () => {
  const db = createTestDb();
  await migrate(db);
  await migrate(db);

  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM scopes');
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
    'SELECT title, scope_id FROM files'
  );
  assert.equal(file?.title, 'Partitura');
  assert.equal(file?.scope_id, null);
});
```

- [ ] **Step 4: Ejecutar y comprobar que falla**

```bash
npm test
```

Esperado: FALLA con "Cannot find module '../db'".

- [ ] **Step 5: Escribir el adaptador de pruebas**

Crear `src/data/__tests__/test-db.ts`:

```ts
// Adaptador del SQLite incorporado de Node al tipo Db de la app.
//
// Existe para que las pruebas ejecuten SQL de verdad. jest-expo simula los
// modulos nativos, asi que probar expo-sqlite a traves de el no probaria nada.
// node:sqlite viene con Node 22+ y no necesita instalarse.

import { DatabaseSync } from 'node:sqlite';

import type { Db } from '../db';

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
```

- [ ] **Step 6: Escribir `db.ts`**

Crear `src/data/db.ts`. **Este archivo no importa nada a propósito**: así las pruebas lo pueden cargar en Node sin arrastrar módulos nativos de Expo.

```ts
// src/data/db.ts
// Base de datos local de Pogo: esquema, migraciones y siembra inicial.
//
// Este modulo no importa nada. El tipo Db lo cumple el SQLiteDatabase de
// expo-sqlite tal cual, y en las pruebas se inyecta un adaptador sobre
// node:sqlite. Asi la capa de datos se prueba con SQL real.

export const DATABASE_NAME = 'pogo.db';
export const DATABASE_VERSION = 1;

/** Lo minimo que la capa de datos necesita de una base de datos. */
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: unknown[]
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
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

export async function migrate(db: Db): Promise<void> {
  // foreign_keys es por conexion y SQLite no lo persiste: hay que activarlo
  // en cada apertura. Sin esto, ON DELETE SET NULL no se aplica.
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
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
```

- [ ] **Step 7: Ejecutar las pruebas**

```bash
npm test
```

Esperado: 4 pruebas, todas pasan.

- [ ] **Step 8: Comprobar que TypeScript sigue limpio**

```bash
npx tsc --noEmit
```

Esperado: sólo los dos errores preexistentes del template (`animated-icon.web.tsx` y `constants/theme.ts`). Ningún error nuevo.

- [ ] **Step 9: Commit**

```bash
git status --short
git add package.json package-lock.json src/data/
git commit -m "Fase 3: esquema de la base de datos y pruebas con SQLite real"
```

---

### Task 2: Ámbitos

**Files:**
- Create: `src/data/scopes.ts`
- Test: `src/data/__tests__/scopes.test.ts`

**Interfaces:**
- Consumes: `Db` y `migrate` de `src/data/db.ts`; `createTestDb` de `./test-db`
- Produces:
  - `type Scope = { id: number; name: string; fileCount: number }`
  - `listScopes(db: Db): Promise<Scope[]>`
  - `createScope(db: Db, name: string): Promise<Scope>`
  - `renameScope(db: Db, id: number, name: string): Promise<void>`
  - `deleteScope(db: Db, id: number): Promise<void>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/data/__tests__/scopes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrate } from '../db';
import { createScope, deleteScope, listScopes, renameScope } from '../scopes';
import { createTestDb, type TestDb } from './test-db';

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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
npm test
```

Esperado: FALLA con "Cannot find module '../scopes'".

- [ ] **Step 3: Escribir `scopes.ts`**

Crear `src/data/scopes.ts`:

```ts
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
 * Comprueba que no exista ya un ambito con ese nombre.
 *
 * El UNIQUE de SQLite distingue mayusculas, asi que "Banda" y "banda"
 * pasarian los dos. Para la usuaria son el mismo ambito, asi que lo
 * comparamos sin distinguir.
 */
async function ensureNameIsFree(db: Db, name: string, exceptId?: number): Promise<void> {
  const clash = exceptId
    ? await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM scopes WHERE name = ? COLLATE NOCASE AND id <> ?',
        [name, exceptId]
      )
    : await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM scopes WHERE name = ? COLLATE NOCASE',
        [name]
      );

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
    ORDER BY s.name COLLATE NOCASE
  `);

  return rows.map((row) => ({ id: row.id, name: row.name, fileCount: row.file_count }));
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
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
npm test
```

Esperado: todas pasan (4 de la Tarea 1 + 9 nuevas).

- [ ] **Step 5: Commit**

```bash
git add src/data/scopes.ts src/data/__tests__/scopes.test.ts
git commit -m "Fase 3: capa de datos de ambitos"
```

---

### Task 3: Archivos (capa de datos)

**Files:**
- Create: `src/data/files.ts`
- Test: `src/data/__tests__/files.test.ts`

**Interfaces:**
- Consumes: `Db` y `migrate` de `src/data/db.ts`; `createScope` de `src/data/scopes.ts`
- Produces:
  - `type StoredFile = { id: number; title: string; diskName: string; mimeType: string | null; size: number | null; scopeId: number | null; scopeName: string | null; importedAt: number }`
  - `listFiles(db: Db, scopeId?: number | null): Promise<StoredFile[]>`
  - `getFile(db: Db, id: number): Promise<StoredFile | null>`
  - `addFile(db: Db, data: { title: string; diskName: string; mimeType?: string | null; size?: number | null; scopeId: number | null }): Promise<StoredFile>`
  - `updateFile(db: Db, id: number, meta: { title: string; scopeId: number | null }): Promise<void>`
  - `deleteFile(db: Db, id: number): Promise<void>`
  - `hasUnscopedFiles(db: Db): Promise<boolean>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/data/__tests__/files.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrate } from '../db';
import {
  addFile,
  deleteFile,
  getFile,
  hasUnscopedFiles,
  listFiles,
  updateFile,
} from '../files';
import { createScope } from '../scopes';
import { createTestDb, type TestDb } from './test-db';

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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
npm test
```

Esperado: FALLA con "Cannot find module '../files'".

- [ ] **Step 3: Escribir `files.ts`**

Crear `src/data/files.ts`:

```ts
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
    const rows = await db.getAllAsync<FileRow>(SELECT_FILES + ORDER_NEWEST_FIRST);
    return rows.map(toStoredFile);
  }

  if (scopeId === null) {
    const rows = await db.getAllAsync<FileRow>(
      `${SELECT_FILES} WHERE f.scope_id IS NULL ${ORDER_NEWEST_FIRST}`
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
    'SELECT COUNT(*) AS total FROM files WHERE scope_id IS NULL'
  );
  return (row?.total ?? 0) > 0;
}
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
npm test
```

Esperado: todas pasan (23 en total).

- [ ] **Step 5: Commit**

```bash
git add src/data/files.ts src/data/__tests__/files.test.ts
git commit -m "Fase 3: capa de datos de archivos"
```

---

### Task 4: Almacenamiento en disco

**Files:**
- Create: `src/data/storage.ts`

**Interfaces:**
- Consumes: `expo-file-system` (`Directory`, `File`, `Paths`)
- Produces:
  - `saveToLibrary(sourceUri: string, originalName: string): Promise<string>` — devuelve el `diskName`
  - `removeFromLibrary(diskName: string): void`
  - `libraryUri(diskName: string): string`
  - `existsInLibrary(diskName: string): boolean`

No lleva pruebas automatizadas: depende del sistema de archivos del celular. Se verifica en la Tarea 8, al importar de verdad.

- [ ] **Step 1: Escribir `storage.ts`**

Crear `src/data/storage.ts`:

```ts
// src/data/storage.ts
// Lo unico que toca el disco. Si vuelve a cambiar la API de
// expo-file-system, se arregla aqui y nada mas.
//
// Los archivos van a una carpeta plana, NO a carpetas por ambito: el ambito
// de un archivo se puede cambiar, y con carpetas habria que moverlo cada vez.
// Van a document/ y no a cache/ porque el sistema puede vaciar la cache.

import { Directory, File, Paths } from 'expo-file-system';

const LIBRARY_FOLDER = 'library';

function libraryDirectory(): Directory {
  const directory = new Directory(Paths.document, LIBRARY_FOLDER);
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  return directory;
}

export function libraryUri(diskName: string): string {
  return new File(libraryDirectory(), diskName).uri;
}

export function existsInLibrary(diskName: string): boolean {
  return new File(libraryDirectory(), diskName).exists;
}

/**
 * Copia el archivo elegido a la carpeta de la app y devuelve el nombre con el
 * que quedo guardado.
 *
 * El nombre se genera: dos archivos pueden llamarse igual, y el nombre
 * original puede traer caracteres que rompan la ruta. El nombre legible vive
 * en la base de datos.
 */
export async function saveToLibrary(sourceUri: string, originalName: string): Promise<string> {
  const source = new File(sourceUri);
  if (!source.exists) {
    throw new Error('No encontré el archivo que elegiste. Intenta de nuevo.');
  }

  const extension = source.extension || extensionOf(originalName);
  const diskName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;

  await source.copy(new File(libraryDirectory(), diskName));
  return diskName;
}

export function removeFromLibrary(diskName: string): void {
  const file = new File(libraryDirectory(), diskName);
  if (file.exists) {
    file.delete();
  }
}

/** Devuelve la extension con el punto, o cadena vacia si no tiene. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot) : '';
}
```

- [ ] **Step 2: Comprobar tipos**

```bash
npx tsc --noEmit
```

Esperado: sólo los dos errores preexistentes del template.

- [ ] **Step 3: Commit**

```bash
git add src/data/storage.ts
git commit -m "Fase 3: almacenamiento de archivos en disco"
```

---

### Task 5: Navegación y arranque de la base de datos

Esta tarea deja la app corriendo con las tres pestañas y la base migrada, aunque las pantallas nuevas todavía estén vacías. Así el resto de tareas se prueban sobre algo que arranca.

**Files:**
- Create: `src/app/files.tsx` (provisional)
- Create: `src/app/settings.tsx` (provisional)
- Delete: `src/app/explore.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/components/app-tabs.tsx`
- Modify: `src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: `DATABASE_NAME` y `migrate` de `src/data/db.ts`
- Produces: las rutas `files` y `settings`, y un `SQLiteProvider` que envuelve la app. A partir de aquí, cualquier pantalla puede llamar `useSQLiteContext()` para obtener la base.

- [ ] **Step 1: Borrar la pantalla del template y crear las dos nuevas**

```bash
git rm src/app/explore.tsx
```

Crear `src/app/files.tsx`:

```tsx
// src/app/files.tsx
// Pantalla Archivos. Se completa en las tareas 7, 8 y 9.

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';

export default function FilesScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Archivos</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1, padding: PogoSpacing.lg },
  title: { ...PogoTypography.title, color: PogoColors.textPrimary },
});
```

Crear `src/app/settings.tsx`:

```tsx
// src/app/settings.tsx
// Pantalla Ajustes. Se completa en la tarea 6.

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Ajustes</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1, padding: PogoSpacing.lg },
  title: { ...PogoTypography.title, color: PogoColors.textPrimary },
});
```

- [ ] **Step 2: Envolver la app en el proveedor de base de datos**

Modificar `src/app/_layout.tsx`. Añadir los imports y envolver `<AppTabs />`:

```tsx
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, migrate } from '@/data/db';

// Corre una sola vez al abrir la base, antes de dibujar nada.
async function initDatabase(db: SQLiteDatabase) {
  // WAL hace las escrituras mas rapidas y evita bloqueos de lectura.
  await db.execAsync("PRAGMA journal_mode = 'wal'");
  await migrate(db);
}
```

Y en el JSX, dentro de `<ThemeProvider>`:

```tsx
<SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
  <AnimatedSplashOverlay />
  <AppTabs />
</SQLiteProvider>
```

- [ ] **Step 3: Actualizar las pestañas**

En `src/components/app-tabs.tsx`, cambiar el `Trigger` de `explore` por `files` y añadir el de `settings`. Reemplazar los dos últimos triggers por:

```tsx
      <NativeTabs.Trigger name="files">
        <NativeTabs.Trigger.Label>Archivos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
```

También cambiar la etiqueta del primer trigger de `Home` a `Pogo`.

- [ ] **Step 4: Hacer lo mismo en la versión web**

Abrir `src/components/app-tabs.web.tsx` y leerlo antes de tocarlo: es la versión web del mismo componente y no usa `NativeTabs`, así que su estructura es distinta y no sirve copiar el bloque de arriba.

Lo que hay que hacer ahí es lo mismo conceptualmente:

1. Donde diga `explore` como nombre o ruta de pestaña, poner `files`
2. Donde diga la etiqueta `Explore`, poner `Archivos`
3. Donde diga la etiqueta `Home`, poner `Pogo`
4. Añadir una tercera entrada para `settings` con la etiqueta `Ajustes`, copiando la forma que tengan las dos existentes en ese archivo

**Este archivo es fácil de olvidar, y si queda desincronizado rompe la versión web sin que se note en el celular.**

- [ ] **Step 5: Comprobar tipos y empaquetado**

```bash
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/pogo-check --clear
```

Esperado: tipos sin errores nuevos, y el empaquetado termina sin fallos.

- [ ] **Step 6: Verificar en el celular**

```bash
npm start
```

Recargar en Expo Go. Comprobar:
- Aparecen tres pestañas: Pogo, Archivos, Ajustes
- Las tres abren sin error
- La pestaña Pogo sigue grabando y respondiendo como antes

- [ ] **Step 7: Commit**

```bash
git add -A src/app src/components
git commit -m "Fase 3: tercera pestana y arranque de la base de datos"
```

---

### Task 6: Pantalla Ajustes — gestión de ámbitos

**Files:**
- Modify: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useSQLiteContext` de `expo-sqlite`; `listScopes`, `createScope`, `renameScope`, `deleteScope` y el tipo `Scope` de `@/data/scopes`
- Produces: nada que consuman otras tareas

- [ ] **Step 1: Escribir la pantalla**

Reemplazar `src/app/settings.tsx`:

```tsx
// src/app/settings.tsx
// Ajustes. Por ahora solo gestiona los ambitos de vida.

import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { createScope, deleteScope, listScopes, renameScope, type Scope } from '@/data/scopes';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);

  // null = cerrado. Un Scope = editando ese. 'new' = creando uno.
  const [editing, setEditing] = useState<Scope | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');

  const refresh = useCallback(async () => {
    setScopes(await listScopes(db));
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEditor = useCallback((target: Scope | 'new') => {
    setEditing(target);
    setDraftName(target === 'new' ? '' : target.name);
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    try {
      if (editing === 'new') {
        await createScope(db, draftName);
      } else {
        await renameScope(db, editing.id, draftName);
      }
      setEditing(null);
      await refresh();
    } catch (error) {
      Alert.alert('No pude guardar', (error as Error).message);
    }
  }, [db, draftName, editing, refresh]);

  const confirmDelete = useCallback(() => {
    if (!editing || editing === 'new') return;
    const scope = editing;

    const detail =
      scope.fileCount === 0
        ? `Se va a borrar el ámbito "${scope.name}".`
        : `"${scope.name}" tiene ${scope.fileCount} ${
            scope.fileCount === 1 ? 'archivo' : 'archivos'
          }. Si borras el ámbito, esos archivos se quedan sin etiqueta, pero NO se borran.`;

    Alert.alert('Borrar ámbito', detail, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteScope(db, scope.id);
          setEditing(null);
          await refresh();
        },
      },
    ]);
  }, [db, editing, refresh]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Ajustes</Text>

        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionLabel}>ÁMBITOS DE VIDA</Text>

          {scopes.length === 0 && (
            <Text style={styles.empty}>
              Todavía no tienes ámbitos. Crea uno para empezar a organizar tus archivos.
            </Text>
          )}

          {scopes.map((scope) => (
            <Pressable
              key={scope.id}
              style={styles.row}
              onPress={() => openEditor(scope)}
              accessibilityLabel={`Editar el ámbito ${scope.name}`}>
              <Text style={styles.rowName}>{scope.name}</Text>
              <Text style={styles.rowCount}>
                {scope.fileCount} {scope.fileCount === 1 ? 'archivo' : 'archivos'}
              </Text>
            </Pressable>
          ))}

          <Pressable style={styles.addRow} onPress={() => openEditor('new')}>
            <Text style={styles.addText}>+ Nuevo ámbito</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={editing !== null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing === 'new' ? 'Nuevo ámbito' : 'Editar ámbito'}
            </Text>

            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="banda, universidad, pareja..."
              placeholderTextColor={PogoColors.textMuted}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={save}
              returnKeyType="done"
            />

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </Pressable>

              {editing !== 'new' && editing !== null && (
                <Pressable onPress={confirmDelete}>
                  <Text style={[styles.actionText, styles.danger]}>Borrar</Text>
                </Pressable>
              )}

              <Pressable onPress={save}>
                <Text style={[styles.actionText, styles.primary]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1 },
  title: {
    ...PogoTypography.title,
    color: PogoColors.textPrimary,
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
    paddingBottom: PogoSpacing.sm,
  },
  list: { padding: PogoSpacing.md, gap: PogoSpacing.xs },
  sectionLabel: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginBottom: PogoSpacing.sm,
  },
  empty: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    paddingVertical: PogoSpacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PogoColors.surface,
    borderWidth: 1,
    borderColor: PogoColors.border,
    borderRadius: 12,
    padding: PogoSpacing.md,
  },
  rowName: { ...PogoTypography.body, color: PogoColors.textPrimary },
  rowCount: { ...PogoTypography.caption, color: PogoColors.textMuted },
  addRow: { padding: PogoSpacing.md, marginTop: PogoSpacing.sm },
  addText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: PogoSpacing.lg,
  },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PogoColors.border,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.md,
  },
  sheetTitle: { ...PogoTypography.body, color: PogoColors.textPrimary, fontWeight: '600' },
  input: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    backgroundColor: PogoColors.surfaceAlt,
    borderRadius: 10,
    padding: PogoSpacing.md,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: PogoSpacing.lg,
  },
  actionText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  primary: { color: PogoColors.textPrimary, fontWeight: '600' },
  danger: { color: PogoColors.danger },
});
```

- [ ] **Step 2: Comprobar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verificar en el celular**

Recargar Expo Go y en la pestaña Ajustes comprobar, uno por uno:

1. Aparecen banda, universidad y pareja, cada uno con "0 archivos"
2. "+ Nuevo ámbito" crea uno y aparece ordenado alfabéticamente
3. Intentar crear "BANDA" muestra "Ya tienes un ámbito llamado..."
4. Intentar guardar con el campo vacío muestra "El ámbito necesita un nombre"
5. Tocar un ámbito permite renombrarlo
6. Borrar un ámbito sin archivos lo quita
7. Cancelar no cambia nada

- [ ] **Step 4: Commit**

```bash
git add src/app/settings.tsx
git commit -m "Fase 3: pantalla de ajustes con gestion de ambitos"
```

---

### Task 7: Pantalla Archivos — lista y filtro

**Files:**
- Create: `src/components/pogo/scope-chips.tsx`
- Create: `src/components/pogo/file-row.tsx`
- Modify: `src/app/files.tsx`

**Interfaces:**
- Consumes: `listFiles`, `hasUnscopedFiles`, `StoredFile` de `@/data/files`; `listScopes`, `Scope` de `@/data/scopes`
- Produces:
  - `<ScopeChips scopes options selected onSelect />` donde `selected` es `number | null | undefined`
  - `<FileRow file onPress />`

- [ ] **Step 1: Escribir los chips**

Crear `src/components/pogo/scope-chips.tsx`:

```tsx
// src/components/pogo/scope-chips.tsx
// Fila de chips de ambito. Se usa para filtrar la lista y para elegir el
// ambito de un archivo en el formulario.
//
// El valor seleccionado tiene tres estados, igual que el filtro de listFiles:
//   undefined -> "Todos"
//   null      -> "Sin ambito"
//   number    -> ese ambito

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { Scope } from '@/data/scopes';

export type ScopeSelection = number | null | undefined;

type ScopeChipsProps = {
  scopes: Scope[];
  selected: ScopeSelection;
  onSelect: (selection: ScopeSelection) => void;
  /** Mostrar el chip "Todos". El filtro lo quiere; el formulario no. */
  showAll?: boolean;
  /** Mostrar el chip "Sin ámbito". */
  showUnscoped?: boolean;
};

export function ScopeChips({
  scopes,
  selected,
  onSelect,
  showAll = false,
  showUnscoped = false,
}: ScopeChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {showAll && (
        <Chip label="Todos" active={selected === undefined} onPress={() => onSelect(undefined)} />
      )}

      {scopes.map((scope) => (
        <Chip
          key={scope.id}
          label={scope.name}
          active={selected === scope.id}
          onPress={() => onSelect(scope.id)}
        />
      ))}

      {showUnscoped && (
        <Chip label="Sin ámbito" active={selected === null} onPress={() => onSelect(null)} />
      )}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: PogoSpacing.sm, paddingHorizontal: PogoSpacing.md, paddingVertical: PogoSpacing.sm },
  chip: {
    paddingHorizontal: PogoSpacing.md,
    paddingVertical: PogoSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PogoColors.border,
    backgroundColor: PogoColors.surface,
  },
  chipActive: { backgroundColor: PogoColors.surfaceAlt, borderColor: PogoColors.textMuted },
  chipText: { ...PogoTypography.caption, color: PogoColors.textSecondary },
  chipTextActive: { color: PogoColors.textPrimary },
});
```

- [ ] **Step 2: Escribir la fila de archivo**

Crear `src/components/pogo/file-row.tsx`:

```tsx
// src/components/pogo/file-row.tsx

import { Pressable, StyleSheet, Text } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { StoredFile } from '@/data/files';

export function FileRow({ file, onPress }: { file: StoredFile; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}>
      <Text style={styles.title} numberOfLines={1}>
        {file.title}
      </Text>
      <Text style={styles.meta}>
        {[file.scopeName ?? 'Sin ámbito', relativeDate(file.importedAt), humanSize(file.size)]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}

/** "hoy", "ayer", "hace 3 días", o la fecha si es mas viejo. */
function relativeDate(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return new Date(timestamp).toLocaleDateString('es');
}

function humanSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: PogoColors.surface,
    borderWidth: 1,
    borderColor: PogoColors.border,
    borderRadius: 12,
    padding: PogoSpacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  title: { ...PogoTypography.body, color: PogoColors.textPrimary },
  meta: { ...PogoTypography.caption, color: PogoColors.textMuted },
});
```

- [ ] **Step 3: Escribir la pantalla con lista y filtro**

Reemplazar `src/app/files.tsx`:

```tsx
// src/app/files.tsx
// Pantalla Archivos: lista filtrable por ambito.
// El boton de importar y las acciones llegan en las tareas 8 y 9.

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FileRow } from '@/components/pogo/file-row';
import { ScopeChips, type ScopeSelection } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { hasUnscopedFiles, listFiles, type StoredFile } from '@/data/files';
import { listScopes, type Scope } from '@/data/scopes';

export default function FilesScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [showUnscoped, setShowUnscoped] = useState(false);
  const [selected, setSelected] = useState<ScopeSelection>(undefined);

  const refresh = useCallback(async () => {
    setScopes(await listScopes(db));
    setShowUnscoped(await hasUnscopedFiles(db));
    setFiles(await listFiles(db, selected));
  }, [db, selected]);

  // Al volver de Ajustes los ambitos pueden haber cambiado, asi que se
  // recarga cada vez que la pantalla toma el foco, no solo al montarse.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Archivos</Text>

        <ScopeChips
          scopes={scopes}
          selected={selected}
          onSelect={setSelected}
          showAll
          showUnscoped={showUnscoped}
        />

        <ScrollView contentContainerStyle={styles.list}>
          {files.length === 0 ? (
            <Text style={styles.empty}>
              {selected === undefined
                ? 'Todavía no has importado nada.'
                : 'No hay archivos con ese ámbito.'}
            </Text>
          ) : (
            files.map((file) => <FileRow key={file.id} file={file} onPress={() => {}} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1 },
  title: {
    ...PogoTypography.title,
    color: PogoColors.textPrimary,
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
  },
  list: { padding: PogoSpacing.md, gap: PogoSpacing.sm },
  empty: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    textAlign: 'center',
    marginTop: PogoSpacing.xl,
  },
});
```

- [ ] **Step 4: Comprobar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verificar en el celular**

Como todavía no se puede importar, meter datos de prueba a mano no es práctico. Comprobar lo que sí se ve:

1. La pestaña Archivos muestra los chips con los ámbitos reales de Ajustes
2. Dice "Todavía no has importado nada."
3. Tocar un chip lo marca y el mensaje cambia a "No hay archivos con ese ámbito."
4. El chip "Sin ámbito" NO aparece (no hay archivos sin ámbito todavía)
5. Crear un ámbito en Ajustes y volver a Archivos: el chip nuevo aparece

- [ ] **Step 6: Commit**

```bash
git add src/components/pogo/scope-chips.tsx src/components/pogo/file-row.tsx src/app/files.tsx
git commit -m "Fase 3: lista de archivos con filtro por ambito"
```

---

### Task 8: Importar archivos

**Files:**
- Create: `src/components/pogo/file-form-sheet.tsx`
- Modify: `src/app/files.tsx`

**Interfaces:**
- Consumes: `expo-document-picker`; `saveToLibrary`, `removeFromLibrary` de `@/data/storage`; `addFile` de `@/data/files`; `createScope` de `@/data/scopes`; `ScopeChips` de la Tarea 7
- Produces: `<FileFormSheet visible initialTitle initialScopeId scopes onCancel onSave onCreateScope />`, reutilizado por la Tarea 9 para editar

- [ ] **Step 1: Escribir la hoja del formulario**

Crear `src/components/pogo/file-form-sheet.tsx`:

```tsx
// src/components/pogo/file-form-sheet.tsx
// Hoja para poner titulo y ambito a un archivo. La misma sirve para importar
// uno nuevo y para editar uno existente.

import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScopeChips } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { Scope } from '@/data/scopes';

type FileFormSheetProps = {
  visible: boolean;
  heading: string;
  initialTitle: string;
  initialScopeId: number | null;
  scopes: Scope[];
  onCancel: () => void;
  onSave: (meta: { title: string; scopeId: number | null }) => Promise<void>;
  /** Crea un ambito al vuelo y devuelve el creado, para seleccionarlo. */
  onCreateScope: (name: string) => Promise<Scope>;
};

export function FileFormSheet({
  visible,
  heading,
  initialTitle,
  initialScopeId,
  scopes,
  onCancel,
  onSave,
  onCreateScope,
}: FileFormSheetProps) {
  const [title, setTitle] = useState(initialTitle);
  const [scopeId, setScopeId] = useState<number | null>(initialScopeId);
  const [newScopeName, setNewScopeName] = useState('');
  const [saving, setSaving] = useState(false);

  // Al abrirse con otro archivo hay que recargar los campos.
  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setScopeId(initialScopeId);
      setNewScopeName('');
    }
  }, [visible, initialTitle, initialScopeId]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title, scopeId });
    } catch (error) {
      Alert.alert('No pude guardar', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addScope = async () => {
    try {
      const created = await onCreateScope(newScopeName);
      setScopeId(created.id);
      setNewScopeName('');
    } catch (error) {
      Alert.alert('No pude crear el ámbito', (error as Error).message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{heading}</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Cómo quieres llamarlo"
            placeholderTextColor={PogoColors.textMuted}
          />

          <Text style={styles.label}>Ámbito</Text>
          <ScopeChips
            scopes={scopes}
            selected={scopeId}
            onSelect={(selection) => setScopeId(selection ?? null)}
            showUnscoped
          />

          <View style={styles.newScopeRow}>
            <TextInput
              style={[styles.input, styles.newScopeInput]}
              value={newScopeName}
              onChangeText={setNewScopeName}
              placeholder="+ nuevo ámbito"
              placeholderTextColor={PogoColors.textMuted}
              autoCapitalize="none"
              onSubmitEditing={addScope}
              returnKeyType="done"
            />
            <Pressable onPress={addScope} disabled={!newScopeName.trim()}>
              <Text
                style={[styles.actionText, !newScopeName.trim() && styles.actionDisabled]}>
                Crear
              </Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} disabled={saving}>
              <Text style={styles.actionText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving}>
              <Text style={[styles.actionText, styles.primary]}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.sm,
  },
  heading: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    fontWeight: '600',
    marginBottom: PogoSpacing.sm,
  },
  label: { ...PogoTypography.caption, color: PogoColors.textMuted },
  input: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    backgroundColor: PogoColors.surfaceAlt,
    borderRadius: 10,
    padding: PogoSpacing.md,
  },
  newScopeRow: { flexDirection: 'row', alignItems: 'center', gap: PogoSpacing.md },
  newScopeInput: { flex: 1 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: PogoSpacing.lg,
    marginTop: PogoSpacing.md,
  },
  actionText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  actionDisabled: { color: PogoColors.textMuted },
  primary: { color: PogoColors.textPrimary, fontWeight: '600' },
});
```

- [ ] **Step 2: Conectar el botón de importar en la pantalla**

En `src/app/files.tsx`, añadir estos imports. **Ojo: `react-native` y `@/data/files` ya están importados desde la Tarea 7 — hay que ampliar esas líneas, no duplicarlas**, o TypeScript dará "Duplicate identifier".

```tsx
import * as DocumentPicker from 'expo-document-picker';

// Ampliar la linea que ya existe:
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FileFormSheet } from '@/components/pogo/file-form-sheet';

// Ampliar la linea que ya existe:
import { addFile, hasUnscopedFiles, listFiles, type StoredFile } from '@/data/files';

// Ampliar la linea que ya existe:
import { listScopes, createScope, type Scope } from '@/data/scopes';

import { removeFromLibrary, saveToLibrary } from '@/data/storage';
```

Añadir el estado del archivo elegido y el manejador, dentro del componente:

```tsx
  // El archivo que el selector devolvio y todavia no se ha guardado.
  const [picked, setPicked] = useState<{
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  } | null>(null);

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
    });
  }, []);

  const saveImported = useCallback(
    async (meta: { title: string; scopeId: number | null }) => {
      if (!picked) return;

      // La copia va primero. Si la insercion falla despues, se borra el
      // archivo copiado para no dejar basura sin registrar.
      const diskName = await saveToLibrary(picked.uri, picked.name);
      try {
        await addFile(db, {
          title: meta.title,
          diskName,
          mimeType: picked.mimeType ?? null,
          size: picked.size ?? null,
          scopeId: meta.scopeId,
        });
      } catch (error) {
        removeFromLibrary(diskName);
        throw error;
      }

      setPicked(null);
      await refresh();
    },
    [db, picked, refresh]
  );

  const addScopeInline = useCallback(
    async (name: string) => {
      const created = await createScope(db, name);
      setScopes(await listScopes(db));
      return created;
    },
    [db]
  );
```

Añadir el botón junto al título, reemplazando el `<Text style={styles.title}>`:

```tsx
        <View style={styles.header}>
          <Text style={styles.title}>Archivos</Text>
          <Pressable onPress={pickFile} accessibilityLabel="Importar un archivo">
            <Text style={styles.plus}>+</Text>
          </Pressable>
        </View>
```

Añadir la hoja al final, justo antes de cerrar el `</View>` exterior:

```tsx
      <FileFormSheet
        visible={picked !== null}
        heading="Guardar archivo"
        initialTitle={picked?.name ?? ''}
        initialScopeId={null}
        scopes={scopes}
        onCancel={() => setPicked(null)}
        onSave={saveImported}
        onCreateScope={addScopeInline}
      />
```

Añadir estos estilos:

```tsx
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
  },
  plus: { fontSize: 32, color: PogoColors.textPrimary, lineHeight: 36 },
```

Y quitar `paddingHorizontal` y `paddingTop` del estilo `title`, que ahora los pone `header`.

- [ ] **Step 3: Comprobar tipos y empaquetado**

```bash
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/pogo-check --clear
```

- [ ] **Step 4: Verificar en el celular**

Éste es el momento en que se prueba `storage.ts` de verdad:

1. Tocar `+` abre el selector del celular
2. Cancelar el selector no hace nada
3. Elegir un PDF abre la hoja con el nombre del archivo ya puesto
4. Cancelar la hoja no añade nada a la lista
5. Elegir un archivo, ponerle ámbito y guardar: aparece en la lista con su ámbito, fecha y tamaño
6. Crear un ámbito desde la hoja lo selecciona solo
7. Guardar sin ámbito: el archivo aparece como "Sin ámbito" y surge el chip "Sin ámbito"
8. **Cerrar la app del todo y reabrirla: los archivos siguen ahí** (esto comprueba que se guardó en `document` y no en la caché)

- [ ] **Step 5: Commit**

```bash
git add src/components/pogo/file-form-sheet.tsx src/app/files.tsx
git commit -m "Fase 3: importar archivos desde el selector del sistema"
```

---

### Task 9: Acciones sobre un archivo

**Files:**
- Create: `src/components/pogo/file-actions-sheet.tsx`
- Modify: `src/app/files.tsx`

**Interfaces:**
- Consumes: `expo-sharing`; `libraryUri`, `existsInLibrary`, `removeFromLibrary` de `@/data/storage`; `updateFile`, `deleteFile` de `@/data/files`; `FileFormSheet` de la Tarea 8
- Produces: nada que consuman otras tareas. Ésta cierra la Fase 3.

- [ ] **Step 1: Escribir la hoja de acciones**

Crear `src/components/pogo/file-actions-sheet.tsx`:

```tsx
// src/components/pogo/file-actions-sheet.tsx
// Las tres acciones de un archivo.
//
// "Abrir" y "compartir" son una sola: en Expo Go, la hoja del sistema que
// abre expo-sharing ya ofrece las apps que pueden manejar el archivo. Un
// abrir separado exigiria getContentUriAsync, que solo existe en la API
// legacy de expo-file-system y solo funciona en Android.

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { StoredFile } from '@/data/files';

type FileActionsSheetProps = {
  file: StoredFile | null;
  onClose: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function FileActionsSheet({
  file,
  onClose,
  onShare,
  onEdit,
  onDelete,
}: FileActionsSheetProps) {
  return (
    <Modal visible={file !== null} transparent animationType="slide">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.heading} numberOfLines={1}>
            {file?.title}
          </Text>

          <Action label="Abrir o compartir" onPress={onShare} />
          <Action label="Editar nombre y ámbito" onPress={onEdit} />
          <Action label="Borrar" onPress={onDelete} danger />

          <Action label="Cancelar" onPress={onClose} muted />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({
  label,
  onPress,
  danger,
  muted,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.actionText, danger && styles.danger, muted && styles.muted]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.xs,
  },
  heading: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginBottom: PogoSpacing.sm,
  },
  action: { paddingVertical: PogoSpacing.md },
  pressed: { opacity: 0.6 },
  actionText: { ...PogoTypography.body, color: PogoColors.textPrimary },
  danger: { color: PogoColors.danger },
  muted: { color: PogoColors.textMuted },
});
```

- [ ] **Step 2: Conectar las acciones en la pantalla**

En `src/app/files.tsx`, añadir imports. De nuevo, ampliar las líneas existentes en vez de duplicarlas — `removeFromLibrary` ya entró en la Tarea 8:

```tsx
import * as Sharing from 'expo-sharing';

import { FileActionsSheet } from '@/components/pogo/file-actions-sheet';

// Ampliar: deleteFile y updateFile son nuevos
import {
  addFile,
  deleteFile,
  hasUnscopedFiles,
  listFiles,
  updateFile,
  type StoredFile,
} from '@/data/files';

// Ampliar: existsInLibrary y libraryUri son nuevos
import {
  existsInLibrary,
  libraryUri,
  removeFromLibrary,
  saveToLibrary,
} from '@/data/storage';
```

Añadir el estado y los manejadores dentro del componente:

```tsx
  // El archivo cuya hoja de acciones esta abierta.
  const [acting, setActing] = useState<StoredFile | null>(null);
  // El archivo que se esta editando. Reutiliza la hoja del formulario.
  const [editingFile, setEditingFile] = useState<StoredFile | null>(null);

  /** Quita de la lista un archivo cuyo fichero ya no esta en el disco. */
  const forget = useCallback(
    async (file: StoredFile) => {
      await deleteFile(db, file.id);
      setActing(null);
      await refresh();
    },
    [db, refresh]
  );

  const shareFile = useCallback(async () => {
    if (!acting) return;
    const file = acting;

    if (!existsInLibrary(file.diskName)) {
      Alert.alert(
        'Ese archivo ya no está',
        'El archivo desapareció del celular. ¿Lo quito de la lista?',
        [
          { text: 'Dejarlo', style: 'cancel' },
          { text: 'Quitarlo', style: 'destructive', onPress: () => forget(file) },
        ]
      );
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('No disponible', 'Este celular no permite abrir ni compartir archivos así.');
      return;
    }

    setActing(null);
    await Sharing.shareAsync(libraryUri(file.diskName), {
      mimeType: file.mimeType ?? undefined,
    });
  }, [acting, forget]);

  const confirmDeleteFile = useCallback(() => {
    if (!acting) return;
    const file = acting;

    Alert.alert('Borrar archivo', `Se va a borrar "${file.title}" del celular.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          // Primero la fila. Si el borrado del disco falla, queda un huerfano
          // invisible; al reves quedaria un archivo visible que ya no existe.
          await deleteFile(db, file.id);
          removeFromLibrary(file.diskName);
          setActing(null);
          await refresh();
        },
      },
    ]);
  }, [acting, db, refresh]);

  const saveEdited = useCallback(
    async (meta: { title: string; scopeId: number | null }) => {
      if (!editingFile) return;
      await updateFile(db, editingFile.id, meta);
      setEditingFile(null);
      await refresh();
    },
    [db, editingFile, refresh]
  );
```

Conectar la fila para que abra la hoja: cambiar `onPress={() => {}}` por `onPress={() => setActing(file)}`.

Añadir las dos hojas antes del cierre del `</View>` exterior, junto a la que ya existe:

```tsx
      <FileActionsSheet
        file={acting}
        onClose={() => setActing(null)}
        onShare={shareFile}
        onEdit={() => {
          setEditingFile(acting);
          setActing(null);
        }}
        onDelete={confirmDeleteFile}
      />

      <FileFormSheet
        visible={editingFile !== null}
        heading="Editar archivo"
        initialTitle={editingFile?.title ?? ''}
        initialScopeId={editingFile?.scopeId ?? null}
        scopes={scopes}
        onCancel={() => setEditingFile(null)}
        onSave={saveEdited}
        onCreateScope={addScopeInline}
      />
```

- [ ] **Step 3: Comprobar tipos, pruebas y empaquetado**

```bash
npm test
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/pogo-check --clear
```

Esperado: 23 pruebas pasan, tipos sin errores nuevos, empaquetado correcto.

- [ ] **Step 4: Verificar la fase completa en el celular**

Recorrido completo:

1. Tocar un archivo abre la hoja con su nombre arriba y las tres acciones
2. "Abrir o compartir" abre la hoja del sistema; elegir un lector de PDF abre el archivo
3. "Editar nombre y ámbito" abre el formulario con los datos cargados; guardar actualiza la fila
4. Cambiar el ámbito de un archivo lo mueve al filtro correcto
5. "Borrar" pide confirmación; al aceptar desaparece de la lista
6. Cerrar la app y reabrirla: los cambios siguen
7. En Ajustes, borrar un ámbito que tiene archivos: la confirmación dice cuántos, y al aceptar esos archivos aparecen bajo "Sin ámbito" en vez de desaparecer
8. La pestaña Pogo sigue grabando y respondiendo

- [ ] **Step 5: Commit**

```bash
git add src/components/pogo/file-actions-sheet.tsx src/app/files.tsx
git commit -m "Fase 3: abrir, editar y borrar archivos"
```

- [ ] **Step 6: Actualizar la documentación**

En `README.md`, en la sección "Estructura", añadir `src/data/` con sus cuatro módulos, y añadir `npm test` a la sección de comandos. Cambiar el encabezado de "Pogo — Fase 2" a "Pogo — Fase 3".

En `Plan_Pogo_v2_ReactNative_ExpoGo.md`, marcar la Fase 3 como terminada.

```bash
git add README.md Plan_Pogo_v2_ReactNative_ExpoGo.md
git commit -m "Fase 3: actualizar documentacion"
```

---

## Riesgos durante la implementación

- **`useFocusEffect` viene de `expo-router`**, no de `@react-navigation/native`. Si el import falla, comprobar en la documentación de la versión 57.
- **El selector del sistema varía por fabricante.** En algunos Android `mimeType` o `size` llegan vacíos. El código ya los trata como opcionales; no asumir que vienen.
- **`NativeTabs.Trigger.Icon` con `sf`/`md`** puede necesitar nombres de icono distintos a `gearshape`/`settings`. Si no aparece el icono, consultar la documentación de native-tabs; no bloquea el resto.
- **El `Modal` de React Native sobre `NativeTabs`** puede comportarse distinto en iOS y Android. Si la hoja queda por debajo de la barra de pestañas, verificar en ambos.
