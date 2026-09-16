/// <reference types="node" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extensionFromMimeType } from '../mime.ts';

test('extensionFromMimeType reconoce un PDF', () => {
  assert.equal(extensionFromMimeType('application/pdf'), '.pdf');
});

test('extensionFromMimeType reconoce Word OOXML', () => {
  assert.equal(
    extensionFromMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    '.docx'
  );
});

test('extensionFromMimeType mapea image/jpeg a .jpg y no a .jpeg', () => {
  assert.equal(extensionFromMimeType('image/jpeg'), '.jpg');
});

test('extensionFromMimeType devuelve cadena vacia para null', () => {
  assert.equal(extensionFromMimeType(null), '');
});

test('extensionFromMimeType devuelve cadena vacia para un vnd. desconocido', () => {
  assert.equal(extensionFromMimeType('application/vnd.algo-raro'), '');
});

test('extensionFromMimeType devuelve cadena vacia para un subtipo +xml', () => {
  assert.equal(extensionFromMimeType('application/atom+xml'), '');
});

// application/octet-stream es lo que un content provider de Android devuelve
// cuando de verdad NO sabe que tipo de archivo es. Si la heuristica lo
// aceptara (el subtipo "octet-stream" no tiene '+' ni '.' ni empieza con
// "vnd.", asi que una lista de PROHIBIDOS lo dejaba pasar) estariamos
// estampando una extension inventada sobre un archivo que el sistema
// operativo esta siendo honesto en no poder identificar. Este es el caso
// critico que la lista de PERMITIDOS (SAFE_SUBTYPE) tiene que rechazar.
test('extensionFromMimeType devuelve cadena vacia para application/octet-stream', () => {
  assert.equal(extensionFromMimeType('application/octet-stream'), '');
});

test('extensionFromMimeType ignora los parametros del mimeType antes de buscar en la tabla', () => {
  assert.equal(extensionFromMimeType('text/plain; charset=utf-8'), '.txt');
});

test('extensionFromMimeType normaliza mayusculas antes de buscar en la tabla', () => {
  assert.equal(extensionFromMimeType('IMAGE/JPEG'), '.jpg');
});

test('extensionFromMimeType recorta espacios sobrantes y no deja caracteres sueltos', () => {
  assert.equal(extensionFromMimeType('  image/png  '), '.png');
});

// A diferencia de los casos de arriba (todos resueltos por la tabla), este
// mimeType NO esta en MIME_TO_EXTENSION: solo puede resolverse si la rama
// de la heuristica (el `return `.${subtype}`` al final de
// extensionFromMimeType) sigue viva. Si alguien la borra, esta prueba debe
// fallar; ver la verificacion de mutacion en el reporte.
test('extensionFromMimeType aplica la heuristica para un subtipo seguro que no esta en la tabla', () => {
  assert.equal(extensionFromMimeType('image/bmp'), '.bmp');
});

test('extensionFromMimeType devuelve cadena vacia para un subtipo sin tabla que no parece extension', () => {
  assert.equal(extensionFromMimeType('application/x-custom'), '');
});

test('extensionFromMimeType siempre devuelve una extension con punto inicial para los tipos de la tabla', () => {
  const tipos = [
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/heic',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/markdown',
    'application/rtf',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'application/zip',
  ];

  for (const tipo of tipos) {
    const extension = extensionFromMimeType(tipo);
    assert.ok(extension.startsWith('.'), `${tipo} deberia devolver una extension con punto`);
  }
});
