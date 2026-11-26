// Conversor de datos clínicos estructurados: valida contra el diccionario, generaliza,
// colapsa categorías raras y verifica k-anonimato. Trabaja en memoria: no lee ni escribe
// archivos (eso queda para fuentes y destinos, ver interfaces.js, todavía sin implementar).
// Código puro.

import {validarDiccionario, camposPorTabla, claveProhibida, cuasiIdentificadores, seExporta} from './diccionario.js';
import {validarValor, cumpleCondicion, generalizar, vacio} from './transformar.js';
import {colapsarRaros, verificarK, suprimirHastaK} from './kanonimato.js';
import {exigirPuerta} from './puerta.js';

export const VERSION = '0.1.0';
const HERRAMIENTA = `NeuroVisor Fase 3 · conversor clínico ${VERSION}`;

function buscarClavesProhibidas(obj, dic, donde, errores) {
  if (Array.isArray(obj)) { obj.forEach((x, i) => buscarClavesProhibidas(x, dic, `${donde}[${i + 1}]`, errores)); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const id = claveProhibida(k, dic);
    if (id) errores.push({donde, campo: k, mensaje: `La columna «${k}» parece un identificador (${id}). No se procesa nada: quítela del archivo de entrada.`});
    buscarClavesProhibidas(v, dic, `${donde}.${k}`, errores);
  }
}

function procesarFila(cruda, campos, tabla, dic, terminologias, opciones, donde, errores, extra = {}) {
  const ids = new Set(campos.map(c => c.id));
  for (const k of Object.keys(cruda)) if (!ids.has(k) && !(k in extra)) errores.push({donde, campo: k, mensaje: `«${k}» no está en el diccionario de la tabla ${tabla}. Solo pasan los campos del diccionario.`});
  const val = {...extra};
  for (const c of campos) {
    if (c.derivado) {
      if (!vacio(cruda[c.id])) errores.push({donde, campo: c.id, mensaje: `${c.id} se calcula solo; no se carga.`});
      continue;
    }
    const v = cruda[c.id];
    if (vacio(v)) continue;
    if (c.si && v === 'no_aplica') { val[c.id] = 'no_aplica'; continue; }
    const r = validarValor(c, v, dic, terminologias, opciones);
    if (r.error) errores.push({donde, campo: c.id, mensaje: r.error}); else val[c.id] = r.valor;
  }
  for (const c of campos) {
    if (c.si) {
      const aplica = cumpleCondicion(c.si, val);
      if (!aplica) {
        if (!vacio(val[c.id]) && val[c.id] !== 'no_aplica') errores.push({donde, campo: c.id, mensaje: `${c.id} solo se carga si ${c.si.campo} lo indica; quedó con valor sin corresponder.`});
        val[c.id] = 'no_aplica';
        continue;
      }
      if (val[c.id] === 'no_aplica') {
        const r = validarValor(c, 'no_aplica', dic, terminologias, opciones);
        if (r.error) errores.push({donde, campo: c.id, mensaje: `${c.id}: dice «no_aplica» pero ${c.si.campo} indica que corresponde cargarlo.`});
      }
    }
    if (c.requerido && vacio(val[c.id]) && !c.derivado) errores.push({donde, campo: c.id, mensaje: `${c.id} es obligatorio.`});
  }
  for (const c of campos.filter(c => c.derivado)) {
    const [a, b] = c.derivado.de.map(d => val[d]);
    if (typeof a === 'number' && typeof b === 'number') {
      const r = a - b;
      if (c.rango && (r < c.rango[0] || r > c.rango[1])) errores.push({donde, campo: c.id, mensaje: `${c.id} da ${r}, fuera de rango.`});
      else val[c.id] = r;
    }
  }
  for (const r of dic.reglas || []) {
    if (r.tipo === 'menor_o_igual' && ids.has(r.a) && typeof val[r.a] === 'number' && typeof val[r.b] === 'number' && val[r.a] > val[r.b]) errores.push({donde, campo: r.a, mensaje: r.mensaje});
    if (r.tipo === 'prefijo' && ids.has(r.campo) && typeof val[r.campo] === 'string' && typeof val[r.de] === 'string' && !val[r.campo].startsWith(val[r.de] + '-')) errores.push({donde, campo: r.campo, mensaje: r.mensaje});
  }
  const fila = {...extra};
  for (const c of campos) fila[c.id] = vacio(val[c.id]) ? '' : generalizar(c, val[c.id]);
  return fila;
}

/**
 * @param {object} p
 * @param {Array<object>} p.pacientes  registros {_sintetico?, paciente:{…}, estudios:[…], crisis:[…], farmacos:[…]}
 * @param {object} p.diccionario       diccionario/diccionario-clinico.json
 * @param {object} p.terminologias     {clasificacion_crisis, semiologia}
 * @param {object} p.config            config/fase3.config.json (aprobaciones)
 * @param {'sintetico'|'real'} p.modo
 * @returns {{ok:boolean, errores?:Array, tablas?:object, informe_publico?:object, informe_privado?:object, sello?:object}}
 */
