# Pendientes antes de usar datos reales

**Estado: BLOQUEADO.** El conversor solo acepta registros inventados (`_sintetico: true`). El modo `real` se niega a correr y lista lo que falta mientras no estén cumplidos los tres requisitos de abajo. El bloqueo está en `src/puerta.js` y se prueba en `tests/puerta.test.js`.

El bloqueo es una salvaguarda contra el uso por error, no un control de seguridad: cualquiera que edite el código o la configuración puede saltarlo. La responsabilidad sigue siendo del investigador y del comité de ética.

## Los tres requisitos

### 1. Aprobación del comité de ética (CEI) específica para la Fase 3

La aprobación de la fase de EEG no alcanza. El dictamen tiene que cubrir de forma explícita los datos clínicos estructurados de este diccionario: antecedentes, neurodesarrollo, comorbilidad psiquiátrica, medicación, imágenes, medicina nuclear, SEEG y cirugía.

Al CEI conviene llevarle:

- `docs/diccionario-preliminar.md` (o la planilla `diccionario/diccionario-clinico-v0.1.0.csv`), con los campos, su riesgo y su mitigación.
- La regla de vínculo: el dato clínico lleva el mismo seudónimo que el EEG desidentificado, y la tabla de correspondencia queda solo en la carpeta privada del centro.
- Qué se entrega y a quién (solo la carpeta pública), y qué queda en el centro.

Preguntas que el CEI o la asesoría legal tienen que responder, porque este repositorio no puede:

- ¿Hace falta consentimiento informado específico para esta fase, o el CEI dispensa el consentimiento para datos retrospectivos seudonimizados?
- La salida está seudonimizada, no anonimizada: mientras exista la tabla de correspondencia sigue siendo un dato personal de salud (dato sensible según la Ley 25.326). ¿Corresponde inscribir la base en el registro de la Agencia de Acceso a la Información Pública? ¿Quién es el responsable de la base?
- ¿Con quién se puede compartir la carpeta pública, bajo qué acuerdo, y por cuánto tiempo se guarda?

**Qué se completa en el código cuando esté:** en `config/fase3.config.json` (copia local del ejemplo, no se sube), el bloque `aprobacion_cei` con comité, número y fecha del dictamen, e `incluye_datos_clinicos_fase3: true`.

### 2. Diccionario de datos validado por un bioestadístico

El diccionario v0.1.0 es un borrador hecho para que el código tenga algo concreto con qué trabajar. Un bioestadístico tiene que revisar y firmar:

- Qué campos hacen falta para las preguntas del estudio. Cada campo que no se use es riesgo sin beneficio.
- Los tramos de cada número y el k mínimo (hoy k = 5).
- Cuáles son los cuasi-identificadores y el orden de supresión. **Ver la advertencia de abajo: con seis cuasi-identificadores en una cohorte de un solo centro, casi todo se suprime.**
- La política cuando un paciente no alcanza k: `detener` (por defecto, no sale nada) o `excluir` (se lo saca de todas las tablas; puede sesgar la muestra porque los excluidos son justamente los casos raros).
- Las seis decisiones abiertas que figuran en `docs/diccionario-preliminar.md`.

**Qué se completa:** el diccionario pasa a `"estado": "validado"` con su versión, y en la configuración el bloque `diccionario_validado` con el nombre del bioestadístico y `version_validada` igual a esa versión. Si después se toca el diccionario, la versión cambia y la puerta se vuelve a cerrar hasta una nueva firma.

### 3. Cita de la terminología de semiología confirmada por el investigador

La consigna fue «Beniczky et al.» sin año. Hay al menos cuatro trabajos de Beniczky que encajan y no son intercambiables (detalle en `docs/REFERENCIAS.md`). Además, la terminología ACNS es de EEG, no de semiología: sirve para los hallazgos del EEG, no para describir la crisis.

