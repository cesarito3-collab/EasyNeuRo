// Generador de pacientes INVENTADOS para probar el conversor. Ninguno es una persona real.
// Determinista (semilla fija) para que las pruebas den siempre lo mismo.

function prng(semilla) {
  let a = semilla >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PERFILES = {
  temporal_mesial: r => ({
    paciente: {tipo_epilepsia: 'focal', sindrome_epileptico: 'epilepsia_temporal_mesial_con_esclerosis_hipocampal', etiologia: ['estructural'], etiologia_estructural_subtipo: 'esclerosis_hipocampal', farmacorresistencia: 'si', rm_realizada: 'si', rm_campo: '3T', rm_protocolo_epilepsia: 'si', rm_resultado: 'lesional', rm_lesion: 'esclerosis_hipocampal', rm_localizacion: [`temporal_mesial|${r.lado}`], hipotesis_localizacion: [`temporal_mesial|${r.lado}`], hipotesis_confianza: 'alta', hipotesis_concordancia: ['semiologia', 'eeg_interictal', 'rm'], conducta_prequirurgica: 'cirugia_directa', cirugia: r.u() < 0.6 ? 'lobectomia_temporal_anterior' : 'ninguna'},
    crisis: [{crisis_orden: 1, crisis_clase: 'focal', crisis_conciencia: 'alterada', crisis_manifestaciones_observables: 'si', crisis_secuencia: ['aura_epigastrica', 'detencion_del_comportamiento', 'automatismos_oroalimentarios', `postura_distonica|${r.contra}`], crisis_fuente_semiologia: 'video_eeg', crisis_frecuencia: 'mensual', crisis_duracion_tipica: '30_s_a_2_min', crisis_relacion_sueno: 'vigilia', crisis_desencadenantes: ['privacion_de_sueno'], crisis_registrada_video_eeg: 'si'}],
    farmacos: [{farmaco: 'carbamazepina', farmaco_estado: 'al_eeg_indice', farmaco_dosis_mg_dia: 800}, {farmaco: 'levetiracetam', farmaco_estado: 'previo_suspendido', farmaco_motivo_suspension: 'ineficacia'}]
  }),
  mioclonica_juvenil: () => ({
    paciente: {tipo_epilepsia: 'generalizada', sindrome_epileptico: 'epilepsia_mioclonica_juvenil', etiologia: ['genetica'], farmacorresistencia: 'no', rm_realizada: 'si', rm_campo: '1_5T', rm_protocolo_epilepsia: 'no', rm_resultado: 'normal', conducta_prequirurgica: 'no_aplica', cirugia: 'ninguna'},
    crisis: [{crisis_orden: 1, crisis_clase: 'generalizada', crisis_manifestaciones_observables: 'si', crisis_secuencia: ['actividad_clonica|bilateral'], crisis_fuente_semiologia: 'relato_del_paciente', crisis_frecuencia: 'menos_que_mensual', crisis_duracion_tipica: 'menos_de_30_s', crisis_relacion_sueno: 'al_despertar', crisis_desencadenantes: ['privacion_de_sueno', 'alcohol'], crisis_registrada_video_eeg: 'no'}],
    farmacos: [{farmaco: 'acido_valproico', farmaco_estado: 'al_eeg_indice', farmaco_dosis_mg_dia: 1000}]
  }),
  focal_desconocida: r => ({
    paciente: {tipo_epilepsia: 'focal', sindrome_epileptico: 'ninguno_identificado', etiologia: ['desconocida'], farmacorresistencia: r.u() < 0.5 ? 'si' : 'no', rm_realizada: 'si', rm_campo: '3T', rm_protocolo_epilepsia: 'si', rm_resultado: 'normal', conducta_prequirurgica: 'en_evaluacion', cirugia: 'ninguna'},
    crisis: [{crisis_orden: 1, crisis_clase: 'focal', crisis_conciencia: 'preservada', crisis_manifestaciones_observables: 'si', crisis_secuencia: ['aura_sensitiva|' + r.contra], crisis_fuente_semiologia: 'relato_del_paciente', crisis_frecuencia: 'semanal', crisis_duracion_tipica: 'menos_de_30_s', crisis_relacion_sueno: 'ambas', crisis_desencadenantes: ['ninguno'], crisis_registrada_video_eeg: 'desconocido'}],
    farmacos: [{farmaco: 'lamotrigina', farmaco_estado: 'al_eeg_indice', farmaco_dosis_mg_dia: 200}]
  }),
  // Raros a propósito: deben terminar colapsados o suprimidos.
  hipermotora: r => ({
    paciente: {tipo_epilepsia: 'focal', sindrome_epileptico: 'epilepsia_hipermotora_relacionada_con_el_sueno', etiologia: ['estructural'], etiologia_estructural_subtipo: 'displasia_cortical_focal', farmacorresistencia: 'si', rm_realizada: 'si', rm_campo: '3T', rm_protocolo_epilepsia: 'si', rm_resultado: 'lesional', rm_lesion: 'displasia_cortical_focal', rm_localizacion: [`frontal|${r.lado}`], hipotesis_localizacion: [`frontal|${r.lado}`], hipotesis_confianza: 'moderada', hipotesis_concordancia: ['semiologia', 'rm'], conducta_prequirurgica: 'seeg', seeg_realizado: 'si', seeg_numero_electrodos: 12, seeg_regiones_muestreadas: [`orbitofrontal|${r.lado}`, `cingulo|${r.lado}`, `insula|${r.lado}`], seeg_zona_inicio: [`orbitofrontal|${r.lado}`], seeg_crisis_registradas: 4, seeg_estimulacion_reproduce: 'si', cirugia: 'reseccion_a_medida'},
    crisis: [{crisis_orden: 1, crisis_clase: 'focal', crisis_conciencia: 'alterada', crisis_manifestaciones_observables: 'si', crisis_secuencia: ['hipermotora', 'vocalizacion'], crisis_fuente_semiologia: 'video_eeg', crisis_frecuencia: 'diaria', crisis_duracion_tipica: 'menos_de_30_s', crisis_relacion_sueno: 'sueno', crisis_desencadenantes: ['ninguno'], crisis_registrada_video_eeg: 'si'}],
    farmacos: [{farmaco: 'cenobamato', farmaco_estado: 'al_eeg_indice', farmaco_dosis_mg_dia: 200}]
  }),
  rasmussen: r => ({
    paciente: {tipo_epilepsia: 'focal', sindrome_epileptico: 'sindrome_de_rasmussen', etiologia: ['inmune'], farmacorresistencia: 'si', rm_realizada: 'si', rm_campo: '3T', rm_protocolo_epilepsia: 'si', rm_resultado: 'lesional', rm_lesion: 'otra_lesion', rm_localizacion: [`hemisferica|${r.lado}`], conducta_prequirurgica: 'cirugia_directa', cirugia: 'desconexion_o_hemisferotomia'},
    crisis: [{crisis_orden: 1, crisis_clase: 'focal', crisis_conciencia: 'preservada', crisis_manifestaciones_observables: 'si', crisis_secuencia: ['actividad_clonica|' + r.contra], crisis_fuente_semiologia: 'video_eeg', crisis_frecuencia: 'diaria', crisis_duracion_tipica: 'mas_de_5_min', crisis_relacion_sueno: 'ambas', crisis_desencadenantes: ['ninguno'], crisis_registrada_video_eeg: 'si'}],
    farmacos: [{farmaco: 'fenfluramina', farmaco_estado: 'al_eeg_indice', farmaco_dosis_mg_dia: 20}]
  })
};

/** Devuelve n pacientes inventados, todos con _sintetico: true y código PRUEBA-NNNN. */
export function pacientesSinteticos(n = 40, semilla = 20261125) {
  const u = prng(semilla), elegir = a => a[Math.floor(u() * a.length)];
  const plan = [['rasmussen', 1], ['hipermotora', 2], ['mioclonica_juvenil', Math.round(n * 0.25)]];
  const lista = [];
  for (const [p, c] of plan) for (let i = 0; i < c; i++) lista.push(p);
  while (lista.length < n) lista.push(u() < 0.55 ? 'temporal_mesial' : 'focal_desconocida');
  return lista.map((perfil, i) => {
    const lado = u() < 0.5 ? 'izquierdo' : 'derecho', contra = lado === 'izquierdo' ? 'derecho' : 'izquierdo';
    const r = {u, lado, contra};
    const base = PERFILES[perfil](r);
    const edad = perfil === 'mioclonica_juvenil' ? 18 + Math.floor(u() * 20) : 20 + Math.floor(u() * 45);
    const inicio = perfil === 'mioclonica_juvenil' ? 12 + Math.floor(u() * 6) : Math.floor(u() * Math.min(edad, 40));
    const cod = `PRUEBA-${String(i + 1).padStart(4, '0')}`;
    const fiebre = u() < 0.25 ? 'si' : 'no';
    const p = {
      codigo_paciente: cod, edad_eeg_indice: edad, sexo: elegir(['M', 'F']), region_residencia: elegir(['amba', 'amba', 'amba', 'resto_buenos_aires', 'centro']),
      nivel_educativo: elegir(['secundario_completo', 'terciario_o_universitario', 'primario_completo']), situacion_laboral: elegir(['activo', 'desocupado', 'jubilado_o_pension']),
      cobertura_salud: elegir(['publica_exclusiva', 'obra_social']), lateralidad_manual: u() < 0.9 ? 'diestro' : 'zurdo', edad_inicio_epilepsia: inicio,
      crisis_febriles: fiebre, ...(fiebre === 'si' ? {crisis_febriles_tipo: elegir(['simples', 'complejas']), crisis_febriles_edad_primera: 12 + Math.floor(u() * 40), crisis_febriles_numero: 1 + Math.floor(u() * 3)} : {}),
      antecedente_perinatal: ['ninguno'], tec_previo: 'no', infeccion_snc_previa: 'no', estado_epileptico_previo: 'no',
      epilepsia_familiar_1er_grado: perfil === 'mioclonica_juvenil' && u() < 0.4 ? 'si' : 'no', epilepsia_familiar_2do_grado: 'desconocido', crisis_febriles_familiares: 'desconocido', consanguinidad_parental: 'no',
      estudio_genetico: 'no_realizado', discapacidad_intelectual: 'no', trastorno_espectro_autista: 'no', tdah: 'no', trastorno_aprendizaje: 'no', escolaridad_especial: 'no',
      comorbilidad_psiquiatrica: u() < 0.3 ? ['depresion'] : ['ninguna'],
      eeg_previos_numero: Math.floor(u() * 8), eeg_previo_hallazgos: ['actividad_epileptiforme_focal'], eeg_previo_localizacion_aei: [`temporal_sin_precisar|${lado}`], video_eeg_prolongado_previo: 'no', meses_desde_eeg_previo: Math.floor(u() * 60),
      neuropsicologia_realizada: 'si', np_memoria_verbal_z: Math.round((u() * 4 - 3) * 10) / 10, np_memoria_visual_z: Math.round((u() * 3 - 2) * 10) / 10, np_lenguaje_z: -0.5, np_ejecutivas_z: 0, np_atencion_z: 0.2, cociente_intelectual_total: 80 + Math.floor(u() * 40),
      dominancia_lenguaje: 'izquierda', dominancia_metodo: 'no_aplica', pet_fdg: 'no_realizado', spect_ictal: 'no_realizado', farmacos_probados_total: 1 + Math.floor(u() * 5), dieta_cetogenica: 'nunca', neuromodulacion: 'ninguna', seeg_realizado: 'no',
      ...base.paciente
    };
    if (perfil === 'mioclonica_juvenil') { p.eeg_previo_hallazgos = ['actividad_epileptiforme_generalizada']; delete p.eeg_previo_localizacion_aei; p.hipotesis_confianza = 'no_aplica'; }
    if (p.cirugia && p.cirugia !== 'ninguna') { p.cirugia_lado = lado; p.meses_cirugia_respecto_indice = 6 + Math.floor(u() * 30); p.anatomia_patologica = perfil === 'temporal_mesial' ? 'esclerosis_hipocampal' : 'otra'; p.engel_12m = elegir(['I', 'I', 'II', 'III']); p.ilae_resultado_12m = elegir(['1', '1', '2', '4']); }
    if (p.anatomia_patologica && p.cirugia === 'desconexion_o_hemisferotomia') p.anatomia_patologica = 'gliosis';
    return {
      _sintetico: true,
      paciente: p,
      estudios: [{codigo_estudio: `${cod}-01`, tipo_registro: elegir(['rutina', 'video_eeg', 'prolongado']), estado_durante_registro: ['vigilia', 'sueno_espontaneo'], psicotropos_al_registro: ['ninguno'], horas_desde_ultima_crisis: Math.floor(u() * 400)}],
      crisis: base.crisis,
      farmacos: base.farmacos
    };
  });
}
