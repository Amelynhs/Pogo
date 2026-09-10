// src/components/pogo/conversation-log.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';

export type PogoMessage = {
  id: number;
  from: 'user' | 'pogo';
  text: string;
};

type ConversationLogProps = {
  messages: PogoMessage[];
};

export function ConversationLog({ messages }: ConversationLogProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {messages.length === 0 && (
        <Text style={styles.emptyText}>
          Mantén presionado el botón de abajo y dile algo a Pogo.
        </Text>
      )}
      {messages.map((msg) => (
        <View
          key={msg.id}
          style={[styles.bubble, msg.from === 'user' ? styles.bubbleUser : styles.bubblePogo]}>
          <Text style={styles.bubbleLabel}>{msg.from === 'user' ? 'Amelyn' : 'Pogo'}</Text>
          <Text style={styles.bubbleText}>{msg.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: PogoSpacing.md,
    gap: PogoSpacing.sm,
  },
  emptyText: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    textAlign: 'center',
    marginTop: PogoSpacing.xl,
  },
  bubble: {
    borderRadius: 12,
    padding: PogoSpacing.md,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: PogoColors.border,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: PogoColors.surfaceAlt,
  },
  bubblePogo: {
    alignSelf: 'flex-start',
    backgroundColor: PogoColors.surface,
  },
  bubbleLabel: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginBottom: 2,
  },
  bubbleText: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
  },
});
