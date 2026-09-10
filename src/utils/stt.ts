// src/utils/stt.ts
// Transcripción de voz a texto con la API de Groq (Whisper).
//
// El preset HIGH_QUALITY de expo-audio graba en .m4a, uno de los formatos que
// Groq acepta, así que el archivo se sube tal cual sin convertir.
//
// Sobre el FormData: desde el SDK 54 el `fetch` de Expo NO acepta el objeto
// {uri, name, type} que se usaba históricamente en React Native; lanza
// "Unsupported FormDataPart implementation". Sólo admite strings, Blobs, u
// objetos con bytes(). Por eso subimos un `File` de expo-file-system, que
// implementa esa interfaz.

import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { GROQ_API_KEY } from './config';
import { PogoError } from './errors';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';

/**
 * Sube la grabación a Groq y devuelve lo que se entendió.
 * Devuelve cadena vacía si el audio no tenía habla reconocible.
 */
export async function transcribe(uri: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new PogoError(
      'No tengo configurada mi clave de transcripción, así que no puedo entender lo que dices.'
    );
  }

  const file = new File(uri);
  if (!file.exists || file.size === 0) {
    console.log('Groq - grabación vacía o inexistente:', uri, 'size:', file.size);
    throw new PogoError('La grabación salió vacía. Intenta de nuevo.');
  }
  console.log('Groq - subiendo', file.name, file.type, file.size, 'bytes');

  const form = new FormData();
  form.append('file', file as unknown as Blob);
  form.append('model', GROQ_MODEL);
  form.append('language', 'es');
  form.append('response_format', 'json');

  let response: Response;
  try {
    // Sin Content-Type a mano: fetch le pone el boundary correcto al FormData.
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });
  } catch (error) {
    console.log('Groq - fallo de red:', error);
    throw new PogoError('No pude conectarme para entender lo que dijiste. Revisa tu internet.');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.log('Groq - error HTTP', response.status, detail);

    if (response.status === 401) {
      throw new PogoError('Mi clave de transcripción no es válida. Hay que revisarla.');
    }
    if (response.status === 429) {
      throw new PogoError('Se me acabó la cuota de transcripción por ahora. Prueba en un rato.');
    }
    throw new PogoError('Tuve un problema entendiendo el audio. Intenta de nuevo.');
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? '').trim();
}
