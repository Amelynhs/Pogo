// src/components/pogo/file-form-sheet.tsx
// Hoja para poner titulo y ambito a un archivo. La misma sirve para importar
// uno nuevo y para editar uno existente.

import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScopeChips } from '@/components/pogo/scope-chips';
import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';
import type { Scope } from '@/data/scopes';

type FileFormSheetProps = {
  visible: boolean;
  heading: string;
  initialTitle: string;
  initialScopeId: number | null;
  scopes: Scope[];
  onCancel: () => void;
  onSave: (meta: { title: string; scopeId: number | null }) => Promise<void>;
  /** Crea un ambito al vuelo y devuelve el creado, para seleccionarlo. */
  onCreateScope: (name: string) => Promise<Scope>;
};

export function FileFormSheet({
  visible,
  heading,
  initialTitle,
  initialScopeId,
  scopes,
  onCancel,
  onSave,
  onCreateScope,
}: FileFormSheetProps) {
  const [title, setTitle] = useState(initialTitle);
  const [scopeId, setScopeId] = useState<number | null>(initialScopeId);
  const [newScopeName, setNewScopeName] = useState('');
  // saving (estado) es solo para la UI ("Guardando..." y deshabilitar el
  // boton). El guard real contra el doble tap es savingRef: un ref se
  // lee/escribe en el acto, sin esperar a un render, asi que dos toques que
  // lleguen a la misma closure (doble tap real, antes de que React vuelva a
  // renderizar) ven igual el valor vivo, no uno capturado y desactualizado.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Los campos ya NO se recargan con un efecto: files.tsx le da a esta hoja
  // una `key` distinta por cada archivo (importado o editado), asi que
  // React la remonta entera cuando cambia de archivo y title/scopeId
  // arrancan de initialTitle/initialScopeId de nuevo, sin un setState
  // sincrono dentro de un efecto (ver react-hooks/set-state-in-effect).

  const save = async () => {
    if (savingRef.current) return;

    // Se valida antes de llamar a onSave, no despues: onSave (saveImported)
    // copia el archivo al disco antes de intentar guardar la fila, y esa
    // copia no tiene sentido hacerla para despues borrarla porque el
    // nombre vino vacio.
    if (!title.trim()) {
      Alert.alert('Falta el nombre', 'El archivo necesita un nombre.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({ title, scopeId });
    } catch (error) {
      Alert.alert('No pude guardar', (error as Error).message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const addScope = async () => {
    try {
      const created = await onCreateScope(newScopeName);
      setScopeId(created.id);
      setNewScopeName('');
    } catch (error) {
      Alert.alert('No pude crear el ámbito', (error as Error).message);
    }
  };

  // El boton Cancelar respeta "saving" para no cerrar la hoja a mitad de un
  // guardado en curso; el boton fisico de volver en Android debe hacer lo
  // mismo, si no el guardado sigue en curso pero la hoja desaparece.
  const cancel = () => {
    if (savingRef.current) return;
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{heading}</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Cómo quieres llamarlo"
            placeholderTextColor={PogoColors.textMuted}
          />

          <Text style={styles.label}>Ámbito</Text>
          <ScopeChips
            scopes={scopes}
            selected={scopeId}
            onSelect={(selection) => setScopeId(selection ?? null)}
            showUnscoped
          />

          <View style={styles.newScopeRow}>
            <TextInput
              style={[styles.input, styles.newScopeInput]}
              value={newScopeName}
              onChangeText={setNewScopeName}
              placeholder="+ nuevo ámbito"
              placeholderTextColor={PogoColors.textMuted}
              autoCapitalize="none"
              onSubmitEditing={addScope}
              returnKeyType="done"
            />
            <Pressable onPress={addScope} disabled={!newScopeName.trim()}>
              <Text
                style={[styles.actionText, !newScopeName.trim() && styles.actionDisabled]}>
                Crear
              </Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={cancel} disabled={saving}>
              <Text style={styles.actionText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving}>
              <Text style={[styles.actionText, styles.primary]}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PogoColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: PogoSpacing.lg,
    gap: PogoSpacing.sm,
  },
  heading: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    fontWeight: '600',
    marginBottom: PogoSpacing.sm,
  },
  label: { ...PogoTypography.caption, color: PogoColors.textMuted },
  input: {
    ...PogoTypography.body,
    color: PogoColors.textPrimary,
    backgroundColor: PogoColors.surfaceAlt,
    borderRadius: 10,
    padding: PogoSpacing.md,
  },
  newScopeRow: { flexDirection: 'row', alignItems: 'center', gap: PogoSpacing.md },
  newScopeInput: { flex: 1 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: PogoSpacing.lg,
    marginTop: PogoSpacing.md,
  },
  actionText: { ...PogoTypography.body, color: PogoColors.textSecondary },
  actionDisabled: { color: PogoColors.textMuted },
  primary: { color: PogoColors.textPrimary, fontWeight: '600' },
});
