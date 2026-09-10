// src/utils/errors.ts
// Error cuyo mensaje está pensado para que Pogo lo diga en voz alta tal cual.
// Todo lo que no sea un PogoError es un fallo inesperado y se maneja aparte.

export class PogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PogoError';
  }
}
