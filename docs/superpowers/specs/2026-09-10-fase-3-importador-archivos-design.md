# Fase 3 — Importador de archivos

**Fecha:** 2026-09-10
**Estado:** aprobado, pendiente de plan de implementación

## Objetivo

Que Amelyn pueda importar archivos desde su celular (partituras, trabajos,
imágenes, notas), etiquetarlos por ámbito de vida y encontrarlos después.
Todo guardado localmente, sin nube.

## Alcance

**Entra:**

- Importar un archivo desde el selector del sistema
- Etiquetarlo con un ámbito de vida y darle un título
- Verlos en una lista, filtrable por ámbito
- Abrir/compartir, editar y borrar un archivo
- Crear, renombrar y borrar ámbitos

**No entra:**

- Leer el contenido de los archivos (decidido: la búsqueda de la Fase 4 será
  por título, ámbito y fecha, no por contenido)
- Buscar (Fase 4), eventos e ideas (Fase 5)
- Importar varios archivos a la vez
- Sincronización o respaldo

## Decisiones y su porqué

| Decisión | Por qué |
|---|---|
| SQLite, no un archivo JSON | Las Fases 4 y 5 traen búsqueda, eventos e ideas con relaciones. Migrar después obligaría a rehacer la capa de datos con archivos ya guardados de por medio. |
| Carpeta plana, no carpetas por ámbito | El ámbito de un archivo se puede cambiar. Con carpetas por ámbito habría que mover el archivo en disco cada vez. |
| Copiar a `Paths.document`, no dejar en caché | `expo-document-picker` copia a la caché por defecto, y el sistema puede vaciarla cuando falta espacio. `document` está a salvo. |
| Borrar un ámbito NO borra sus archivos | Borrar una etiqueta no debería borrar las partituras. Los archivos quedan "sin ámbito". |
| Una sola acción "abrir o compartir" | En Expo Go, `expo-sharing` abre la hoja del sistema con las apps que pueden manejar el archivo — eso ya es abrir. Un "abrir" separado exigiría `getContentUriAsync`, que sólo existe en la API legacy de `expo-file-system` y sólo sirve en Android. |
| Ajustes como tercera pestaña | El layout actual es `NativeTabs` plano. Un engranaje que empuje una pantalla obligaría a reestructurar la navegación en stacks anidados. |
| La capa de datos recibe la base por parámetro | Permite probar con SQLite real en Node en vez de simulacros. Ver "Pruebas". |

## Modelo de datos

### Archivos en disco

Carpeta plana `document/library/`. Cada archivo se guarda con un nombre
generado único más la extensión original. El título legible vive sólo en la
base de datos: así se puede renombrar sin tocar el disco y dos archivos con el
mismo nombre no chocan.

### Esquema

```sql
PRAGMA journal_mode = 'wal';

CREATE TABLE scopes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  disk_name    TEXT    NOT NULL UNIQUE,
  mime_type    TEXT,
  size         INTEGER,
  scope_id     INTEGER REFERENCES scopes(id) ON DELETE SET NULL,
  imported_at  INTEGER NOT NULL
);

CREATE INDEX idx_files_scope    ON files(scope_id);
CREATE INDEX idx_files_imported ON files(imported_at DESC);
```

`PRAGMA foreign_keys = ON` hay que ejecutarlo **en cada apertura de conexión**,
no sólo en la migración: SQLite no lo persiste. Sin eso, `ON DELETE SET NULL`
no se aplica y los archivos quedarían apuntando a un ámbito inexistente.

### Migraciones

Con `SQLiteProvider onInit` y `PRAGMA user_version`, como documenta Expo. La
versión inicial es 1. Las Fases 4 y 5 añadirán versiones sin perder datos.

### Siembra

En la primera ejecución (versión 0 → 1) se crean tres ámbitos: *banda*,
*universidad* y *pareja*. Se pueden renombrar o borrar.

## Interfaz

### Pestaña Archivos

Reemplaza la pestaña *Explore* del template.

