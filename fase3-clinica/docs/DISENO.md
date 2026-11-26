# Diseño del conversor clínico (Fase 3)

## Qué hace

Recibe registros clínicos ya codificados (listas cerradas y números, nunca texto libre ni fechas), los valida contra el diccionario, los generaliza, colapsa las categorías raras, verifica k-anonimato y devuelve dos cosas separadas:

- **Lo que se entrega:** cuatro tablas (`paciente`, `estudio`, `crisis`, `farmaco`) y un informe público que solo trae cantidades.
- **Lo que queda en el centro:** un informe privado que nombra los valores raros, las combinaciones chicas y los pacientes excluidos.

Es la misma separación entre carpeta de salida y carpeta privada que usa el desidentificador EDF.

## Principios

1. **Lista blanca.** Solo pasan los campos del diccionario. Una columna desconocida es un error, y una columna cuyo nombre parece un identificador (DNI, HC, fecha, nombre, teléfono, domicilio, observaciones) frena el lote entero antes de procesar nada.
2. **Sin fechas exactas ni texto libre.** No existen esos tipos: el validador rechaza un diccionario que los declare. Los tiempos se cargan como edad o como intervalo respecto del EEG índice. Si alguien escribe una fecha, un correo, un documento o un teléfono dentro de un campo, se rechaza.
3. **Todo o nada.** Con un solo error no sale ninguna tabla. Una salida parcial es la manera más fácil de que se filtre lo que no debía.
4. **Efecto mosaico.** Un dato inocente se vuelve identificador cuando se cruza con otros. Por eso los números salen en tramos, las categorías con menos de k pacientes pasan a «otro» (o «suprimido» si «otro» también es chico) y las combinaciones de cuasi-identificadores se controlan con k-anonimato.
5. **Seudónimo compartido con el EEG.** `codigo_paciente` (PREFIJO-0001) y `codigo_estudio` (PREFIJO-0001-01) son los del desidentificador EDF. El dato clínico se une al EEG por el nombre del archivo, y la tabla de correspondencia nunca sale de la carpeta privada.
6. **Diccionario como dato.** El código no conoce ningún campo clínico por nombre. Cambiar el diccionario no requiere tocar código, y la versión del diccionario va sellada en cada salida.
7. **Código puro y sin dependencias.** Módulos ES sin Node ni navegador, para poder incrustarlos más adelante en un HTML offline como el desidentificador EDF. Las pruebas usan `node:test`.
8. **Bloqueado por defecto.** El modo `real` no corre hasta que estén los tres pendientes (`docs/PENDIENTES.md`).

## Flujo

```
registros codificados ──► puerta (modo sintético / real)
                         │
                         ▼
          ¿columna con forma de identificador? ──sí──► se frena todo
                         │ no
                         ▼
          validar cada fila contra el diccionario
          (tipos, rangos, listas, condicionales, derivados, reglas cruzadas)
                         │ algún error ──► se frena todo, con la lista de errores
                         ▼
          generalizar (tramos, edades en década)
                         ▼
          colapsar categorías raras (< k pacientes → «otro» / «suprimido»)
                         ▼
          k-anonimato sobre los cuasi-identificadores de «paciente»
          supresión local en el orden fijado
                         │ siguen sin k ──► «detener»: no sale nada
                         │                  «excluir»: se sacan de todas las tablas
                         ▼
          tablas + informe público ──► carpeta que se entrega
          informe privado          ──► carpeta del centro
```

## Módulos

| Archivo | Qué hace |
|---|---|
| `diccionario/diccionario-clinico.json` | Fuente única: parámetros, tablas, identificadores prohibidos, listas, reglas, categorías y campos. |
| `diccionario/terminologias/*.json` | Clasificación de crisis y descriptores de semiología, en paquetes con estado y referencia. Se pueden cambiar sin tocar el diccionario. |
| `src/diccionario.js` | Lee y valida el diccionario. Rechaza tipos prohibidos, referencias rotas, cuasi-identificadores fuera del orden de supresión, etc. |
| `src/transformar.js` | Valida un valor, detecta PII escrita en un campo, evalúa condiciones y generaliza en tramos. |
| `src/kanonimato.js` | Colapso de categorías raras, clases de equivalencia, verificación de k y supresión local. |
| `src/puerta.js` | Los tres pendientes y el bloqueo del modo real. |
| `src/conversor.js` | Orquesta todo y arma la salida con su sello. |
| `src/csv.js` | CSV con las convenciones del desidentificador EDF: «;», BOM y protección contra fórmulas. |
| `src/interfaces.js` | Fuente de registros, registro de seudónimos y destino de salida: declarados, no implementados. |
| `tools/generar-documentos.js` | Genera `docs/diccionario-preliminar.md` y la planilla CSV del diccionario. |
| `tests/` | 33 pruebas, solo con pacientes inventados. |

## Límites conocidos

- **La supresión es simple, no óptima.** Suprime un campo entero en todas las filas en riesgo, siguiendo un orden fijo. Con seis cuasi-identificadores y 40 pacientes, casi toda la información de esos campos se pierde. Una herramienta dedicada (por ejemplo ARX) busca la generalización con menos pérdida.
- **k-anonimato no es l-diversidad.** Si los cinco pacientes de un grupo comparten el mismo valor sensible (por ejemplo, todos con comorbilidad psiquiátrica), quien sepa que alguien está en ese grupo conoce ese dato. No está implementado el control de l-diversidad.
- **k se mide en la tabla de pacientes.** El colapso de raros se aplica campo por campo en todas las tablas, pero una combinación rara repartida entre tablas (por ejemplo, dos fármacos poco usados en el mismo paciente) no se controla como combinación.
- **El EEG suma información.** El encabezado del EDF desidentificado ya trae el sexo y la edad en década. Los tramos de edad son los mismos a propósito, para no agregar precisión al cruzarlos. Si en el futuro se exporta algo del EEG (duración del registro, montaje, equipo), hay que contarlo como cuasi-identificador.
- **Seudonimizado no es anónimo.** Mientras exista la tabla de correspondencia, la salida sigue siendo un dato personal de salud.
- **Errores de codificación.** El programa controla formato y coherencia, no si la codificación clínica es correcta.
