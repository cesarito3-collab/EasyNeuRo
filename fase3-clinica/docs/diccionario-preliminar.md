# Diccionario clínico preliminar · v0.1.0 (borrador)

> **BORRADOR. No está validado por un bioestadístico ni por el comité de ética. No usar con datos de pacientes reales.**

Generado desde `diccionario/diccionario-clinico.json` con `npm run docs`. No editar a mano. La misma información está en `diccionario/diccionario-clinico-v0.1.0.csv` para revisarla en una planilla.

## Resumen

- 100 campos en 16 categorías y 4 tablas (`paciente`: Una fila por paciente; `estudio`: Una fila por EEG índice; el código es el mismo nombre del EDF desidentificado; `crisis`: Una fila por tipo de crisis del paciente (hasta 5); `farmaco`: Una fila por fármaco anticrisis, actual o previo).
- Riesgo de reidentificación: 2 seudónimos, 7 alto, 17 medio, 74 bajo.
- Cuasi-identificadores que entran al control de k-anonimato (k = 5): `edad_eeg_indice`, `sexo`, `region_residencia`, `sindrome_epileptico`, `etiologia_estructural_subtipo`, `cirugia`. Riesgo alto pero fuera de la salida en v0.1: `gen_afectado`.
- Orden de supresión local cuando un grupo queda con menos de 5: `region_residencia` → `cirugia` → `etiologia_estructural_subtipo` → `sindrome_epileptico` → `sexo` → `edad_eeg_indice`. Si aun así quedan pacientes sin k, la política es «detener».
- Edad mínima: 18 años. Fecha del EEG índice: la del EDF desidentificado con el mismo código. Nunca se guarda; todos los tiempos se cargan como edad o como intervalo respecto de ella.
- No hay campos de fecha ni de texto libre: esos tipos están prohibidos en el validador.

## Columnas que frenan el lote entero

Si el archivo de entrada trae una columna cuyo nombre se parece a uno de estos, no se procesa nada.

| Grupo | Patrón (sobre el nombre normalizado) | Motivo |
|---|---|---|
| nombre | `nombre\|apellido\|paciente_nombre\|nombre_completo` | Identificador directo. |
| documento | `(^\|_)(dni\|cuil\|cuit\|c_?i)(_\|$)\|documento\|pasaporte\|cedula` | Identificador directo. |
| historia_clinica | `historia\|(^\|_)n?_?hc(_\|$)\|legajo\|afiliado` | Identificador directo; la HC solo vive en la tabla privada del desidentificador EDF. |
| contacto | `telefono\|celular\|movil\|whatsapp\|e_?mail\|correo` | Identificador directo. |
| domicilio | `domicilio\|direccion\|calle\|barrio\|localidad\|ciudad\|codigo_postal\|(^\|_)cp(_\|$)` | Identificador directo o cuasi-identificador de muy alto riesgo. |
| fechas | `fecha\|nacimiento\|(^\|_)dob(_\|$)` | Ninguna fecha exacta entra al archivo: se cargan edades e intervalos. |
| personas | `medico\|profesional\|derivante\|familiar_nombre\|tutor` | Nombres de terceros. |
| texto_libre | `observacion\|comentario\|nota\|descripcion\|texto\|resumen\|evolucion` | El texto libre es la principal vía de fuga (nombres, lugares, fechas sueltas). No hay campos de texto libre. |

## Decisiones abiertas para el bioestadístico

- **region_residencia**: En un solo centro aporta poco al análisis y suma riesgo. El bioestadístico decide si se exporta.
- **duracion_epilepsia**: Edad en década + edad de inicio + duración, cruzadas, estrechan la edad real. Exportar a lo sumo dos de las tres.
- **consanguinidad_parental**: Poco frecuente y, junto con un síndrome raro, señala a una familia. Evaluar si hace falta.
- **gen_afectado**: No se exporta en v0.1. En una cohorte de un centro casi todos los genes quedan con menos de k pacientes. Lista de genes a revisar por un genetista.
- **farmaco_dosis_mg_dia**: No se exporta en v0.1 (minimización). Si el análisis la necesita, definir tramos por fármaco.
- **anatomia_patologica**: Subtipos ILAE de esclerosis hipocampal y de DCF: agregar solo si el análisis los usa (suman riesgo).