```
┌──────────────────────────────┐
│  Archivos                [+] │
│ ──────────────────────────── │
│ (Todos) (banda) (universidad)│  <- filtro, se desliza
│ ──────────────────────────── │
│  Partitura Marcha            │
│  banda · hace 2 días · 2.4 MB│
│                              │
│  Ensayo final                │
│  universidad · ayer · 800 KB │
└──────────────────────────────┘
```

Ordenados por fecha de importación, más reciente primero. Si no hay archivos,
un texto corto y un botón para importar el primero.

Los chips del filtro son: **Todos**, un chip por ámbito, y **Sin ámbito** al
final — este último sólo aparece si existe al menos un archivo sin ámbito, para
no ocupar espacio cuando no hace falta.

### Importar

1. El `+` abre el selector del sistema (`type: '*/*'`, un archivo)
2. Al volver, una hoja pide título (prellenado con el nombre original) y ámbito
3. En esa misma hoja se puede crear un ámbito nuevo sin ir a Ajustes
4. Al guardar: se copia el archivo a `document/library/` y se inserta la fila

El archivo se copia **al guardar**, no al elegirlo. Si se cancela la hoja, no
queda basura en el disco.

### Acciones sobre un archivo

Al tocarlo, una hoja con tres opciones:

- **Abrir o compartir** — `expo-sharing`, hoja del sistema
- **Editar** — la misma hoja de importar, con los datos cargados
- **Borrar** — pide confirmación

### Pestaña Ajustes

```
┌──────────────────────────────┐
│  Ajustes                     │
│ ──────────────────────────── │
│  ÁMBITOS DE VIDA             │
│                              │
│  banda              3 archivos│
│  universidad       12 archivos│
│  pareja             0 archivos│
│                              │
│  + Nuevo ámbito              │
└──────────────────────────────┘
```

