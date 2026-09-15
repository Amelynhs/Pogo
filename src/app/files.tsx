// src/app/files.tsx
// Pantalla Archivos: lista filtrable por ambito.
// El boton de importar y las acciones llegan en las tareas 8 y 9.

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FileFormSheet } from '@/components/pogo/file-form-sheet';
import { FileRow } from '@/components/pogo/file-row';
import { ScopeChips, type ScopeSelection } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { addFile, hasUnscopedFiles, listFiles, type StoredFile } from '@/data/files';
import { createScope, listScopes, type Scope } from '@/data/scopes';
import { pickFileFromDevice, removeFromLibrary, saveToLibrary, type PickedFile } from '@/data/storage';

export default function FilesScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [showUnscoped, setShowUnscoped] = useState(false);
  const [selected, setSelected] = useState<ScopeSelection>(undefined);

  // El archivo que el selector devolvio y todavia no se ha guardado.
  const [picked, setPicked] = useState<PickedFile | null>(null);

  const refresh = useCallback(async () => {
    setScopes(await listScopes(db));
    setShowUnscoped(await hasUnscopedFiles(db));
    setFiles(await listFiles(db, selected));
  }, [db, selected]);

  // Al volver de Ajustes los ambitos pueden haber cambiado, asi que se
  // recarga cada vez que la pantalla toma el foco, no solo al montarse.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const pickFile = useCallback(async () => {
    let result: PickedFile | null;
    try {
      result = await pickFileFromDevice();
    } catch (error) {
      Alert.alert('No pude abrir el selector de archivos', (error as Error).message);
      return;
    }
    if (result === null) return;

    setPicked(result);
  }, []);

  const saveImported = useCallback(
    async (meta: { title: string; scopeId: number | null }) => {
      if (!picked) return;

      // La copia va primero. Si la insercion falla despues, se borra el
      // archivo copiado para no dejar basura sin registrar.
      const diskName = await saveToLibrary(picked);
      try {
        await addFile(db, {
          title: meta.title,
          diskName,
          mimeType: picked.mimeType ?? null,
          size: picked.size ?? null,
          scopeId: meta.scopeId,
        });
      } catch (error) {
        removeFromLibrary(diskName);
        throw error;
      }

      setPicked(null);
      await refresh();
    },
    [db, picked, refresh]
  );

  const addScopeInline = useCallback(
    async (name: string) => {
      const created = await createScope(db, name);
      setScopes(await listScopes(db));
      return created;
    },
    [db]
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Archivos</Text>
          <Pressable onPress={pickFile} accessibilityLabel="Importar un archivo">
            <Text style={styles.plus}>+</Text>
          </Pressable>
        </View>

        <ScopeChips
          scopes={scopes}
          selected={selected}
          onSelect={setSelected}
          showAll
          showUnscoped={showUnscoped}
        />

        <ScrollView contentContainerStyle={styles.list}>
          {files.length === 0 ? (
            <Text style={styles.empty}>
              {selected === undefined
                ? 'Todavía no has importado nada.'
                : 'No hay archivos con ese ámbito.'}
            </Text>
          ) : (
            files.map((file) => <FileRow key={file.id} file={file} onPress={() => {}} />)
          )}
        </ScrollView>
      </SafeAreaView>

      <FileFormSheet
        visible={picked !== null}
        heading="Guardar archivo"
        initialTitle={picked?.name ?? ''}
        initialScopeId={null}
        scopes={scopes}
        onCancel={() => setPicked(null)}
        onSave={saveImported}
        onCreateScope={addScopeInline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PogoSpacing.lg,
    paddingTop: PogoSpacing.md,
  },
  title: {
    ...PogoTypography.title,
    color: PogoColors.textPrimary,
  },
  plus: { fontSize: 32, color: PogoColors.textPrimary, lineHeight: 36 },
  list: { padding: PogoSpacing.md, gap: PogoSpacing.sm },
  empty: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    textAlign: 'center',
    marginTop: PogoSpacing.xl,
  },
});
