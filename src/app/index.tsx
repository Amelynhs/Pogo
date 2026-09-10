// src/app/index.tsx
// Pogo - Fase 1 (tab Home)
// -------------------------
// Botón de "mantén presionado para hablar", grabación de audio y una
// respuesta hablada de confirmación. Todavía SIN transcripción real ni
// modelo de lenguaje (eso es la Fase 2).

import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConversationLog, type PogoMessage } from '@/components/pogo/conversation-log';
import { TalkButton, type PogoState } from '@/components/pogo/talk-button';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { requestMicPermission, startRecording, stopRecording } from '@/utils/audio';
import { speak } from '@/utils/tts';

export default function HomeScreen() {
  const [state, setState] = useState<PogoState>('idle');
  const [messages, setMessages] = useState<PogoMessage[]>([]);
  const nextId = useRef(0);

  const addMessage = useCallback((from: PogoMessage['from'], text: string) => {
    nextId.current += 1;
    setMessages((prev) => [...prev, { id: nextId.current, from, text }]);
  }, []);

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
  }, []);

  const handlePressOut = useCallback(async () => {
    setState('thinking');
    try {
      const result = await stopRecording();

      if (!result || !result.durationMillis || result.durationMillis < 400) {
        addMessage('pogo', 'No alcancé a grabar nada, mantén el botón presionado mientras hablas.');
        setState('idle');
        return;
      }

      const seconds = (result.durationMillis / 1000).toFixed(1);
      addMessage('user', `[Audio grabado - ${seconds}s]`);

      // Fase 1: todavía no transcribimos ni pensamos una respuesta real.
      // En la Fase 2 aquí se envía result.uri a Groq (transcripción) y
      // luego el texto a Gemini (respuesta).
      const placeholderReply = `Grabé tu mensaje de ${seconds} segundos. Todavía no puedo entender lo que dijiste - eso lo agregamos en la próxima fase.`;

      addMessage('pogo', placeholderReply);
      setState('speaking');
      speak(placeholderReply, {
        onDone: () => setState('idle'),
        onError: () => setState('idle'),
      });
    } catch (error) {
      console.log('Error al detener grabación:', error);
      addMessage('pogo', 'Tuve un problema procesando el audio, intenta de nuevo.');
      setState('idle');
    }
  }, [addMessage]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Pogo</Text>
          <Text style={styles.subtitle}>Fase 1 · ciclo básico de voz</Text>
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