Tocar un ámbito abre un diálogo con su nombre editable, un botón **Guardar** y
un botón **Borrar**. Borrar pide confirmación indicando cuántos archivos
quedarán sin ámbito ("banda tiene 3 archivos. Si borras el ámbito, esos
archivos se quedan sin etiqueta, pero no se borran").

El icono de la pestaña usa iconos del sistema (`sf` en iOS, `md` en Android),
porque `assets/images/tabIcons/` sólo tiene `home` y `explore`. Queda una
inconsistencia visual entre pestañas que resuelve la Fase 6.

## Estructura del código

Carpeta nueva `src/data/`, separada de la UI. Identificadores y nombres de
archivo en inglés, comentarios y textos de interfaz en español, como el resto
del proyecto.

| Archivo | Responsabilidad |
|---|---|
| `data/db.ts` | Tipo `Db`, migraciones, apertura |
| `data/scopes.ts` | Ámbitos: listar con conteo, crear, renombrar, borrar |
| `data/files.ts` | Archivos: listar con filtro, importar, editar, borrar |
| `data/storage.ts` | Copiar y borrar del disco. Único módulo que toca `expo-file-system` |

`storage.ts` va separado a propósito: es la única pieza que toca el disco. Si
cambia la API de `expo-file-system` — como ya pasó en la Fase 2 — se arregla en
un archivo.

### Interfaces

```ts
// data/db.ts
// Interfaz mínima que cumple SQLiteDatabase de expo-sqlite. Los módulos de
// datos dependen de esto, no del paquete, para poder probarlos en Node.
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

// data/scopes.ts
export type Scope = { id: number; name: string; fileCount: number };

listScopes(db: Db): Promise<Scope[]>
createScope(db: Db, name: string): Promise<Scope>
renameScope(db: Db, id: number, name: string): Promise<void>
deleteScope(db: Db, id: number): Promise<void>

// data/files.ts
export type StoredFile = {
  id: number; title: string; diskName: string;
  mimeType: string | null; size: number | null;
  scopeId: number | null; scopeName: string | null; importedAt: number;
};

// El filtro tiene tres estados y por eso el parámetro distingue undefined de null:
//   listFiles(db)        -> todos los archivos
//   listFiles(db, 3)     -> los del ámbito 3
//   listFiles(db, null)  -> los que no tienen ámbito
listFiles(db: Db, scopeId?: number | null): Promise<StoredFile[]>
importFile(db: Db, source: { uri: string; name: string; mimeType?: string; size?: number },
           meta: { title: string; scopeId: number | null }): Promise<StoredFile>
updateFile(db: Db, id: number, meta: { title: string; scopeId: number | null }): Promise<void>
deleteFile(db: Db, id: number): Promise<void>

// data/storage.ts
saveToLibrary(sourceUri: string, originalName: string): Promise<string>  // devuelve diskName
removeFromLibrary(diskName: string): Promise<void>
libraryUri(diskName: string): string
existsInLibrary(diskName: string): boolean
```

### Pantallas

- `app/explore.tsx` pasa a ser `app/files.tsx`
- `app/settings.tsx` (nuevo)
- `app/_layout.tsx` envuelve todo en `<SQLiteProvider>`, para que la migración
  corra antes de dibujar nada
- `components/app-tabs.tsx` **y** `components/app-tabs.web.tsx` — son dos
  archivos y es fácil olvidar el segundo

## Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Nombre de ámbito repetido | La restricción `UNIQUE` falla; el mensaje es "ya tienes un ámbito con ese nombre", no un error de SQL |
| Nombre de ámbito vacío o sólo espacios | No se permite guardar |
| Borrar un archivo | Primero la fila, después el archivo del disco. Al revés, si falla el borrado de la fila quedaría un archivo visible que ya no existe. En el peor caso queda un huérfano invisible que no rompe nada |
| Archivo que ya no está en disco | Al tocarlo, se avisa y se ofrece quitarlo de la lista |
| Falla la copia (sin espacio) | No se inserta nada en la base; mensaje claro |
| Importación cancelada | No pasa nada, no queda basura |
| `expo-sharing` no disponible | Se comprueba con `isAvailableAsync` antes de ofrecer la acción |

Los errores de esta capa se muestran en un `Alert`, no se hablan. `PogoError`
(`utils/errors.ts`) queda reservado para el ciclo de voz, que es donde tiene
sentido que Pogo diga el error en voz alta.

## Pruebas

`jest-expo` **simula** los módulos nativos del SDK, así que probar `expo-sqlite`
a través de él no probaría SQL real. Por eso los módulos de `data/` reciben la
base como parámetro (`Db`): en la app se les pasa el `SQLiteDatabase` de
expo-sqlite, y en las pruebas un adaptador delgado sobre `node:sqlite`
(incorporado en Node 22+; aquí corre Node 24). SQL real, cero simulacros.

Verificado que `node:sqlite` ejecuta el esquema y respeta `ON DELETE SET NULL`
y `UNIQUE`.

Qué se prueba:

- Crear un ámbito; rechazar el duplicado y el vacío
- Renombrar un ámbito
- Borrar un ámbito con archivos: los archivos sobreviven con `scope_id` nulo
- Conteo de archivos por ámbito
- Listar archivos en los tres estados del filtro: todos, un ámbito, sin ámbito
- Orden por fecha de importación
- Editar título y ámbito de un archivo
- Borrar un archivo

`storage.ts` y las pantallas no se prueban automáticamente: dependen del
sistema de archivos del celular y de la interfaz. Se verifican a mano en
Expo Go.

## Riesgos conocidos

- **El selector del sistema varía por fabricante.** En algunos Android el
  `mimeType` llega vacío o genérico. El título y la extensión no dependen de
  él, así que sólo afecta al icono o etiqueta que se muestre.
- **No hay respaldo.** Si se desinstala la app, se pierden los archivos
  importados. Está fuera del alcance, pero conviene saberlo.
- **Archivos grandes.** No se pone límite de tamaño. Un video largo puede
  tardar en copiarse; la interfaz muestra un indicador mientras tanto.

## Qué habilita para las fases siguientes

- **Fase 4 (búsqueda):** `listFiles` ya filtra por ámbito; añadir búsqueda por
  título es una cláusula más. Pogo puede recibir la lista de ámbitos como
  contexto para entender "las cosas de la banda".
- **Fase 5 (eventos e ideas):** tablas nuevas con una migración a la versión 2,
  relacionadas con `files` por `id`.
