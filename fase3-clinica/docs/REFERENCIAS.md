# Referencias

Las referencias clínicas se verificaron en PubMed el 2026-11-25 (título, revista, año y DOI). La única que no tiene DOI en PubMed es Wieser 2001; se cita por PMID.

## La ambigüedad de «Beniczky et al.»

La consigna pidió la semiología «según ACNS y Beniczky et al.» sin año. Hay que aclarar dos cosas antes de cargar datos:

1. **ACNS no es una terminología de semiología.** La terminología de la American Clinical Neurophysiology Society (Hirsch 2021) describe patrones de EEG, sobre todo en cuidados críticos. En este diccionario se usa para los hallazgos del EEG, no para describir la crisis.
2. **Hay cuatro trabajos de Beniczky que encajan**, y elegir uno cambia las listas de valores:

| Trabajo | Qué aporta | Encaja con |
|---|---|---|
| Beniczky 2025, Epilepsia: clasificación ILAE actualizada de las crisis. doi:[10.1111/epi.18338](https://doi.org/10.1111/epi.18338), PMID 40264351 | Clases y tipos de crisis vigentes. Reemplaza a la de 2017 y cambia «awareness» por estado de conciencia. | `crisis_clase`, `crisis_conciencia`, `crisis_tipo` |
| Beniczky 2025, Epileptic Disord: guía práctica de la clasificación 2025. doi:[10.1002/epd2.70110](https://doi.org/10.1002/epd2.70110), PMID 41081650 | Tabla de descriptores semiológicos alineada con la clasificación 2025, en secuencia temporal. | `crisis_secuencia` |
| Beniczky 2022, Epileptic Disord: glosario ILAE de semiología. doi:[10.1684/epd.2022.1430](https://doi.org/10.1684/epd.2022.1430), PMID 35770761 | Definición de cada signo y su valor localizador o lateralizador. Anterior a la clasificación 2025. | Definiciones para el manual de codificación |
| Beniczky 2017, Clin Neurophysiol: SCORE segunda versión. doi:[10.1016/j.clinph.2017.07.418](https://doi.org/10.1016/j.clinph.2017.07.418), PMID 28838815 | Terminología estandarizada para informar EEG. Trae un módulo de crisis con semiología, pero anterior a la clasificación 2025. | `eeg_previo_hallazgos`; alternativa para la semiología si el centro ya informa con SCORE |

**Recomendación (no confirmada):** clasificación 2025 + tabla de descriptores de la guía práctica 2025, usando el glosario 2022 como manual de definiciones. Si el centro todavía codifica con la clasificación de 2017 (Fisher 2017), hay que decirlo antes de cargar nada, porque los campos cambian.

Hasta que el investigador confirme, los dos paquetes de `diccionario/terminologias/` están en `pendiente_confirmacion`, sus listas reales están vacías y el modo `real` está bloqueado.

## Clasificación, síndromes y resultados

- Scheffer IE, et al. ILAE classification of the epilepsies: position paper of the ILAE Commission for Classification and Terminology. Epilepsia. 2017;58(4):512-521. doi:[10.1111/epi.13709](https://doi.org/10.1111/epi.13709), PMID 28276062. Usada en `tipo_epilepsia` y `etiologia`.
- Fisher RS, et al. Operational classification of seizure types by the ILAE. Epilepsia. 2017;58(4):522-530. doi:[10.1111/epi.13670](https://doi.org/10.1111/epi.13670), PMID 28276060. Alternativa si el centro sigue con 2017.
- Riney K, et al. International League Against Epilepsy classification and definition of epilepsy syndromes with onset at a variable age. Epilepsia. 2022;63(6):1443-1474. doi:[10.1111/epi.17240](https://doi.org/10.1111/epi.17240), PMID 35503725. Lista `sindromes`.
- Hirsch E, et al. ILAE definition of the idiopathic generalized epilepsy syndromes. Epilepsia. 2022;63(6):1475-1499. doi:[10.1111/epi.17236](https://doi.org/10.1111/epi.17236), PMID 35503716. Lista `sindromes`.
- Kwan P, et al. Definition of drug resistant epilepsy: consensus proposal by the ad hoc Task Force of the ILAE. Epilepsia. 2010;51(6):1069-1077. doi:[10.1111/j.1528-1167.2009.02397.x](https://doi.org/10.1111/j.1528-1167.2009.02397.x), PMID 19889013. Campo `farmacorresistencia`.
- Wieser HG, et al. ILAE Commission Report. Proposal for a new classification of outcome with respect to epileptic seizures following epilepsy surgery. Epilepsia. 2001;42(2):282-286. PMID 11240604 (sin DOI en PubMed). Campo `ilae_resultado_12m`.
- Hirsch LJ, et al. American Clinical Neurophysiology Society's Standardized Critical Care EEG Terminology: 2021 version. J Clin Neurophysiol. 2021;38(1):1-29. doi:[10.1097/WNP.0000000000000806](https://doi.org/10.1097/WNP.0000000000000806), PMID 33475321. Solo para hallazgos de EEG.

## Desidentificación

- El Emam K, Dankar FK. Protecting privacy using k-anonymity. J Am Med Inform Assoc. 2008;15(5):627-637. doi:[10.1197/jamia.M2716](https://doi.org/10.1197/jamia.M2716), PMID 18579830. Base del criterio de k mínimo y de la supresión local. El mismo trabajo muestra que el k-anonimato básico sobre-anonimiza cuando la muestra es una fracción chica de la población, y propone una alternativa por prueba de hipótesis que el bioestadístico puede evaluar.
- Sweeney L. k-anonymity: a model for protecting privacy. Int J Uncertain Fuzziness Knowl-Based Syst. 2002;10(5):557-570. doi:10.1142/S0218488502001648. No está en PubMed; DOI tomado de la editorial, no verificado en esta sesión.
