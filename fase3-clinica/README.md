# NeuroVisor · Fase 3: datos clínicos estructurados

> **BLOQUEADO PARA DATOS REALES.** Esta carpeta es la base de código para un futuro conversor y anonimizador offline de datos clínicos. Solo funciona con pacientes inventados. **No cargue datos de pacientes reales en esta carpeta ni en este repositorio.**

## Antes de usar datos reales faltan tres cosas

1. **Aprobación del comité de ética (CEI) específica para la Fase 3.** La aprobación de la fase de EEG no cubre estos datos.
2. **Diccionario de datos validado por un bioestadístico.** El diccionario actual (v0.1.0) es un borrador.
3. **Cita de la terminología de semiología confirmada por el investigador.** «Beniczky et al.» corresponde a varios trabajos distintos; hay que elegir uno.

El detalle de cada uno, qué hay que completar cuando esté y los demás pendientes del estudio están en [docs/PENDIENTES.md](docs/PENDIENTES.md). El programa se niega a correr en modo real mientras falte cualquiera de los tres.

## Qué hay

- **Diccionario preliminar** de 100 campos en 16 categorías: crisis febriles, antecedentes familiares, neurodesarrollo, medicación, epidemiología, semiología, EEG previos, neuropsicología, resonancia, medicina nuclear, hipótesis de localización, SEEG y cirugía. Cada campo tiene tipo, riesgo de reidentificación y mitigación. Léalo en [docs/diccionario-preliminar.md](docs/diccionario-preliminar.md) o en la planilla `diccionario/diccionario-clinico-v0.1.0.csv`.
- **Conversor** que valida, generaliza, colapsa categorías raras, verifica k-anonimato (k = 5) y separa lo que se entrega de lo que queda en el centro. Ver [docs/DISENO.md](docs/DISENO.md).
- **Puntos de conexión declarados sin implementar:** lectura de planillas, lectura de la tabla de seudónimos del desidentificador EDF y escritura en dos carpetas. Implementarlos es cargar datos reales, y eso espera a los tres pendientes.
- **33 pruebas** con pacientes inventados.
- **Referencias** verificadas con DOI en [docs/REFERENCIAS.md](docs/REFERENCIAS.md).

## Relación con el resto

- **Desidentificador EDF:** asigna los códigos PREFIJO-0001 y PREFIJO-0001-01 y guarda la tabla de correspondencia en una carpeta privada. Este módulo usa esos mismos códigos para que cada dato clínico se una a su EEG, y copia sus convenciones (dos carpetas, CSV con «;», edad en décadas).
- **NeuroVisor:** lee el EEG. Este módulo no lo toca.

## Estructura

```
fase3-clinica/
  config/fase3.config.ejemplo.json   requisitos de la puerta (copiar a fase3.config.json, que no se sube)
  diccionario/                       diccionario JSON (fuente), planilla CSV generada y terminologías
  docs/                              pendientes, diseño, diccionario legible y referencias
  src/                               código puro, sin dependencias
  tests/                             pruebas con pacientes inventados
  tools/generar-documentos.js        regenera el diccionario legible y la planilla
```

## Para desarrollar

Requiere Node 20 o más nuevo, solo para correr las pruebas y regenerar los documentos. El programa final está pensado como HTML offline, sin instalar nada.

```
cd fase3-clinica
npm test        # 33 pruebas
npm run docs    # después de cambiar el diccionario
```

Si cambia `diccionario/diccionario-clinico.json`, suba la versión y regenere los documentos. Una versión nueva vuelve a cerrar la puerta hasta que el bioestadístico la firme.

## Reglas para este repositorio

- Nunca subir datos de pacientes, ni siquiera de prueba con datos reales parciales. El `.gitignore` excluye `datos/`, `privado/`, `salida/`, `CONFIDENCIAL_*`, los EDF y la configuración local.
- Nunca subir `config/fase3.config.json`: dice qué comité aprobó qué.
- Los pacientes de prueba se generan en el código (`tests/fixtures/sinteticos.js`) con el prefijo `PRUEBA-` y la marca `_sintetico: true`.

El programa no hace diagnóstico. El diagnóstico lo hace el médico.