Recomendación, a confirmar: clasificación ILAE 2025 (Beniczky 2025, Epilepsia, doi:10.1111/epi.18338) para la clase y el tipo de crisis, y la tabla de descriptores de la guía práctica 2025 (Beniczky 2025, Epileptic Disord, doi:10.1002/epd2.70110) para la secuencia semiológica.

**Qué se completa:**

- En `diccionario/terminologias/clasificacion-crisis.json` y `semiologia.json`: `estado: "confirmada"`, el bloque `referencia_confirmada` y las listas transcriptas de la fuente elegida (`tipos`, `descriptores`). Hoy están vacías a propósito; los 16 descriptores provisionales solo sirven para probar el código y nunca se usan con datos reales.
- En la configuración, el bloque `cita_semiologia` con el DOI elegido y `confirmada_por_investigador: true`. El DOI tiene que coincidir con el de al menos uno de los dos paquetes.

## Otros pendientes (no bloquean el código, pero sí el estudio)

- **Lo que falta construir.** Las tres interfaces de `src/interfaces.js` están declaradas y no implementadas a propósito: la fuente de registros (planilla o formulario offline), el registro de seudónimos (lee la tabla privada del desidentificador EDF, nunca escribe en ella) y el destino de salida (dos carpetas, sin sobrescribir). Tampoco hay formulario de carga ni versión HTML offline.
- **Confiabilidad de la codificación.** La semiología y la hipótesis de localización dependen de quién codifica. Antes de cargar la cohorte, que dos personas codifiquen la misma muestra de casos y medir el acuerdo (kappa). Si es bajo, el problema está en las definiciones, no en el programa.
- **Fuente de la semiología.** El campo `crisis_fuente_semiologia` es obligatorio porque una crisis vista en video-EEG y una relatada por un familiar no son el mismo dato. El análisis tiene que poder separarlas.
- **Imágenes DICOM fuera de alcance.** El diccionario guarda el resultado codificado de la RM y del PET o SPECT, no las imágenes. Las imágenes de cabeza reconstruyen la cara: compartirlas exige un desfigurado (defacing) que este módulo no hace.
- **Prueba con una distribución realista.** Los 40 pacientes inventados no tienen las frecuencias de una cohorte real. Antes de cerrar el diccionario, conviene correr el conversor con conteos agregados reales (sin datos individuales) para ver cuánto se suprime.
- **Solo adultos.** `edad_minima` = 18. Crisis febriles y neurodesarrollo se cargan como antecedentes de adultos. Una cohorte pediátrica necesita otro diccionario y otro dictamen.

## Advertencia: k-anonimato con pocos pacientes

Resultado con los pacientes inventados de las pruebas (k = 5, seis cuasi-identificadores). Cada columna dice en cuántos pacientes se suprimió ese campo:

| Pacientes | Celdas de cuasi-identificadores suprimidas por k | Región | Cirugía | Etiología estructural | Síndrome | Sexo | Edad |
|---|---|---|---|---|---|---|---|
| 15 | 78 de 90 | 11 | 15 | 13 | 15 | 15 | 9 |
| 40 | 177 de 240 | 40 | 37 | 38 | 37 | 19 | 6 |
| 100 | 250 de 600 | 83 | 58 | 47 | 46 | 8 | 8 |

Con 40 pacientes, la región, la cirugía, la etiología y el síndrome quedan suprimidos en más del 90 % de las filas. La salida cumple k pero los cuasi-identificadores pierden valor. No es un defecto del código: seis cuasi-identificadores con muchas categorías en un solo centro forman combinaciones únicas. La solución es del bioestadístico: menos cuasi-identificadores (la región es la primera candidata), tramos más anchos o más pacientes.

El algoritmo de supresión es simple a propósito (suprime un campo entero en todas las filas en riesgo, en el orden fijado). No es óptimo. Para el análisis definitivo conviene que el bioestadístico compare con una herramienta dedicada como ARX.
