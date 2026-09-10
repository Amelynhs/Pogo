// src/utils/tts.ts
// Texto a voz con expo-speech (ya está en tus dependencias).

import * as Speech from 'expo-speech';

type SpeakOptions = {
  onDone?: () => void;
  onError?: (error: unknown) => void;
};

export function speak(text: string, { onDone, onError }: SpeakOptions = {}): void {
  Speech.speak(text, {
    language: 'es-ES',
    pitch: 1.0,
    rate: 1.0,
    onDone,
    onError,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
