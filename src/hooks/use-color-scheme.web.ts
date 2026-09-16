import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Patron de hidratacion SSR/CSR del template de Expo, sin tocar: el
    // primer render (servidor o cliente) usa 'light' a proposito, y este
    // efecto pide un segundo render ya en el cliente para leer el color
    // real. Es el caso que React documenta como sincronizar con un sistema
    // externo (el entorno del navegador), no el antipatron que la regla
    // busca. Se silencia puntualmente en vez de reescribir un mecanismo
    // ajeno a esta rama.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
