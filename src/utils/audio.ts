// src/utils/audio.ts
// Manejo de grabación de audio usando expo-av (ya está en tus dependencias).

import { Audio } from 'expo-av';

let recording: Audio.Recording | null = null;

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: newRecording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = newRecording;
}

export type StopRecordingResult = {
  uri: string | null;
  durationMillis: number | null;
};

export async function stopRecording(): Promise<StopRecordingResult | null> {
  if (!recording) return null;

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  const status = await recording.getStatusAsync().catch(() => null);
  const durationMillis = status?.durationMillis ?? null;

  recording = null;
  return { uri, durationMillis };
}
