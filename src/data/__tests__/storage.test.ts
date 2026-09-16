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

test('extensionFromMimeType aplica la heuristica segura para un subtipo simple', () => {
  assert.equal(extensionFromMimeType('image/png'), '.png');
});

test('extensionFromMimeType siempre devuelve una extension con punto inicial', () => {
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
