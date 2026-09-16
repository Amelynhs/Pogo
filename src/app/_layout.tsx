import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DATABASE_NAME, initDatabase as initDb } from '@/data/db';

SplashScreen.preventAutoHideAsync();

// Corre una sola vez al abrir la base, antes de dibujar nada.
async function initDatabase(db: SQLiteDatabase) {
  // WAL hace las escrituras mas rapidas y evita bloqueos de lectura. Se
  // queda aqui, no en data/db.ts: es un ajuste de rendimiento sobre archivo
  // real, y las bases :memory: que usan las pruebas ni lo soportan.
  await db.execAsync("PRAGMA journal_mode = 'wal'");
  // foreign_keys (por conexion, no persiste) y migrate() viven en
  // data/db.ts como initDatabase(), compartida con las pruebas, para que
  // no haya una segunda copia del pragma que se pueda desincronizar de
  // esta.
  await initDb(db);
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
