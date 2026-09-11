// src/app/files.tsx
// Pantalla Archivos. Se completa en las tareas 7, 8 y 9.

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';

export default function FilesScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Archivos</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1, padding: PogoSpacing.lg },
  title: { ...PogoTypography.title, color: PogoColors.textPrimary },
});
