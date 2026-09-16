// src/app/files.tsx
// Pantalla Archivos: lista filtrable por ambito, con importar, abrir o
// compartir, editar y borrar.

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
import { runOrAlert } from '@/utils/alert-error';

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
  // Guard contra doble tap en "Abrir o compartir": mismo patron que
  // deletingRef, arriba.
  const sharingRef = useRef(false);

  // Espejo sincrono de `selected`. refresh() lo lee en vez del estado
  // porque, cuando saveImported/saveEdited mueven el filtro al ambito del
  // archivo que se acaba de guardar y llaman a refresh() en el mismo tick,
  // el `selected` capturado en la closure de refresh() todavia seria el
  // viejo: setSelected() no actualiza ese valor hasta el siguiente render.
  const selectedRef = useRef<ScopeSelection>(undefined);

  const setActiveScope = useCallback(
    (next: ScopeSelection) => {
      selectedRef.current = next;
      setSelected(next);
      // Sin este re-query, cambiar de chip no hacia nada visible: refresh()
      // ya no depende de `selected` (selectedRef existe justo para evitar
      // ese closure viejo), y useFocusEffect solo reacciona a que refresh
      // cambie de identidad, cosa que con `selected` fuera de sus deps ya
      // no pasa. Sin esto la lista solo se actualizaba al volver a la
      // pestana, no al tocar un chip.
      void runOrAlert('No pude actualizar la lista', async () => {
        setFiles(await listFiles(db, next));
      });
    },
    [db]
  );

  const refresh = useCallback(async () => {
    const freshScopes = await listScopes(db);
    setScopes(freshScopes);
    setShowUnscoped(await hasUnscopedFiles(db));

    // Si el ambito activo en el filtro ya no existe (por ejemplo, se borro
    // en Ajustes mientras esta pantalla estaba filtrada por el), seguir
    // filtrando por ese id ya no tiene sentido: siempre daria una lista
    // vacia aunque los archivos sigan ahi, sin ambito. Se cae a "Todos".
    const current = selectedRef.current;
    const stillValid = typeof current !== 'number' || freshScopes.some((s) => s.id === current);
    const activeScope = stillValid ? current : undefined;
    if (activeScope !== current) setActiveScope(activeScope);

    setFiles(await listFiles(db, activeScope));
  }, [db, setActiveScope]);

  // Al volver de Ajustes los ambitos pueden haber cambiado, asi que se
  // recarga cada vez que la pantalla toma el foco, no solo al montarse.
  useFocusEffect(
    useCallback(() => {
      void runOrAlert('No pude actualizar la lista', refresh);
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
        try {
          removeFromLibrary(diskName);
        } catch (cleanupError) {
          // No tapar el error original con uno de limpieza: se registra
          // aparte y se relanza el de addFile, que es el que hay que
          // mostrarle a ella.
          console.log('Files - fallo limpiando la copia tras un addFile fallido:', cleanupError);
        }
        throw error;
      }

      setPicked(null);
      // Si el archivo quedo en un ambito distinto al filtro activo, no
      // seria visible en la lista: mover el filtro a su ambito evita que
      // parezca que no paso nada.
      if (selectedRef.current !== undefined && selectedRef.current !== meta.scopeId) {
        setActiveScope(meta.scopeId);
      }
      // Envuelto en runOrAlert (no en el try de arriba, que es el que
      // FileFormSheet.save() captura): si refresh() fallara despues de que
      // addFile ya tuvo exito, no hay que reportar "No pude guardar" sobre
      // un guardado que si funciono.
      await runOrAlert('No pude actualizar la lista', refresh);
    },
    [db, picked, refresh, setActiveScope]
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
      try {
        await deleteFile(db, file.id);
      } catch (error) {
        Alert.alert('No pude borrar', (error as Error).message);
      } finally {
        // Se cierra y se refresca pase lo que pase: dejar la hoja abierta
        // sobre una fila que puede o no seguir existiendo es peor que
        // cerrarla y mostrar el estado real. runOrAlert evita que un
        // refresh() fallido se escape sin manejar de este finally.
        setActing(null);
        await runOrAlert('No pude actualizar la lista', refresh);
      }
    },
    [db, refresh]
  );

  const shareFile = useCallback(async () => {
    if (!acting || sharingRef.current) return;
    const file = acting;
    sharingRef.current = true;

    try {
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
            {
              text: 'Quitarlo',
              style: 'destructive',
              onPress: () => {
                void runOrAlert('No pude quitar el archivo', () => forget(file));
              },
            },
          ]
        );
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('No disponible', 'Este celular no permite abrir ni compartir archivos así.');
        return;
      }

      // setActing(null) va despues del await, no antes: si shareAsync
      // fallara (FileProvider en Android, mime sin app que lo reciba,
      // ninguna app disponible), la hoja ya se habria cerrado sin dejar
      // rastro del fallo. Con el catch de abajo, en cambio, se explica.
      await Sharing.shareAsync(libraryUri(file.diskName), {
        mimeType: file.mimeType ?? undefined,
      });
      setActing(null);
    } catch (error) {
      console.log('Files - fallo al abrir o compartir:', error);
      Alert.alert('No pude abrir ni compartir', (error as Error).message);
    } finally {
      sharingRef.current = false;
    }
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
            try {
              // Primero la fila. Si el borrado del disco falla, queda un
              // huerfano invisible; al reves quedaria un archivo visible
              // que ya no existe.
              await deleteFile(db, file.id);
              removeFromLibrary(file.diskName);
            } catch (error) {
              Alert.alert('No pude borrar', (error as Error).message);
            } finally {
              // Se cierra y se refresca pase lo que pase: si la fila ya se
              // borro pero fallo el disco, o si fallo la fila misma, dejar
              // la hoja abierta mostraria un estado que ya no es cierto.
              // Un refresh() siempre deja ver el estado real. runOrAlert
              // evita que un refresh() fallido llegue sin manejar hasta el
              // finally de abajo, que solo debe resetear el guard.
              setActing(null);
              await runOrAlert('No pude actualizar la lista', refresh);
            }
          } finally {
            // Aislado en su propio finally, sin nada mas dentro: si
            // refresh() (arriba) lanzara, este reset tiene que ejecutarse
            // igual, si no el guard contra doble tap se queda en true para
            // siempre y "Borrar" deja de responder en silencio.
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
      // Mismo razonamiento que en saveImported: si el ambito cambio a uno
      // distinto del filtro activo, la fila desapareceria de la lista sin
      // ninguna señal de que el guardado si funciono.
      if (selectedRef.current !== undefined && selectedRef.current !== meta.scopeId) {
        setActiveScope(meta.scopeId);
      }
      // Igual que en saveImported: fuera del alcance del try que
      // FileFormSheet.save() captura, para no reportar "No pude guardar"
      // sobre una edicion que si se guardo.
      await runOrAlert('No pude actualizar la lista', refresh);
    },
    [db, editingFile, refresh, setActiveScope]
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
          onSelect={setActiveScope}
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
        // La hoja recuerda sus campos entre aperturas porque no se
        // desmonta al cerrarse (Modal solo esconde, no desmonta). La key
        // cambia con cada archivo elegido, asi que React la remonta y los
        // campos arrancan de initialTitle/initialScopeId de nuevo, en vez
        // de arrastrar lo que se haya escrito para el archivo anterior.
        key={picked?.file.uri ?? 'import-closed'}
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
        // Misma razon que la hoja de importar, arriba: la key cambia con
        // cada archivo distinto que se edita, para que la hoja remonte y
        // no arrastre los campos del archivo editado anteriormente.
        key={editingFile?.id ?? 'import'}
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
