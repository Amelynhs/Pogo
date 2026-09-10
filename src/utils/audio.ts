// src/utils/audio.ts
// Grabación de audio con expo-audio.
//
// Nota: `expo-av` fue eliminado del SDK de Expo a partir de la versión 54,
// por eso Expo Go ya no trae el módulo nativo `ExponentAV`. El reemplazo
// oficial para grabar/reproducir audio es `expo-audio`, cuya API se basa en
// hooks, así que este archivo expone un hook en vez de funciones sueltas.

import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback } from 'react';

export type StopRecordingResult = {
  uri: string | null;
  durationMillis: number | null;
};

export function usePogoRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    return permission.granted;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<StopRecordingResult | null> => {
    if (!recorder.isRecording) return null;

    // El estado hay que leerlo ANTES de parar: al detenerse la duración
    // vuelve a cero.
    const { durationMillis } = recorder.getStatus();
    await recorder.stop();

    // Salimos del modo grabación. Si no, en iOS la voz de Pogo sale por el
    // auricular (muy bajito) en vez del altavoz.
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    return { uri: recorder.uri, durationMillis: durationMillis ?? null };
  }, [recorder]);

  return { requestMicPermission, startRecording, stopRecording };
}