export function convertir({pacientes, diccionario: dic, terminologias = {}, config = {}, modo}) {
  const problemas = validarDiccionario(dic, terminologias);
  if (problemas.length) throw new Error('El diccionario tiene problemas:\n' + problemas.join('\n'));
  exigirPuerta({modo, config, diccionario: dic, terminologias, pacientes});
  const opciones = {permitirProvisionales: modo === 'sintetico'};
  const k = dic.parametros.k_minimo, P = dic.parametros;
  const porTabla = camposPorTabla(dic);
  const errores = [];

  pacientes.forEach((p, i) => buscarClavesProhibidas(p, dic, `registro ${i + 1}`, errores));
  if (errores.length) return {ok: false, errores};

  const crudas = Object.fromEntries([...porTabla.keys()].map(t => [t, []]));
  const vistos = new Set();
  pacientes.forEach((p, i) => {
    const conocidas = new Set(['_sintetico', ...Object.values(dic.tablas).map(t => t.entrada)]);
    for (const k2 of Object.keys(p)) if (!conocidas.has(k2)) errores.push({donde: `registro ${i + 1}`, campo: k2, mensaje: `«${k2}» no es una sección conocida.`});
    const donde = p.paciente?.codigo_paciente || `registro ${i + 1}`;
    const fp = procesarFila(p.paciente || {}, porTabla.get('paciente'), 'paciente', dic, terminologias, opciones, donde, errores);
    if (fp.codigo_paciente && vistos.has(fp.codigo_paciente)) errores.push({donde, campo: 'codigo_paciente', mensaje: 'Paciente repetido en el lote.'});
    vistos.add(fp.codigo_paciente);
    crudas.paciente.push(fp);
    for (const [tabla, def] of Object.entries(dic.tablas)) {
      if (tabla === 'paciente') continue;
      const filas = p[def.entrada] || [];
      if (!Array.isArray(filas)) { errores.push({donde, campo: def.entrada, mensaje: `${def.entrada} debe ser una lista.`}); continue; }
      filas.forEach((f, j) => {
        if ('codigo_paciente' in f && f.codigo_paciente !== fp.codigo_paciente) errores.push({donde: `${donde} · ${tabla} ${j + 1}`, campo: 'codigo_paciente', mensaje: 'No coincide con el paciente.'});
        const {codigo_paciente: _omit, ...resto} = f;
        crudas[tabla].push(procesarFila(resto, porTabla.get(tabla), tabla, dic, terminologias, opciones, `${donde} · ${tabla} ${j + 1}`, errores, {codigo_paciente: fp.codigo_paciente}));
      });
    }
  });
  if (errores.length) return {ok: false, errores};

  // Colapso de categorías raras: se cuenta sobre el lote entero, por paciente.
  const colapsos = [];
  for (const [tabla, campos] of porTabla) for (const c of campos) {
    if (c.transformacion.tipo !== 'colapsar_raros' || !seExporta(c)) continue;
    const r = colapsarRaros(crudas[tabla], c.id, {k, protegidos: P.valores_protegidos, otro: P.valor_colapso, suprimido: P.valor_suprimido});
    if (r.colapsados.length || r.suprimidos) colapsos.push({tabla, ...r});
  }

  // k-anonimato sobre los cuasi-identificadores de la tabla de pacientes.
  const qis = cuasiIdentificadores(dic);
  const antes = verificarK(crudas.paciente, qis, k);
  const supresion = suprimirHastaK(crudas.paciente, qis, k, P.orden_supresion, P.valor_suprimido);
  let excluidos = 0;
  if (!supresion.cumple) {
    if (P.politica_sin_k !== 'excluir') {
      return {ok: false, errores: [{donde: 'lote', campo: '', mensaje: `${supresion.filas_sin_k} paciente(s) siguen en combinaciones de menos de ${k} aun con todo suprimido. No se genera salida. El bioestadístico decide: excluirlos (parametros.politica_sin_k = «excluir»), quitar cuasi-identificadores o juntar más pacientes.`}], informe_privado: {colapsos, k_antes: antes, supresion}};
    }
    const fuera = new Set(supresion.indices_sin_k.map(i => crudas.paciente[i].codigo_paciente));
    excluidos = fuera.size;
    for (const t of Object.keys(crudas)) crudas[t] = crudas[t].filter(f => !fuera.has(f.codigo_paciente));
    supresion.excluidos = [...fuera];
    if (!crudas.paciente.length) return {ok: false, errores: [{donde: 'lote', campo: '', mensaje: `Excluir a los pacientes sin k deja el lote vacío: hay menos de ${k} pacientes en total. No se genera salida.`}], informe_privado: {colapsos, k_antes: antes, supresion}};
  }

  // Salida: solo campos exportables, listas unidas con «;».
  const tablas = {};
  for (const [tabla, campos] of porTabla) {
    const cols = [...(tabla === 'paciente' ? [] : ['codigo_paciente']), ...campos.filter(seExporta).map(c => c.id)];
    tablas[tabla] = {columnas: cols, filas: crudas[tabla].map(f => Object.fromEntries(cols.map(c => [c, Array.isArray(f[c]) ? f[c].join(';') : f[c]])))};
  }
  const celdasSuprimidas = supresion.pasos.reduce((s, x) => s + x.celdas, 0) + colapsos.reduce((s, x) => s + (x.suprimidos || 0), 0);
  const sello = {
    herramienta: HERRAMIENTA, diccionario_version: dic.version, diccionario_estado: dic.estado, modo, k_minimo: k,
    aviso: modo === 'sintetico' ? 'DATOS INVENTADOS: solo para probar el programa. No sirven para ningún análisis.' : 'Datos seudonimizados: siguen siendo datos personales mientras exista la tabla de correspondencia.'
  };
  return {
    ok: true, tablas, sello,
    // Va con la salida: solo cantidades, ningún valor raro.
    informe_publico: {pacientes: crudas.paciente.length, filas: Object.fromEntries(Object.entries(tablas).map(([t, x]) => [t, x.filas.length])), cuasi_identificadores: qis, cumple_k: true, pacientes_excluidos_por_k: excluidos, campos_con_colapso: colapsos.length, celdas_suprimidas: celdasSuprimidas},
    // Va a la carpeta privada: nombra los valores raros y las combinaciones chicas.
    informe_privado: {colapsos, k_antes: antes, supresion}
  };
}
