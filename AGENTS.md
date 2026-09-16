# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# La trampa de `File.exists` en expo-file-system

`File.exists` **no significa "el archivo existe"**. Los tipos instalados
(`node_modules/expo-file-system/build/internal/NativeFileSystem.types.d.ts`,
alrededor de la línea 169) lo dicen tal cual:

> A boolean representing if a file exists. `true` if the file exists,
> `false` otherwise. Also, `false` if the application does not have read
> access to the file.

Es decir: `exists` conflates "existe" con "lo puedo leer". Es comportamiento
documentado del vendor **en todas las plataformas**, no un defecto de Expo
Go.

Esto ya causó un bug en producción en esta rama: un `File` construido a
mano sobre una `uri` que venía de `expo-document-picker` (otro módulo) daba
`exists=false` en Expo Go aunque el archivo existiera y fuera legible —
comprobado en dispositivo, el mismo archivo dio `exists=false` y
`size=33803` **a la vez**. `size` (`"0 if the file does not exist, or it
cannot be read"`, mismo archivo de tipos) dijo la verdad; `exists` mintió.

**Regla general: nunca le pases a un módulo de Expo una URI creada por
otro módulo.** Deja que el módulo que va a leer el archivo sea el mismo que
creó el objeto `File`/`Directory` sobre esa URI — así el permiso de lectura
que le dieron viaja con el objeto. Si necesitas comprobar si un archivo
"está ahí" antes de usarlo, prefiere `size === 0` (o `size` truthy) a
`exists` cuando la URI no fue creada por el módulo que la comprueba.

Casos ya arreglados con este criterio en el código: `src/data/storage.ts`
(`pickFileFromDevice` usa `File.pickFileAsync`, no `expo-document-picker`,
para que el `File` lo cree expo-file-system mismo) y `src/utils/stt.ts`
(`transcribe` sólo mira `file.size`, no `file.exists`, porque la `uri` viene
de expo-audio).
