// src/app/settings.tsx
// Pantalla Ajustes. Se completa en la tarea 6.

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PogoColors, PogoSpacing, PogoTypography } from '@/constants/pogo-theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Ajustes</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PogoColors.background },
  safeArea: { flex: 1, padding: PogoSpacing.lg },
  title: { ...PogoTypography.title, color: PogoColors.textPrimary },
});
