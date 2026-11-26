// Bloqueo de la Fase 3: el conversor no procesa datos reales hasta que estén
// cumplidos los tres requisitos de docs/PENDIENTES.md. Código puro.
//
// Es una salvaguarda contra el uso por error, no un control de seguridad:
// quien edite el código o la configuración puede saltarla. La responsabilidad
// sigue siendo del investigador y del comité de ética.

export const PENDIENTES = [
  {id: 'cei', titulo: 'Aprobación del comité de ética (CEI) específica para la Fase 3', detalle: 'Dictamen que cubra explícitamente los datos clínicos estructurados (no alcanza la aprobación de la fase de EEG).'},
  {id: 'bioestadistica', titulo: 'Diccionario de datos validado por un bioestadístico', detalle: 'Versión del diccionario revisada y firmada: campos, tramos, k mínimo y cuasi-identificadores.'},
  {id: 'cita_semiologia', titulo: 'Cita de la terminología de semiología confirmada por el investigador', detalle: 'Referencia elegida (DOI) y tablas transcriptas en diccionario/terminologias/.'}
];

const lleno = v => typeof v === 'string' && v.trim() !== '';

/** Revisa qué falta para poder usar datos reales. No lanza errores. */
export function estadoPuerta(config = {}, dic = {}, terminologias = {}) {
  const faltan = [];
  const cei = config.aprobacion_cei || {};
  const ceiOk = lleno(cei.comite) && lleno(cei.numero_dictamen) && lleno(cei.fecha_dictamen) && cei.incluye_datos_clinicos_fase3 === true;
  if (!ceiOk) faltan.push('cei');

  const bio = config.diccionario_validado || {};
  const bioOk = lleno(bio.bioestadistico) && bio.version_validada === dic.version && dic.estado === 'validado';
  if (!bioOk) faltan.push('bioestadistica');

  const cita = config.cita_semiologia || {};
  const sem = terminologias.semiologia || {}, cla = terminologias.clasificacion_crisis || {};
  const doiOk = lleno(cita.doi) && cita.confirmada_por_investigador === true;
  const paquetesOk = [sem, cla].every(t => t.estado === 'confirmada' && lleno(t.referencia_confirmada?.doi));
  const coinciden = paquetesOk && [sem, cla].some(t => t.referencia_confirmada.doi.trim().toLowerCase() === String(cita.doi).trim().toLowerCase());
  const listasOk = Array.isArray(sem.descriptores) && sem.descriptores.length > 0;
  if (!(doiOk && paquetesOk && coinciden && listasOk)) faltan.push('cita_semiologia');

  return {lista: faltan.length === 0, faltan, pendientes: PENDIENTES.filter(p => faltan.includes(p.id))};
}

/**
 * Decide si se puede convertir. modo «sintetico»: solo registros inventados marcados con _sintetico: true.
 * modo «real»: exige los tres pendientes cumplidos. Lanza un Error con la lista de lo que falta.
 */
export function exigirPuerta({modo, config, diccionario, terminologias, pacientes}) {
  if (modo === 'sintetico') {
    const malos = (pacientes || []).filter(p => p._sintetico !== true).length;
    if (malos) throw new Error(`Modo de prueba: ${malos} registro(s) no están marcados como inventados (_sintetico: true). El modo de prueba no acepta datos reales.`);
    return {modo, pendientes: estadoPuerta(config, diccionario, terminologias).pendientes};
  }
  if (modo !== 'real') throw new Error('modo debe ser «sintetico» o «real».');
  const e = estadoPuerta(config, diccionario, terminologias);
  if (!e.lista) {
    const lista = e.pendientes.map((p, i) => `${i + 1}. ${p.titulo}`).join('\n');
    throw new Error(`La Fase 3 todavía no puede usarse con datos reales. Falta:\n${lista}\nVer fase3-clinica/docs/PENDIENTES.md.`);
  }
  if ((pacientes || []).some(p => p._sintetico === true)) throw new Error('Hay registros inventados mezclados con datos reales.');
  return {modo, pendientes: []};
}
