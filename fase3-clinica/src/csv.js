// CSV con las mismas convenciones que el desidentificador EDF: separador «;», BOM para Excel,
// y protección contra fórmulas (una celda que empieza con = + - @ se antepone con ').
// Código puro.

const SEGURO = v => /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
export function celda(v) { v = v === null || v === undefined ? '' : SEGURO(String(v)); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
export function aCSV(columnas, filas) { return '﻿' + [columnas.join(';'), ...filas.map(f => columnas.map(c => celda(f[c])).join(';'))].join('\r\n') + '\r\n'; }

/** Convierte el resultado de convertir() en {nombre de archivo: contenido}. Los nombres llevan SINTETICO_ en modo de prueba. */
export function tablasACSV(resultado) {
  const pre = resultado.sello.modo === 'sintetico' ? 'SINTETICO_' : '';
  return Object.fromEntries(Object.entries(resultado.tablas).map(([t, x]) => [`${pre}clinico_${t}.csv`, aCSV(x.columnas, x.filas)]));
}
