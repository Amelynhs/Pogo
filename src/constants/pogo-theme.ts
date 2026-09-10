// src/constants/pogo-theme.ts
// Paleta de Pogo: escala de grises oscura, suave y seria - fija, no cambia
// con el modo claro/oscuro del sistema (a diferencia de ThemedView/ThemedText
// del template base, que sí lo hacen).

export const PogoColors = {
  background: '#121214',
  surface: '#1e1e22',
  surfaceAlt: '#2a2a2f',
  border: '#3a3a40',

  textPrimary: '#e8e8ea',
  textSecondary: '#9a9aa2',
  textMuted: '#6b6b72',

  accentIdle: '#4a4a52',
  accentRecording: '#6f5a52',
  accentThinking: '#52606f',
  accentSpeaking: '#5c6f73',

  danger: '#8a5a5a',
} as const;

export const PogoSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const PogoTypography = {
  title: { fontSize: 24, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
