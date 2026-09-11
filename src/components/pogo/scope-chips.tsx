// src/components/pogo/scope-chips.tsx
// Fila de chips de ambito. Se usa para filtrar la lista y para elegir el
// ambito de un archivo en el formulario.
//
// El valor seleccionado tiene tres estados, igual que el filtro de listFiles:
//   undefined -> "Todos"
//   null      -> "Sin ambito"
//   number    -> ese ambito

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { Scope } from '@/data/scopes';

export type ScopeSelection = number | null | undefined;

type ScopeChipsProps = {
  scopes: Scope[];
  selected: ScopeSelection;
  onSelect: (selection: ScopeSelection) => void;
  /** Mostrar el chip "Todos". El filtro lo quiere; el formulario no. */
  showAll?: boolean;
  /** Mostrar el chip "Sin ámbito". */
  showUnscoped?: boolean;
};

export function ScopeChips({
  scopes,
  selected,
  onSelect,
  showAll = false,
  showUnscoped = false,
}: ScopeChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {showAll && (
        <Chip label="Todos" active={selected === undefined} onPress={() => onSelect(undefined)} />
      )}

      {scopes.map((scope) => (
        <Chip
          key={scope.id}
          label={scope.name}
          active={selected === scope.id}
          onPress={() => onSelect(scope.id)}
        />
      ))}

      {showUnscoped && (
        <Chip label="Sin ámbito" active={selected === null} onPress={() => onSelect(null)} />
      )}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: PogoSpacing.sm, paddingHorizontal: PogoSpacing.md, paddingVertical: PogoSpacing.sm },
  chip: {
    paddingHorizontal: PogoSpacing.md,
    paddingVertical: PogoSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PogoColors.border,
    backgroundColor: PogoColors.surface,
  },
  chipActive: { backgroundColor: PogoColors.surfaceAlt, borderColor: PogoColors.textMuted },
  chipText: { ...PogoTypography.caption, color: PogoColors.textSecondary },
  chipTextActive: { color: PogoColors.textPrimary },
});