## Vínculo con el EEG desidentificado

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `codigo_paciente` * | Código del paciente | patrón ^[A-Z0-9_]{2,20}-\d{4}$ | Seudónimo | Seudónimo del desidentificador EDF; la correspondencia queda en la carpeta privada. | El mismo número que asigna el desidentificador EDF (PREFIJO-0001). Se toma de su tabla privada; nunca se carga a mano. |
| `codigo_estudio` * | Código del EEG índice | patrón ^[A-Z0-9_]{2,20}-\d{4}-\d{2}$ | Seudónimo | Seudónimo del desidentificador EDF; la correspondencia queda en la carpeta privada. | Igual al nombre del EDF desidentificado (PREFIJO-0001-01). |

## Demografía y epidemiología

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `edad_eeg_indice` * | Edad al EEG índice | entero 18 a 120 años | Alto (CI) | Sale en tramos: 18-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80-89, 90+. Entra al control de k-anonimato (k = 5) y a la supresión local. | Mismos grupos que el encabezado del EDF desidentificado (Edad_40-49). Si hay varios EEG índice, la del primero. |
| `sexo` * | Sexo | categoria: M, F, X | Alto (CI) | Entra al control de k-anonimato (k = 5) y a la supresión local. | X = no consignado. Mismo valor que en el EDF. |
| `region_residencia` | Región de residencia | categoria: lista:region_residencia_ar (9) | Alto (CI) | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Entra al control de k-anonimato (k = 5) y a la supresión local. | Nunca ciudad, localidad ni código postal. **Pendiente:** En un solo centro aporta poco al análisis y suma riesgo. El bioestadístico decide si se exporta. |
| `nivel_educativo` | Nivel educativo máximo | categoria: primario_incompleto, primario_completo, secundario_completo, terciario_o_universitario, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | Covariable para neuropsicología. |
| `situacion_laboral` | Situación laboral | categoria: activo, desocupado, estudiante, jubilado_o_pension, otro, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | Nunca la ocupación concreta. |
| `cobertura_salud` | Cobertura de salud | categoria: publica_exclusiva, obra_social, prepaga, desconocido | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Nunca el nombre de la obra social ni el número de afiliado. |
| `lateralidad_manual` | Lateralidad manual | categoria: diestro, zurdo, ambidiestro, desconocido | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Necesaria para interpretar dominancia del lenguaje y signos lateralizadores. |
| `edad_inicio_epilepsia` | Edad de inicio de la epilepsia | entero 0 a 120 años | Medio | Sale en tramos: <1, 1-4, 5-11, 12-17, 18-29, 30-49, 50+. | Edad de la primera crisis no provocada, no fecha. |
| `duracion_epilepsia` | Duración de la epilepsia al EEG índice | calculado: edad_eeg_indice − edad_inicio_epilepsia | Medio | Sale en tramos: <2, 2-4, 5-9, 10-19, 20-29, 30+. | Se calcula antes de agrupar; no se carga. **Pendiente:** Edad en década + edad de inicio + duración, cruzadas, estrechan la edad real. Exportar a lo sumo dos de las tres. |

