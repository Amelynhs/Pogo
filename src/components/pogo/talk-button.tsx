// src/components/pogo/talk-button.tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

import { PogoColors, PogoTypography } from '@/constants/pogo-theme';

export type PogoState = 'idle' | 'recording' | 'thinking' | 'speaking';

const STATE_LABELS: Record<PogoState, string> = {
  idle: 'Mantén presionado para hablar',
  recording: 'Escuchando...',
  thinking: 'Pensando...',
  speaking: 'Hablando...',
};

const STATE_COLORS: Record<PogoState, string> = {
  idle: PogoColors.accentIdle,
  recording: PogoColors.accentRecording,
  thinking: PogoColors.accentThinking,
  speaking: PogoColors.accentSpeaking,
};

type TalkButtonProps = {
  state: PogoState;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
};

export function TalkButton({ state, onPressIn, onPressOut, disabled }: TalkButtonProps) {
  const backgroundColor = STATE_COLORS[state];
  const label = STATE_LABELS[state];

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PogoColors.border,
  },
  buttonText: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
