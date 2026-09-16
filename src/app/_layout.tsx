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
  // foreign_keys es por conexion y SQLite no lo persiste: hay que activarlo
  // en cada apertura, no en cada migracion. Sin esto, ON DELETE SET NULL no
  // se aplica y borrar un ambito dejaria sus archivos apuntando a un id que
  // ya no existe en vez de quedar sin ambito.
  await db.execAsync('PRAGMA foreign_keys = ON');
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
