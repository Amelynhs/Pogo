// src/app/index.tsx
// Pogo - Fase 2 (tab Home)
// -------------------------
// Ciclo completo: mantienes presionado y hablas -> se graba -> Groq transcribe
// lo que dijiste -> Gemini piensa la respuesta con el historial de la charla ->
// Pogo la muestra y la dice en voz alta.

import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConversationLog, type PogoMessage } from '@/components/pogo/conversation-log';
import { TalkButton, type PogoState } from '@/components/pogo/talk-button';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { usePogoRecorder } from '@/utils/audio';
import { PogoError } from '@/utils/errors';
import { askPogo, userStep, type ConversationStep } from '@/utils/llm';
import { transcribe } from '@/utils/stt';
import { speak } from '@/utils/tts';

// Grabaciones más cortas que esto son botonazos sin querer, no habla.
const MIN_RECORDING_MS = 400;

export default function HomeScreen() {
  const { requestMicPermission, startRecording, stopRecording } = usePogoRecorder();
  const [state, setState] = useState<PogoState>('idle');
  const [messages, setMessages] = useState<PogoMessage[]>([]);
  const nextId = useRef(0);

  // El historial vive en un ref, no en estado: cambia en medio de una petición
  // y no necesita provocar re-render. Se pierde al cerrar la app, a propósito.
  const history = useRef<ConversationStep[]>([]);

  const addMessage = useCallback((from: PogoMessage['from'], text: string) => {
    nextId.current += 1;
    setMessages((prev) => [...prev, { id: nextId.current, from, text }]);
  }, []);

  /** Muestra el mensaje y lo dice en voz alta, dejando el estado en 'idle' al terminar. */
  const reply = useCallback(
    (text: string) => {
      addMessage('pogo', text);
      setState('speaking');
      speak(text, {
        onDone: () => setState('idle'),
        onError: () => setState('idle'),
      });
    },
    [addMessage]
  );

  const handlePressIn = useCallback(async () => {
    const granted = await requestMicPermission();
    if (!granted) {
      Alert.alert(
        'Falta permiso de micrófono',
        'Pogo necesita acceso al micrófono para escucharte. Actívalo en los ajustes del celular.'
      );
      return;
    }
    try {
      await startRecording();
      setState('recording');
    } catch (error) {
      console.log('Error al iniciar grabación:', error);
      Alert.alert('Error', 'No pude empezar a grabar. Intenta de nuevo.');
    }
  }, [requestMicPermission, startRecording]);

  const handlePressOut = useCallback(async () => {
    setState('thinking');
    try {
      const recorded = await stopRecording();

      if (!recorded?.uri || !recorded.durationMillis || recorded.durationMillis < MIN_RECORDING_MS) {
        reply('No alcancé a grabar nada, mantén el botón presionado mientras hablas.');
        return;
      }

      const transcript = await transcribe(recorded.uri);
      if (!transcript) {
        reply('No te entendí, ¿me lo repites?');
        return;
      }
      addMessage('user', transcript);

      history.current = [...history.current, userStep(transcript)];
      const answer = await askPogo(history.current);
      history.current = [...history.current, ...answer.steps];

      reply(answer.reply);
    } catch (error) {
      // Los PogoError ya traen un mensaje pensado para decirse en voz alta.
      if (error instanceof PogoError) {
        reply(error.message);
        return;
      }
      console.log('Error inesperado en el ciclo de voz:', error);
      reply('Algo se me rompió por dentro. Intenta de nuevo.');
    }
  }, [addMessage, reply, stopRecording]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Pogo</Text>
          <Text style={styles.subtitle}>Fase 2 · escucha, piensa y responde</Text>
        </View>

        <ConversationLog messages={messages} />

        <View style={styles.footer}>
          <TalkButton
            state={state}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={state === 'thinking' || state === 'speaking'}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PogoColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
    paddingBottom: PogoSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: PogoColors.border,
  },
  title: {
    ...PogoTypography.title,
    color: PogoColors.textPrimary,
  },
  subtitle: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: PogoSpacing.xl,
  },
});
