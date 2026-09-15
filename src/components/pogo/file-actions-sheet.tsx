// src/components/pogo/file-actions-sheet.tsx
// Las tres acciones de un archivo.
//
// "Abrir" y "compartir" son una sola: en Expo Go, la hoja del sistema que
// abre expo-sharing ya ofrece las apps que pueden manejar el archivo. Un
// abrir separado exigiria getContentUriAsync, que solo existe en la API
// legacy de expo-file-system y solo funciona en Android.

import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { StoredFile } from '@/data/files';

type FileActionsSheetProps = {
  file: StoredFile | null;
  onClose: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function FileActionsSheet({
  file,
  onClose,
  onShare,
  onEdit,
  onDelete,
}: FileActionsSheetProps) {
  return (
    <Modal visible={file !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.heading} numberOfLines={1}>
            {file?.title}
          </Text>

          <Action label="Abrir o compartir" onPress={onShare} />
          <Action label="Editar nombre y ámbito" onPress={onEdit} />
          <Action label="Borrar" onPress={onDelete} danger />

          <Action label="Cancelar" onPress={onClose} muted />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({
  label,
  onPress,
  danger,
  muted,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.actionText, danger && styles.danger, muted && styles.muted]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.xs,
  },
  heading: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginBottom: PogoSpacing.sm,
  },
  action: { paddingVertical: PogoSpacing.md },
  pressed: { opacity: 0.6 },
  actionText: { ...PogoTypography.body, color: PogoColors.textPrimary },
  danger: { color: PogoColors.danger },
  muted: { color: PogoColors.textMuted },
});