## Antecedentes personales (incluye crisis febriles)

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `crisis_febriles` | Crisis febriles en la infancia | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_febriles_tipo` | Tipo de crisis febriles | categoria: simples, complejas, estado_de_mal_febril, desconocido | Bajo | Solo se carga si crisis_febriles es si; si no, «no_aplica». | Compleja: focal, prolongada (>15 min) o repetida en 24 h. |
| `crisis_febriles_edad_primera` | Edad de la primera crisis febril | entero 0 a 216 meses | Bajo | Sale en tramos: <1 año, 1-2 años, 3-5 años, 6 años o más. Solo se carga si crisis_febriles es si; si no, «no_aplica». |  |
| `crisis_febriles_numero` | Número de crisis febriles | entero 1 a 999 | Bajo | Sale en tramos: 1, 2-3, 4 o más. Solo se carga si crisis_febriles es si; si no, «no_aplica». |  |
| `antecedente_perinatal` | Antecedentes perinatales | multicategoria: prematurez, encefalopatia_hipoxico_isquemica, infeccion_neonatal, crisis_neonatales, ninguno, desconocido; hasta 4 | Bajo | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). |  |
| `tec_previo` | Traumatismo de cráneo previo | categoria: no, leve, moderado_o_grave, desconocido | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `infeccion_snc_previa` | Infección del SNC previa | categoria: no, meningitis, encefalitis, neurocisticercosis, otra, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). |  |
| `estado_epileptico_previo` | Estado epiléptico previo | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |

## Antecedentes familiares

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `epilepsia_familiar_1er_grado` | Epilepsia en familiar de primer grado | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Solo sí o no: nunca parentesco exacto, cantidad de afectados ni pedigrí. |
| `epilepsia_familiar_2do_grado` | Epilepsia en familiar de segundo grado | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_febriles_familiares` | Crisis febriles en familiares | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `consanguinidad_parental` | Consanguinidad de los padres | categoria: lista:si_no_desc (3) | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | **Pendiente:** Poco frecuente y, junto con un síndrome raro, señala a una familia. Evaluar si hace falta. |

## Estudio genético

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `estudio_genetico` | Resultado del estudio genético | categoria: no_realizado, negativo, variante_de_significado_incierto, patogenico_o_probablemente_patogenico, desconocido | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Nunca la variante (HGVS), la citobanda ni el informe del laboratorio: una variante rara identifica a la persona y a su familia. |
| `gen_afectado` | Gen con resultado patogénico | categoria: DEPDC5, NPRL2, NPRL3, SCN1A, LGI1, CHRNA4… (11) | Alto | No se exporta en v0.1. Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Solo se carga si estudio_genetico es patogenico_o_probablemente_patogenico; si no, «no_aplica». | **Pendiente:** No se exporta en v0.1. En una cohorte de un centro casi todos los genes quedan con menos de k pacientes. Lista de genes a revisar por un genetista. |

## Neurodesarrollo y comorbilidad psiquiátrica

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `discapacidad_intelectual` | Discapacidad intelectual | categoria: no, leve, moderada, grave_o_profunda, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Dato sensible (salud mental o neurodesarrollo): minimizar. |  |
| `trastorno_espectro_autista` | Trastorno del espectro autista | categoria: lista:si_no_desc (3) | Bajo | Dato sensible (salud mental o neurodesarrollo): minimizar. |  |
| `tdah` | TDAH | categoria: lista:si_no_desc (3) | Bajo | Dato sensible (salud mental o neurodesarrollo): minimizar. |  |
| `trastorno_aprendizaje` | Trastorno específico del aprendizaje | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `escolaridad_especial` | Escolaridad especial o con apoyo | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `comorbilidad_psiquiatrica` | Comorbilidad psiquiátrica | multicategoria: depresion, ansiedad, psicosis, trastorno_bipolar, consumo_de_sustancias, crisis_funcionales_disociativas, ninguna, desconocido; hasta 6 | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Dato sensible (salud mental o neurodesarrollo): minimizar. | Crisis funcionales/disociativas asociadas (diagnóstico dual) es clave para interpretar eventos sin correlato EEG. |

## Clasificación de la epilepsia y etiología

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `tipo_epilepsia` * | Tipo de epilepsia (ILAE 2017) | categoria: focal, generalizada, combinada_generalizada_y_focal, desconocida | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Ref.: Scheffer 2017, doi:10.1111/epi.13709 |
| `sindrome_epileptico` | Síndrome epiléptico (ILAE 2022) | categoria: lista:sindromes (18) | Alto (CI) | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Entra al control de k-anonimato (k = 5) y a la supresión local. | Lista a revisar por un epileptólogo contra los trabajos originales. Ref.: Riney 2022, doi:10.1111/epi.17240; Hirsch 2022, doi:10.1111/epi.17236 |
| `etiologia` * | Etiología (ILAE 2017) | multicategoria: estructural, genetica, infecciosa, metabolica, inmune, desconocida; hasta 3 | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Ref.: Scheffer 2017, doi:10.1111/epi.13709 |
| `etiologia_estructural_subtipo` | Lesión estructural causal | categoria: lista:lesion_estructural (11) | Alto (CI) | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Entra al control de k-anonimato (k = 5) y a la supresión local. Solo se carga si etiologia contiene estructural; si no, «no_aplica». | Sin el anticuerpo en las encefalitis autoinmunes (LGI1, NMDA…): con n chico identifica. |
| `farmacorresistencia` | Epilepsia farmacorresistente (ILAE 2010) | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Falla de dos esquemas adecuados y tolerados. Ref.: Kwan 2010, doi:10.1111/j.1528-1167.2009.02397.x |

