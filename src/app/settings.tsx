// src/app/settings.tsx
// Ajustes. Por ahora solo gestiona los ambitos de vida.

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { createScope, deleteScope, listScopes, renameScope, type Scope } from '@/data/scopes';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);

  // null = cerrado. Un Scope = editando ese. 'new' = creando uno.
  const [editing, setEditing] = useState<Scope | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setScopes(await listScopes(db));
  }, [db]);

  // Se recarga cada vez que la pantalla vuelve a tener foco (no solo al
  // montar), porque las pestañas se quedan montadas: si se importan
  // archivos en un ambito desde otra pestaña y se vuelve a Ajustes, los
  // conteos por ambito deben reflejar eso, no quedarse con el valor viejo.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openEditor = useCallback((target: Scope | 'new') => {
    setEditing(target);
    setDraftName(target === 'new' ? '' : target.name);
  }, []);

  const save = useCallback(async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        await createScope(db, draftName);
      } else {
        await renameScope(db, editing.id, draftName);
      }
      setEditing(null);
      await refresh();
    } catch (error) {
      Alert.alert('No pude guardar', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [db, draftName, editing, refresh, saving]);

  const confirmDelete = useCallback(() => {
    if (!editing || editing === 'new') return;
    const scope = editing;

    const detail =
      scope.fileCount === 0
        ? `Se va a borrar el ámbito "${scope.name}".`
        : `"${scope.name}" tiene ${scope.fileCount} ${
            scope.fileCount === 1 ? 'archivo' : 'archivos'
          }. Si borras el ámbito, esos archivos se quedan sin etiqueta, pero NO se borran.`;

    Alert.alert('Borrar ámbito', detail, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteScope(db, scope.id);
          setEditing(null);
          await refresh();
        },
      },
    ]);
  }, [db, editing, refresh]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Ajustes</Text>

        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionLabel}>ÁMBITOS DE VIDA</Text>

          {scopes.length === 0 && (
            <Text style={styles.empty}>
              Todavía no tienes ámbitos. Crea uno para empezar a organizar tus archivos.
            </Text>
          )}

          {scopes.map((scope) => (
            <Pressable
              key={scope.id}
              style={styles.row}
              onPress={() => openEditor(scope)}
              accessibilityLabel={`Editar el ámbito ${scope.name}`}>
              <Text style={styles.rowName}>{scope.name}</Text>
              <Text style={styles.rowCount}>
                {scope.fileCount} {scope.fileCount === 1 ? 'archivo' : 'archivos'}
              </Text>
            </Pressable>
          ))}

          <Pressable style={styles.addRow} onPress={() => openEditor('new')}>
            <Text style={styles.addText}>+ Nuevo ámbito</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing === 'new' ? 'Nuevo ámbito' : 'Editar ámbito'}
            </Text>

            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="banda, universidad, pareja..."
              placeholderTextColor={PogoColors.textMuted}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={save}
              returnKeyType="done"
            />

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </Pressable>

              {editing !== 'new' && editing !== null && (
                <Pressable onPress={confirmDelete}>
                  <Text style={[styles.actionText, styles.danger]}>Borrar</Text>
                </Pressable>
              )}

              <Pressable onPress={save} disabled={saving}>
                <Text style={[styles.actionText, styles.primary]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1 },
  title: {
    ...PogoTypography.title,
    color: PogoColors.textPrimary,
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
    paddingBottom: PogoSpacing.sm,
  },
  list: { padding: PogoSpacing.md, gap: PogoSpacing.xs },
  sectionLabel: {
    ...PogoTypography.caption,
    color: PogoColors.textMuted,
    marginBottom: PogoSpacing.sm,
  },
  empty: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    paddingVertical: PogoSpacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PogoColors.surface,
    borderWidth: 1,
    borderColor: PogoColors.border,
    borderRadius: 12,
    padding: PogoSpacing.md,
  },
  rowName: { ...PogoTypography.body, color: PogoColors.textPrimary },
  rowCount: { ...PogoTypography.caption, color: PogoColors.textMuted },
  addRow: { padding: PogoSpacing.md, marginTop: PogoSpacing.sm },
  addText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: PogoSpacing.lg,
  },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PogoColors.border,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.md,
  },
  sheetTitle: { ...PogoTypography.body, color: PogoColors.textPrimary, fontWeight: '600' },
  input: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    backgroundColor: PogoColors.surfaceAlt,
    borderRadius: 10,
    padding: PogoSpacing.md,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: PogoSpacing.lg,
  },
  actionText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  primary: { color: PogoColors.textPrimary, fontWeight: '600' },
  danger: { color: PogoColors.danger },
});
