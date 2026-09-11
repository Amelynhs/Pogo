import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DATABASE_NAME, migrate } from '@/data/db';

SplashScreen.preventAutoHideAsync();

// Corre una sola vez al abrir la base, antes de dibujar nada.
async function initDatabase(db: SQLiteDatabase) {
  // WAL hace las escrituras mas rapidas y evita bloqueos de lectura.
  await db.execAsync("PRAGMA journal_mode = 'wal'");
  await migrate(db);
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </SQLiteProvider>
    </ThemeProvider>
  );
}