## Semiología de las crisis

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `crisis_orden` * | Número de tipo de crisis | entero 1 a 5 | Bajo | Se exporta tal cual (lista cerrada o número acotado). | 1 = la crisis habitual más frecuente. |
| `crisis_clase` * | Clase de crisis | categoria: terminologia:clasificacion_crisis.clases (vacía hasta confirmar la cita; 4 provisionales solo para pruebas) | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Ref.: PENDIENTE de confirmación (candidata: Beniczky 2025, doi:10.1111/epi.18338) |
| `crisis_conciencia` | Estado de conciencia durante la crisis | categoria: terminologia:clasificacion_crisis.conciencia (vacía hasta confirmar la cita; 3 provisionales solo para pruebas) | Bajo | Solo se carga si crisis_clase es focal/desconocida_si_focal_o_generalizada; si no, «no_aplica». | En 2025 reemplaza a «awareness» de 2017; si la referencia confirmada fuera la de 2017 cambia el campo. |
| `crisis_tipo` | Tipo de crisis | categoria: terminologia:clasificacion_crisis.tipos (vacía hasta confirmar la cita; 0 provisionales solo para pruebas) | Bajo | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | Lista vacía hasta confirmar la referencia. |
| `crisis_manifestaciones_observables` | Con manifestaciones observables | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_secuencia` | Secuencia semiológica | secuencia: terminologia:semiologia.descriptores (vacía hasta confirmar la cita; 16 provisionales solo para pruebas); cada elemento «valor\|lado», lado de lista:lado; hasta 8 | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | Descriptores en orden cronológico, cada uno con su lado (descriptor\|lado). Nunca descripción en texto libre. |
| `crisis_fuente_semiologia` * | De dónde sale la semiología | categoria: video_eeg, video_domiciliario, relato_del_paciente, relato_de_testigo, mixta | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Sin esto no se puede comparar semiología vista con semiología relatada. |
| `crisis_frecuencia` | Frecuencia en los 12 meses previos | categoria: diaria, semanal, mensual, menos_que_mensual, libre_de_crisis_12_meses, desconocida | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_duracion_tipica` | Duración típica | categoria: menos_de_30_s, 30_s_a_2_min, 2_a_5_min, mas_de_5_min, desconocida | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_relacion_sueno` | Relación con el sueño | categoria: vigilia, sueno, ambas, al_despertar, desconocida | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `crisis_desencadenantes` | Desencadenantes | multicategoria: privacion_de_sueno, alcohol, catamenial, estimulacion_luminosa, omision_de_medicacion, estres… (9); hasta 4 | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). |  |
| `crisis_registrada_video_eeg` | Registrada en video-EEG | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |

## EEG previos

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `eeg_previos_numero` | Cantidad de EEG previos al índice | entero 0 a 999 | Bajo | Sale en tramos: 0, 1, 2-4, 5 o más. |  |
| `eeg_previo_hallazgos` | Hallazgos en EEG previos | multicategoria: normal, lentificacion_focal, lentificacion_difusa, actividad_epileptiforme_focal, actividad_epileptiforme_generalizada, crisis_registrada… (9); hasta 6 | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Ref.: Términos alineables con SCORE (Beniczky 2017, doi:10.1016/j.clinph.2017.07.418) y ACNS 2021 (doi:10.1097/WNP.0000000000000806) |
| `eeg_previo_localizacion_aei` | Localización de la actividad epileptiforme previa | localizacion: lista:region_lobar (11); cada elemento «valor\|lado», lado de lista:lado; hasta 4 | Bajo | Solo se carga si eeg_previo_hallazgos contiene actividad_epileptiforme_focal; si no, «no_aplica». |  |
| `video_eeg_prolongado_previo` | Video-EEG prolongado previo | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `meses_desde_eeg_previo` | Meses entre el EEG previo más reciente y el índice | entero 0 a 1200 meses | Bajo | Sale en tramos: <6 meses, 6-23 meses, 2-4 años, 5 años o más. | Intervalo, nunca la fecha. |

## Condiciones del EEG índice

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `tipo_registro` * | Tipo de registro | categoria: rutina, prolongado, video_eeg, uti, ambulatorio | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `estado_durante_registro` | Estado durante el registro | multicategoria: vigilia, sueno_espontaneo, privacion_de_sueno, sedacion_farmacologica; hasta 3 | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `psicotropos_al_registro` | Psicotrópicos al momento del registro | multicategoria: benzodiacepina, antidepresivo, antipsicotico, litio, opioide, anestesico_o_sedante, ninguno, desconocido; hasta 5 | Bajo | Dato sensible (salud mental o neurodesarrollo): minimizar. | Cambian el fondo del EEG (beta por benzodiacepinas, lentificación por sedantes): el algoritmo lo necesita. |
| `horas_desde_ultima_crisis` | Horas desde la última crisis | decimal 0 a 100000 horas | Bajo | Sale en tramos: <24 h, 1-7 días, más de 7 días. | Para separar lentificación posictal de lentificación de fondo. |

## Neuropsicología y dominancia del lenguaje

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `neuropsicologia_realizada` | Evaluación neuropsicológica realizada | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `np_memoria_verbal_z` | Memoria verbal (puntaje z) | decimal -10 a 10 | Bajo | Sale en tramos: deficit_moderado_grave, deficit_leve, normal. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». | Se carga el z ya calculado con las normas locales; nunca puntajes brutos. |
| `np_memoria_visual_z` | Memoria visual (puntaje z) | decimal -10 a 10 | Bajo | Sale en tramos: deficit_moderado_grave, deficit_leve, normal. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». |  |
| `np_lenguaje_z` | Lenguaje y denominación (puntaje z) | decimal -10 a 10 | Bajo | Sale en tramos: deficit_moderado_grave, deficit_leve, normal. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». |  |
| `np_ejecutivas_z` | Funciones ejecutivas (puntaje z) | decimal -10 a 10 | Bajo | Sale en tramos: deficit_moderado_grave, deficit_leve, normal. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». |  |
| `np_atencion_z` | Atención (puntaje z) | decimal -10 a 10 | Bajo | Sale en tramos: deficit_moderado_grave, deficit_leve, normal. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». |  |
| `cociente_intelectual_total` | Cociente intelectual total | entero 20 a 180 | Medio | Sale en tramos: <70, 70-84, 85-114, 115 o más. Solo se carga si neuropsicologia_realizada es si; si no, «no_aplica». |  |
| `dominancia_lenguaje` | Dominancia del lenguaje | categoria: izquierda, derecha, bilateral_o_atipica, no_evaluada | Bajo | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). |  |
| `dominancia_metodo` | Método para la dominancia | categoria: wada, rm_funcional, ambos, no_aplica | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |

## Resonancia magnética

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `rm_realizada` | Resonancia magnética realizada | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). | Las imágenes (DICOM) no entran en esta fase: la reconstrucción 3D muestra la cara y requiere un desidentificador propio. |
| `rm_campo` | Campo del resonador | categoria: 1_5T, 3T, otro, desconocido | Bajo | Solo se carga si rm_realizada es si; si no, «no_aplica». |  |
| `rm_protocolo_epilepsia` | Protocolo de epilepsia | categoria: lista:si_no_desc (3) | Bajo | Solo se carga si rm_realizada es si; si no, «no_aplica». |  |
| `rm_resultado` | Resultado de la RM | categoria: normal, lesional, dudosa | Bajo | Solo se carga si rm_realizada es si; si no, «no_aplica». |  |
| `rm_lesion` | Tipo de lesión en RM | categoria: lista:lesion_estructural (11) | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Solo se carga si rm_resultado es lesional/dudosa; si no, «no_aplica». |  |
| `rm_localizacion` | Localización de la lesión | localizacion: lista:region_lobar (11); cada elemento «valor\|lado», lado de lista:lado; hasta 4 | Bajo | Solo se carga si rm_resultado es lesional/dudosa; si no, «no_aplica». |  |

## Medicina nuclear (PET, SPECT)

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `pet_fdg` | PET-FDG | categoria: no_realizado, normal, hipometabolismo_focal, hipometabolismo_multifocal_o_difuso | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `pet_localizacion` | Localización del hipometabolismo | localizacion: lista:region_lobar (11); cada elemento «valor\|lado», lado de lista:lado; hasta 4 | Bajo | Solo se carga si pet_fdg es hipometabolismo_focal/hipometabolismo_multifocal_o_difuso; si no, «no_aplica». |  |
| `spect_ictal` | SPECT ictal | categoria: no_realizado, hiperperfusion_focal, no_localizador | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `spect_localizacion` | Localización de la hiperperfusión | localizacion: lista:region_lobar (11); cada elemento «valor\|lado», lado de lista:lado; hasta 3 | Bajo | Solo se carga si spect_ictal es hiperperfusion_focal; si no, «no_aplica». |  |
| `siscom` | SISCOM | categoria: lista:si_no_desc (3) | Bajo | Solo se carga si spect_ictal es hiperperfusion_focal/no_localizador; si no, «no_aplica». |  |

## Medicación anticrisis y otros tratamientos

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `farmaco` * | Fármaco anticrisis | categoria: lista:farmacos_anticrisis (27) | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | Los de uso raro en el país (cenobamato, fenfluramina, estiripentol…) quedan como «otro» si los usan menos de k pacientes. |
| `farmaco_estado` * | Estado del fármaco | categoria: al_eeg_indice, previo_suspendido | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `farmaco_motivo_suspension` | Motivo de suspensión | categoria: ineficacia, efecto_adverso, ambos, otro, desconocido | Bajo | Solo se carga si farmaco_estado es previo_suspendido; si no, «no_aplica». |  |
| `farmaco_dosis_mg_dia` | Dosis diaria (mg) | decimal 0 a 10000 mg/día | Bajo | No se exporta en v0.1. Solo se carga si farmaco_estado es al_eeg_indice; si no, «no_aplica». | **Pendiente:** No se exporta en v0.1 (minimización). Si el análisis la necesita, definir tramos por fármaco. |
| `farmacos_probados_total` | Fármacos anticrisis probados en total | entero 0 a 40 | Bajo | Sale en tramos: 0-1, 2, 3-4, 5-7, 8 o más. |  |
| `dieta_cetogenica` | Dieta cetogénica o variantes | categoria: nunca, previa, actual, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). |  |
| `neuromodulacion` | Neuromodulación implantada | categoria: ninguna, estimulador_vagal, otra_neuromodulacion, desconocido | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). | El estimulador vagal además deja artefacto en el EEG y el ECG. |

## Hipótesis localizatoria

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `hipotesis_localizacion` | Hipótesis de la zona epileptógena | localizacion: lista:region_lobar (11); cada elemento «valor\|lado», lado de lista:lado; hasta 3 | Bajo | Se exporta tal cual (lista cerrada o número acotado). | La del ateneo prequirúrgico, antes de SEEG o cirugía. |
| `hipotesis_confianza` | Confianza en la hipótesis | categoria: alta, moderada, baja, no_aplica | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `hipotesis_concordancia` | Modalidades concordantes con la hipótesis | multicategoria: semiologia, eeg_interictal, eeg_ictal, rm, pet, spect, neuropsicologia, ninguna; hasta 7 | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `conducta_prequirurgica` | Conducta del ateneo | categoria: cirugia_directa, seeg, otra_invasiva, no_candidato, en_evaluacion, no_aplica | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |

## Estéreo-EEG, cirugía y resultado

| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |
|---|---|---|---|---|---|
| `seeg_realizado` | Estéreo-EEG realizado | categoria: lista:si_no_desc (3) | Bajo | Se exporta tal cual (lista cerrada o número acotado). |  |
| `seeg_numero_electrodos` | Número de electrodos | entero 1 a 40 | Bajo | Sale en tramos: 1-5, 6-10, 11-15, 16 o más. Solo se carga si seeg_realizado es si; si no, «no_aplica». |  |
| `seeg_regiones_muestreadas` | Regiones muestreadas | localizacion: lista:region_seeg (15); cada elemento «valor\|lado», lado de lista:lado; hasta 20 | Medio | Solo se carga si seeg_realizado es si; si no, «no_aplica». | Regiones, nunca coordenadas de contactos: el esquema exacto de implantación es casi una huella única. |
| `seeg_zona_inicio` | Zona de inicio ictal en SEEG | localizacion: lista:region_seeg (15); cada elemento «valor\|lado», lado de lista:lado; hasta 4 | Bajo | Solo se carga si seeg_realizado es si; si no, «no_aplica». |  |
| `seeg_crisis_registradas` | Crisis registradas en SEEG | entero 0 a 999 | Bajo | Sale en tramos: 0, 1-2, 3-5, 6 o más. Solo se carga si seeg_realizado es si; si no, «no_aplica». |  |
| `seeg_estimulacion_reproduce` | La estimulación reprodujo la crisis habitual | categoria: si, no, no_realizada | Bajo | Solo se carga si seeg_realizado es si; si no, «no_aplica». |  |
| `cirugia` | Cirugía de epilepsia | categoria: ninguna, lobectomia_temporal_anterior, amigdalohipocampectomia_selectiva, lesionectomia, reseccion_a_medida, ablacion_laser… (10) | Alto (CI) | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Entra al control de k-anonimato (k = 5) y a la supresión local. | Una hemisferotomía en un adulto de un centro es casi única: se colapsa. |
| `cirugia_lado` | Lado operado | categoria: lista:lado (4) | Bajo | Solo se carga si cirugia no es ninguna/callosotomia; si no, «no_aplica». |  |
| `meses_cirugia_respecto_indice` | Meses de la cirugía respecto del EEG índice | entero -1200 a 1200 meses (negativo = antes) | Bajo | Sale en tramos: antes del EEG índice, 0-11 meses después, 12-23 meses después, 24 meses o más después. Solo se carga si cirugia no es ninguna; si no, «no_aplica». |  |
| `anatomia_patologica` | Anatomía patológica | categoria: esclerosis_hipocampal, displasia_cortical_focal, tumor, cavernoma, gliosis, sin_hallazgos, otra, no_aplica | Medio | Valores con menos de 5 pacientes → «otro» (o «suprimido» si «otro» también es chico). Solo se carga si cirugia no es ninguna/callosotomia/termocoagulacion_seeg/ablacion_laser; si no, «no_aplica». | **Pendiente:** Subtipos ILAE de esclerosis hipocampal y de DCF: agregar solo si el análisis los usa (suman riesgo). |
| `engel_12m` | Clase de Engel a los 12 meses | categoria: I, II, III, IV, desconocido, no_aplica | Bajo | Solo se carga si cirugia no es ninguna; si no, «no_aplica». |  |
| `ilae_resultado_12m` | Clase ILAE de resultado a los 12 meses | categoria: 1, 2, 3, 4, 5, 6, desconocido, no_aplica | Bajo | Solo se carga si cirugia no es ninguna; si no, «no_aplica». | Ref.: Wieser 2001, Epilepsia 42:282-6 (PMID 11240604) |

`*` obligatorio · CI = cuasi-identificador

## Listas cerradas

- **si_no_desc** (3): si, no, desconocido
- **lado** (4): izquierdo, derecho, bilateral, indeterminado
- **region_lobar** (11): temporal_mesial, temporal_lateral, temporal_sin_precisar, frontal, insular_opercular, perirrolandica, parietal, occipital, multilobar, hemisferica, no_localizada
- **region_seeg** (15): amigdala, hipocampo, entorrinal_parahipocampica, polo_temporal, neocorteza_temporal_lateral, insula, operculo, cingulo, orbitofrontal, prefrontal_lateral, area_motora_suplementaria, perirrolandica, parietal, occipital, otra_region
- **lesion_estructural** (11): esclerosis_hipocampal, displasia_cortical_focal, tumor_glioneuronal_bajo_grado, cavernoma, otra_malformacion_desarrollo_cortical, secuela_vascular, secuela_traumatica, secuela_infecciosa, encefalitis_autoinmune, otra_lesion, no_aplica
- **farmacos_anticrisis** (27): levetiracetam, brivaracetam, lamotrigina, acido_valproico, carbamazepina, oxcarbazepina, eslicarbazepina, lacosamida, fenitoina, fenobarbital, primidona, topiramato, zonisamida, perampanel, cenobamato, clobazam, clonazepam, etosuximida, pregabalina, gabapentina, rufinamida, cannabidiol, estiripentol, fenfluramina, vigabatrina, acetazolamida, otro
- **sindromes** (18): ninguno_identificado, epilepsia_temporal_mesial_con_esclerosis_hipocampal, epilepsia_hipermotora_relacionada_con_el_sueno, epilepsia_temporal_mesial_familiar, epilepsia_focal_familiar_de_focos_variables, epilepsia_con_caracteristicas_auditivas, epilepsia_con_crisis_inducidas_por_lectura, sindrome_de_rasmussen, epilepsias_mioclonicas_progresivas, epilepsia_ausencia_infantil, epilepsia_ausencia_juvenil, epilepsia_mioclonica_juvenil, epilepsia_solo_crisis_tonico_clonicas_generalizadas, epilepsia_generalizada_genetica_sin_sindrome, sindrome_de_lennox_gastaut, sindrome_de_dravet, otra_encefalopatia_epileptica_y_del_desarrollo, otro
- **region_residencia_ar** (9): amba, resto_buenos_aires, centro, noa, nea, cuyo, patagonia, otro_pais, desconocido

## Terminologías

- **clasificacion_crisis** · estado «pendiente_confirmacion». PENDIENTE: el investigador debe confirmar qué referencia se adopta. Mientras el estado no sea 'confirmada', el conversor no corre con datos reales.
- candidata: Beniczky S, Trinka E, Wirrell E, et al. Updated classification of epileptic seizures: Position paper of the International League Against Epilepsy. Epilepsia. 2025;66(6):1804-1823. doi:10.1111/epi.18338 (PMID 40264351). Clasificación vigente (actualiza la de 2017). Recomendada para crisis_clase, crisis_conciencia y crisis_tipo.
- candidata: Fisher RS, Cross JH, French JA, et al. Operational classification of seizure types by the International League Against Epilepsy. Epilepsia. 2017;58(4):522-530. doi:10.1111/epi.13670 (PMID 28276060). Clasificación anterior (awareness como clasificador). Solo si el centro sigue codificando con 2017.
- **semiologia** · estado «pendiente_confirmacion». PENDIENTE: falta que el investigador confirme la referencia («Beniczky et al., año a confirmar»). Hay tres trabajos de Beniczky que encajan y no son intercambiables; ver docs/REFERENCIAS.md.
- candidata: Beniczky S, Tatum WO, Blumenfeld H, et al. Seizure semiology: ILAE glossary of terms and their significance. Epileptic Disord. 2022;24(3):447-495. doi:10.1684/epd.2022.1430 (PMID 35770761). Glosario de términos semiológicos con su valor localizador y lateralizador. Útil para los descriptores, pero es anterior a la clasificación 2025.
- candidata: Beniczky S, Trinka E, Wirrell E, et al. A practical guide to the updated seizure classification 2025. Epileptic Disord. 2025;27(6):1087-1104. doi:10.1002/epd2.70110 (PMID 41081650). Trae una tabla completa de descriptores semiológicos alineada con la clasificación 2025 (versión ampliada, con secuencia temporal). Es la candidata más coherente con clasificacion-crisis.json.
