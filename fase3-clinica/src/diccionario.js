// Lectura y validación del diccionario de datos clínicos.
// Código puro (sin Node ni navegador): se podrá incrustar en un HTML offline
// igual que el desidentificador EDF.

export const TIPOS = new Set(['codigo', 'entero', 'decimal', 'categoria', 'multicategoria', 'localizacion', 'secuencia']);
// Estos tipos no existen a propósito: fechas exactas y texto libre no entran nunca.
export const TIPOS_PROHIBIDOS = new Set(['fecha', 'hora', 'fecha_hora', 'texto', 'texto_libre']);
export const TRANSFORMACIONES = new Set(['ninguna', 'tramos', 'colapsar_raros']);
export const RIESGOS = new Set(['seudonimo', 'cuasi_alto', 'cuasi_medio', 'bajo']);
export const TIPOS_LISTA = new Set(['multicategoria', 'localizacion', 'secuencia']);
const OPERADORES_SI = ['en', 'no_en', 'contiene'];

/** Pasa un nombre de columna a la forma en que se comparan las claves: minúsculas, sin acentos, _ como separador. */
export function normalizarClave(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Devuelve el id del identificador prohibido al que se parece la clave, o null. */
export function claveProhibida(clave, dic) {
  const k = normalizarClave(clave);
  for (const p of dic.identificadores_prohibidos || []) if (new RegExp(p.patron).test(k)) return p.id;
  return null;
}

/**
 * Resuelve la lista de valores de un campo: arreglo literal, "lista:<nombre>" o "terminologia:<paquete>.<clave>".
 * Con permitirProvisionales, un paquete de terminología sin confirmar usa sus valores provisionales (solo datos inventados).
 * Devuelve null si la referencia no existe.
 */
export function resolverValores(ref, dic, terminologias = {}, {permitirProvisionales = false} = {}) {
  if (Array.isArray(ref)) return ref;
  if (typeof ref !== 'string') return null;
  if (ref.startsWith('lista:')) return dic.listas?.[ref.slice(6)] ?? null;
  if (ref.startsWith('terminologia:')) {
    const [paquete, clave] = ref.slice(13).split('.');
    const t = terminologias[paquete];
    if (!t || !(clave in t)) return null;
    const v = t[clave];
    if (Array.isArray(v) && v.length === 0 && permitirProvisionales && t.estado !== 'confirmada') {
      const prov = t[clave + '_provisionales'];
      if (prov && Array.isArray(prov.valores)) return prov.valores;
    }
    return Array.isArray(v) ? v : null;
  }
  return null;
}

export function camposPorTabla(dic) {
  const m = new Map(Object.keys(dic.tablas || {}).map(t => [t, []]));
  for (const c of dic.campos || []) if (m.has(c.tabla)) m.get(c.tabla).push(c);
  return m;
}

export function campo(dic, id) { return (dic.campos || []).find(c => c.id === id) || null; }

export const seExporta = c => c.exporta !== false;
export const cuasiIdentificadores = dic => (dic.campos || []).filter(c => c.cuasi_identificador && seExporta(c)).map(c => c.id);

/** Revisa la estructura del diccionario. Devuelve una lista de problemas (vacía = bien formado). */
export function validarDiccionario(dic, terminologias = {}) {
  const P = [];
  if (dic.formato !== 'neurovisor-diccionario-clinico') P.push('formato desconocido');
  if (!/^\d+\.\d+\.\d+$/.test(dic.version || '')) P.push('version debe ser X.Y.Z');
  if (!['borrador', 'validado'].includes(dic.estado)) P.push('estado debe ser «borrador» o «validado»');
  const k = dic.parametros?.k_minimo;
  if (!(Number.isInteger(k) && k >= 2)) P.push('parametros.k_minimo debe ser un entero ≥ 2');
  const tablas = new Set(Object.keys(dic.tablas || {}));
  const categorias = new Set((dic.categorias || []).map(c => c.id));
  const ids = new Set();
  for (const c of dic.campos || []) {
    const q = `campo ${c.id}`;
    if (!c.id || ids.has(c.id)) P.push(`${q}: id vacío o repetido`);
    ids.add(c.id);
    if (claveProhibida(c.id, dic)) P.push(`${q}: el nombre coincide con un identificador prohibido (${claveProhibida(c.id, dic)})`);
    if (!tablas.has(c.tabla)) P.push(`${q}: tabla «${c.tabla}» inexistente`);
    if (!categorias.has(c.categoria)) P.push(`${q}: categoría «${c.categoria}» inexistente`);
    if (TIPOS_PROHIBIDOS.has(c.tipo)) P.push(`${q}: el tipo «${c.tipo}» está prohibido (sin fechas ni texto libre)`);
    else if (!TIPOS.has(c.tipo)) P.push(`${q}: tipo «${c.tipo}» desconocido`);
    if (!RIESGOS.has(c.riesgo)) P.push(`${q}: riesgo «${c.riesgo}» desconocido`);
    const t = c.transformacion?.tipo;
    if (!TRANSFORMACIONES.has(t)) P.push(`${q}: transformación «${t}» desconocida`);
    const numerico = c.tipo === 'entero' || c.tipo === 'decimal';
    if (t === 'tramos') {
      if (!numerico) P.push(`${q}: «tramos» solo sirve para números`);
      const tr = c.transformacion.tramos || [];
      if (tr.length < 2) P.push(`${q}: hacen falta al menos dos tramos`);
      tr.forEach((x, i) => {
        const ultimo = i === tr.length - 1;
        if (!x.etiqueta) P.push(`${q}: tramo ${i + 1} sin etiqueta`);
        if (ultimo && 'hasta' in x) P.push(`${q}: el último tramo no lleva «hasta» (es el abierto)`);
        if (!ultimo && typeof x.hasta !== 'number') P.push(`${q}: tramo ${i + 1} sin «hasta» numérico`);
        if (!ultimo && i > 0 && !(x.hasta > tr[i - 1].hasta)) P.push(`${q}: los «hasta» deben crecer`);
      });
      if (new Set(tr.map(x => x.etiqueta)).size !== tr.length) P.push(`${q}: etiquetas de tramos repetidas`);
    }
    if (numerico && t !== 'tramos' && c.riesgo !== 'bajo' && seExporta(c)) P.push(`${q}: un número con riesgo «${c.riesgo}» debe agruparse en tramos`);
    if (numerico && c.rango && !(c.rango.length === 2 && c.rango[0] < c.rango[1])) P.push(`${q}: rango mal formado`);
    if (c.tipo === 'codigo') { try { new RegExp(c.patron); } catch { P.push(`${q}: patrón inválido`); } }
    if (['categoria', ...TIPOS_LISTA].includes(c.tipo)) {
      const v = resolverValores(c.valores, dic, terminologias, {permitirProvisionales: true});
      if (!v) P.push(`${q}: no se encuentran los valores «${c.valores}»`);
      else if (new Set(v).size !== v.length) P.push(`${q}: valores repetidos`);
      if (TIPOS_LISTA.has(c.tipo) && !(Number.isInteger(c.max) && c.max >= 1)) P.push(`${q}: falta «max»`);
      if ((c.tipo === 'localizacion' || c.tipo === 'secuencia') && !resolverValores(c.lado, dic, terminologias)) P.push(`${q}: falta la lista de lados`);
    }
    if (c.cuasi_identificador && c.riesgo !== 'cuasi_alto') P.push(`${q}: un cuasi-identificador debe tener riesgo «cuasi_alto»`);
    if (c.riesgo === 'cuasi_alto' && seExporta(c) && t === 'ninguna') {
      const v = resolverValores(c.valores, dic, terminologias) || [];
      if (!(c.tipo === 'categoria' && v.length <= 3)) P.push(`${q}: riesgo «cuasi_alto» sin agrupar ni colapsar`);
    }
    if (c.si) {
      if (!c.si.campo) P.push(`${q}: condición sin campo`);
      if (!OPERADORES_SI.some(o => o in c.si)) P.push(`${q}: condición sin operador (${OPERADORES_SI.join(', ')})`);
    }
    if (c.derivado && c.derivado.operacion !== 'resta') P.push(`${q}: solo se admite el derivado «resta»`);
  }
  const porId = new Map((dic.campos || []).map(c => [c.id, c]));
  for (const c of dic.campos || []) {
    if (c.si && porId.get(c.si.campo)?.tabla !== c.tabla) P.push(`campo ${c.id}: la condición debe usar un campo de la misma tabla`);
    if (c.derivado) for (const d of c.derivado.de || []) if (porId.get(d)?.tabla !== c.tabla) P.push(`campo ${c.id}: derivado de «${d}», que no está en la misma tabla`);
  }
  for (const [t, def] of Object.entries(dic.tablas || {})) for (const kk of def.clave || []) {
    const c = porId.get(kk);
    if (!c) P.push(`tabla ${t}: la clave «${kk}» no es un campo`);
    else if (c.tabla !== t && kk !== 'codigo_paciente') P.push(`tabla ${t}: la clave «${kk}» es de otra tabla`);
  }
  for (const r of dic.reglas || []) for (const f of [r.a, r.b, r.campo, r.de].filter(Boolean)) if (!porId.has(f)) P.push(`regla ${r.tipo}: campo «${f}» inexistente`);
  const qi = new Set(cuasiIdentificadores(dic)), orden = dic.parametros?.orden_supresion || [];
  if (qi.size !== orden.length || orden.some(o => !qi.has(o))) P.push('parametros.orden_supresion debe listar exactamente los cuasi-identificadores exportados');
  for (const [nombre, def] of Object.entries(dic.terminologias || {})) if (!terminologias[nombre]) P.push(`terminología «${nombre}» no cargada (${def.archivo})`);
  return P;
}
