// Puntos de conexión para construir el conversor completo. Están DECLARADOS pero NO
// IMPLEMENTADOS a propósito: implementarlos es cargar datos de pacientes, y eso espera
// a los tres pendientes de docs/PENDIENTES.md.

/**
 * @typedef {object} RegistroPaciente
 * @property {true} [_sintetico]  solo en registros inventados
 * @property {object} paciente    campos de la tabla «paciente» (ver diccionario)
 * @property {object[]} [estudios]
 * @property {object[]} [crisis]
 * @property {object[]} [farmacos]
 */

/**
 * Fuente de registros: de dónde salen los datos ya codificados (planilla, formulario offline, exportación de REDCap…).
 * Debe entregar valores de las listas cerradas del diccionario: nunca texto libre ni fechas.
 * @typedef {object} FuenteDeRegistros
 * @property {() => AsyncIterable<RegistroPaciente>} leer
 */

/**
 * Registro de seudónimos: lee CONFIDENCIAL_tabla_correspondencia.csv del desidentificador EDF
 * (carpeta privada) para que el dato clínico lleve el MISMO código que su EEG. Debe usar la misma
 * regla de paciente que esa herramienta (HC normalizada o nombre + nacimiento) y no escribir nunca
 * en esa tabla.
 * @typedef {object} RegistroDeSeudonimos
 * @property {(hc: string) => string|null} codigoPaciente
 * @property {(codigoEstudio: string) => boolean} existeEstudio
 */

/**
 * Destino de salida: dos carpetas separadas como en el desidentificador EDF.
 * escribirPublico: tablas clínicas + informe_publico (se entrega).
 * escribirPrivado: informe_privado + auditoría (no se entrega).
 * Debe negarse a usar la misma carpeta para las dos y a sobrescribir archivos.
 * @typedef {object} DestinoDeSalida
 * @property {(nombre: string, contenido: string) => Promise<void>} escribirPublico
 * @property {(nombre: string, contenido: string) => Promise<void>} escribirPrivado
 */

const NO = q => () => { throw new Error(`${q}: no implementado. La Fase 3 espera la aprobación del CEI, el diccionario validado y la cita de semiología (docs/PENDIENTES.md).`); };

export const crearFuenteDeRegistros = NO('FuenteDeRegistros');
export const crearRegistroDeSeudonimos = NO('RegistroDeSeudonimos');
export const crearDestinoDeSalida = NO('DestinoDeSalida');
