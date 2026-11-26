// Validación de valores y generalización (tramos). Código puro.

import {resolverValores, TIPOS_LISTA} from './diccionario.js';

/** Pasa un número a la etiqueta de su tramo. Cada «hasta» es exclusivo; el último tramo es abierto. */
export function aTramo(valor, tramos) {
  for (const t of tramos) if (!('hasta' in t) || valor < t.hasta) return t.etiqueta;
  return tramos[tramos.length - 1].etiqueta;
}

const RX_FECHA = [
  /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/,
  /\b\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}\b/,
  /\b\d{1,2}\s+de\s+[a-záéíóú]+(\s+de\s+\d{2,4})?\b/i,
  /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\s+(de\s+)?\d{4}\b/i
];

/** Si un texto parece un dato personal, devuelve qué parece; si no, null. Solo sirve para dar mejores mensajes de error. */
export function detectarPII(v) {
  const s = String(v);
  if (RX_FECHA.some(r => r.test(s))) return 'una fecha';
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(s)) return 'un correo electrónico';
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}\b/.test(s)) return 'un número de documento';
  if (/(\+?\d[\d\s\-()]{7,}\d)/.test(s)) return 'un teléfono';
  return null;
}

const vacio = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
export {vacio};

function aNumero(v, entero) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const s = v.trim().replace(',', '.');
  if (!(entero ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/).test(s)) return NaN;
  return Number(s);
}

function aLista(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim());
  if (typeof v === 'string') return v.split(';').map(x => x.trim()).filter(Boolean);
  return null;
}

function rechazo(c, v, base) {
  const pii = typeof v === 'string' || typeof v === 'number' ? detectarPII(v) : null;
  return pii ? `${c.id}: el valor parece ${pii}. No se aceptan fechas ni datos personales; cargue edades, intervalos o un código de la lista.` : `${c.id}: ${base}`;
}

/**
 * Valida un valor crudo contra su campo. Devuelve {valor} (normalizado, sin generalizar todavía) o {error}.
 * Las listas (multicategoria, localizacion, secuencia) salen como arreglos.
 */
export function validarValor(c, v, dic, terminologias, opciones = {}) {
  if (c.tipo === 'codigo') {
    if (typeof v !== 'string' || !new RegExp(c.patron).test(v)) return {error: rechazo(c, v, `código con formato inválido (se espera ${c.patron})`)};
    return {valor: v};
  }
  if (c.tipo === 'entero' || c.tipo === 'decimal') {
    const n = aNumero(v, c.tipo === 'entero');
    if (!Number.isFinite(n)) return {error: rechazo(c, v, `se espera un número${c.tipo === 'entero' ? ' entero' : ''}`)};
    if (c.rango && (n < c.rango[0] || n > c.rango[1])) return {error: `${c.id}: ${n} está fuera del rango ${c.rango[0]}–${c.rango[1]}`};
    return {valor: n};
  }
  const valores = resolverValores(c.valores, dic, terminologias, opciones);
  if (!valores || valores.length === 0) return {error: `${c.id}: la lista de valores está vacía (terminología pendiente de confirmación); deje el campo vacío`};
  if (c.tipo === 'categoria') {
    const s = typeof v === 'string' ? v.trim() : String(v);
    if (!valores.includes(s)) return {error: rechazo(c, v, `«${s}» no está en la lista de valores`)};
    return {valor: s};
  }
  if (TIPOS_LISTA.has(c.tipo)) {
    const items = aLista(v);
    if (!items) return {error: `${c.id}: se espera una lista`};
    if (items.length > c.max) return {error: `${c.id}: admite hasta ${c.max} elementos y trae ${items.length}`};
    const lados = c.lado ? resolverValores(c.lado, dic, terminologias) : null;
    for (const it of items) {
      const [base, lado, ...resto] = it.split('|');
      if (resto.length || !valores.includes(base)) return {error: rechazo(c, it, `«${it}» no está en la lista de valores`)};
      if (c.tipo === 'localizacion' && !lado) return {error: `${c.id}: «${it}» necesita el lado (región|lado)`};
      if (lado && !(lados && lados.includes(lado))) return {error: `${c.id}: lado «${lado}» inválido`};
    }
    if (c.tipo !== 'secuencia' && new Set(items).size !== items.length) return {error: `${c.id}: elementos repetidos`};
    const exclusivos = ['ninguno', 'ninguna', 'desconocido', 'desconocida', 'no_aplica'];
    if (items.length > 1 && items.some(x => exclusivos.includes(x))) return {error: `${c.id}: «ninguno», «desconocido» o «no_aplica» no se combinan con otros valores`};
    return {valor: items};
  }
  return {error: `${c.id}: tipo ${c.tipo} sin validador`};
}

/** Evalúa la condición «si» de un campo sobre la fila cruda ya validada. */
export function cumpleCondicion(si, fila) {
  const v = fila[si.campo];
  if (vacio(v)) return false;
  const arr = Array.isArray(v) ? v : [v];
  if ('en' in si) return arr.some(x => si.en.includes(x));
  if ('no_en' in si) return !arr.every(x => si.no_en.includes(x));
  if ('contiene' in si) return arr.includes(si.contiene);
  return false;
}

/** Aplica la generalización del campo (solo tramos; el colapso de raros es de todo el lote, ver kanonimato.js). */
export function generalizar(c, valor) {
  if (vacio(valor) || valor === 'no_aplica') return valor;
  if (c.transformacion?.tipo === 'tramos') return aTramo(valor, c.transformacion.tramos);
  return valor;
}
