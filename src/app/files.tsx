// src/app/files.tsx
// Pantalla Archivos: lista filtrable por ambito.
// El boton de importar y las acciones llegan en las tareas 8 y 9.

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FileRow } from '@/components/pogo/file-row';
import { ScopeChips, type ScopeSelection } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import { hasUnscopedFiles, listFiles, type StoredFile } from '@/data/files';
import { listScopes, type Scope } from '@/data/scopes';

export default function FilesScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [showUnscoped, setShowUnscoped] = useState(false);
  const [selected, setSelected] = useState<ScopeSelection>(undefined);

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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Archivos</Text>

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
  },
  list: { padding: PogoSpacing.md, gap: PogoSpacing.sm },
  empty: {
    ...PogoTypography.body,
    color: PogoColors.textMuted,
    textAlign: 'center',
    marginTop: PogoSpacing.xl,
  },
});
