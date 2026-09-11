// src/components/pogo/file-row.tsx

import { Pressable, StyleSheet, Text } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { StoredFile } from '@/data/files';

export function FileRow({ file, onPress }: { file: StoredFile; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}>
      <Text style={styles.title} numberOfLines={1}>
        {file.title}
      </Text>
      <Text style={styles.meta}>
        {[file.scopeName ?? 'Sin ámbito', relativeDate(file.importedAt), humanSize(file.size)]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}

/** "hoy", "ayer", "hace 3 días", o la fecha si es mas viejo. */
function relativeDate(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return new Date(timestamp).toLocaleDateString('es');
}

function humanSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: PogoColors.surface,
    borderWidth: 1,
    borderColor: PogoColors.border,
    borderRadius: 12,
    padding: PogoSpacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  title: { ...PogoTypography.body, color: PogoColors.textPrimary },
  meta: { ...PogoTypography.caption, color: PogoColors.textMuted },
});
