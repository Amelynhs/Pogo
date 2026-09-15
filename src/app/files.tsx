// src/app/files.tsx
// Pantalla Archivos: lista filtrable por ambito.
// El boton de importar y las acciones llegan en las tareas 8 y 9.

import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FileActionsSheet } from '@/components/pogo/file-actions-sheet';
import { FileFormSheet } from '@/components/pogo/file-form-sheet';
import { FileRow } from '@/components/pogo/file-row';
import { ScopeChips, type ScopeSelection } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import {
  addFile,
  deleteFile,
  hasUnscopedFiles,
  listFiles,
  updateFile,
  type StoredFile,
} from '@/data/files';
import { createScope, listScopes, type Scope } from '@/data/scopes';
import {
  existsInLibrary,
  libraryUri,
  pickFileFromDevice,
  removeFromLibrary,
  saveToLibrary,
  type PickedFile,
} from '@/data/storage';

export default function FilesScreen() {
  const db = useSQLiteContext();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [showUnscoped, setShowUnscoped] = useState(false);
  const [selected, setSelected] = useState<ScopeSelection>(undefined);

  // El archivo que el selector devolvio y todavia no se ha guardado.
  const [picked, setPicked] = useState<PickedFile | null>(null);

  // El archivo cuya hoja de acciones esta abierta.
  const [acting, setActing] = useState<StoredFile | null>(null);
  // El archivo que se esta editando. Reutiliza la hoja del formulario.
  const [editingFile, setEditingFile] = useState<StoredFile | null>(null);
  // Guard contra doble tap en "Borrar": un ref se lee/escribe en el acto,
  // sin esperar a un render (mismo patron que savingRef en
  // file-form-sheet.tsx y settings.tsx). Borrar la fila y el archivo del
  // disco son operaciones que ya toleran repetirse sin dano, pero sin este
  // guard un doble tap dispararia dos veces la confirmacion nativa y, si el
  // sistema la deja repetirse, dos refresh() innecesarios.
  const deletingRef = useRef(false);

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

  /** Quita de la lista un archivo cuyo fichero ya no esta en el disco. */
  const forget = useCallback(
    async (file: StoredFile) => {
      await deleteFile(db, file.id);
      setActing(null);
      await refresh();
    },
    [db, refresh]
  );

  const shareFile = useCallback(async () => {
    if (!acting) return;
    const file = acting;

    // existsInLibrary usa la misma propiedad `exists` de expo-file-system
    // que dio un falso negativo con el document picker (ver storage.ts).
    // Aqui el archivo vive DENTRO de la carpeta de la app (Paths.document),
    // el mismo dominio en el que expo-file-system funciona bien en Expo Go,
    // asi que `exists` es de fiar para este caso: el problema anterior era
    // por una URI ajena al dominio de la app, no por `exists` en si mismo.
    if (!existsInLibrary(file.diskName)) {
      Alert.alert(
        'Ese archivo ya no está',
        'El archivo desapareció del celular. ¿Lo quito de la lista?',
        [
          { text: 'Dejarlo', style: 'cancel' },
          { text: 'Quitarlo', style: 'destructive', onPress: () => forget(file) },
        ]
      );
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('No disponible', 'Este celular no permite abrir ni compartir archivos así.');
      return;
    }

    setActing(null);
    await Sharing.shareAsync(libraryUri(file.diskName), {
      mimeType: file.mimeType ?? undefined,
    });
  }, [acting, forget]);

  const confirmDeleteFile = useCallback(() => {
    if (!acting) return;
    const file = acting;

    Alert.alert('Borrar archivo', `Se va a borrar "${file.title}" del celular.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          try {
            // Primero la fila. Si el borrado del disco falla, queda un
            // huerfano invisible; al reves quedaria un archivo visible que
            // ya no existe.
            await deleteFile(db, file.id);
            removeFromLibrary(file.diskName);
            setActing(null);
            await refresh();
          } finally {
            deletingRef.current = false;
          }
        },
      },
    ]);
  }, [acting, db, refresh]);

  const saveEdited = useCallback(
    async (meta: { title: string; scopeId: number | null }) => {
      if (!editingFile) return;
      await updateFile(db, editingFile.id, meta);
      setEditingFile(null);
      await refresh();
    },
    [db, editingFile, refresh]
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
            files.map((file) => (
              <FileRow key={file.id} file={file} onPress={() => setActing(file)} />
            ))
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

      <FileActionsSheet
        file={acting}
        onClose={() => setActing(null)}
        onShare={shareFile}
        onEdit={() => {
          setEditingFile(acting);
          setActing(null);
        }}
        onDelete={confirmDeleteFile}
      />

      <FileFormSheet
        visible={editingFile !== null}
        heading="Editar archivo"
        initialTitle={editingFile?.title ?? ''}
        initialScopeId={editingFile?.scopeId ?? null}
        scopes={scopes}
        onCancel={() => setEditingFile(null)}
        onSave={saveEdited}
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
