// Protección contra el «efecto mosaico»: colapso de categorías raras y k-anonimato
// sobre los cuasi-identificadores. Opera sobre el lote completo, nunca registro por registro.
// Código puro.

const base = x => String(x).split('|')[0];
const conLado = (x, nuevo) => { const p = String(x).split('|'); p[0] = nuevo; return p.join('|'); };

/**
 * Reemplaza por «otro» los valores que tienen menos de k pacientes distintos en el lote.
 * Si después «otro» también queda con menos de k pacientes, esos valores se suprimen.
 * Los valores protegidos (desconocido, no_aplica…) no se tocan.
 * Funciona con valores sueltos y con listas; en localizacion/secuencia cuenta la parte antes de «|».
 * Devuelve el informe; modifica las filas en su lugar.
 */
export function colapsarRaros(filas, campo, {k, protegidos = [], otro = 'otro', suprimido = 'suprimido', unidad = 'codigo_paciente'}) {
  const cuenta = new Map();
  const sumar = (v, u) => { if (!cuenta.has(v)) cuenta.set(v, new Set()); cuenta.get(v).add(u); };
  for (const f of filas) {
    const v = f[campo];
    if (v === undefined || v === null || v === '') continue;
    for (const x of Array.isArray(v) ? v : [v]) sumar(base(x), f[unidad]);
  }
  const raros = new Set([...cuenta].filter(([v, s]) => s.size < k && !protegidos.includes(v) && v !== otro && v !== suprimido).map(([v]) => v));
  const pacientesOtro = new Set(cuenta.get(otro) || []);
  for (const v of raros) for (const u of cuenta.get(v)) pacientesOtro.add(u);
  if (!raros.size && (pacientesOtro.size === 0 || pacientesOtro.size >= k)) return {campo, colapsados: [], destino: null, suprimidos: 0};
  const destino = pacientesOtro.size >= k ? otro : suprimido;
  // Si «otro» no llega a k, también se suprimen los «otro» que ya venían cargados.
  const reemplazar = new Set(destino === suprimido ? [...raros, otro] : raros);
  let suprimidos = 0;
  for (const f of filas) {
    const v = f[campo];
    if (v === undefined || v === null || v === '') continue;
    const lista = Array.isArray(v) ? v : [v];
    const tocados = lista.filter(x => reemplazar.has(base(x))).length;
    if (!tocados) continue;
    if (destino === suprimido) suprimidos += tocados;
    const nuevo = [...new Set(lista.map(x => reemplazar.has(base(x)) ? conLado(x, destino) : x))];
    f[campo] = Array.isArray(v) ? nuevo : nuevo[0];
  }
  return {campo, colapsados: [...raros].map(v => ({valor: v, pacientes: cuenta.get(v).size})), destino, suprimidos};
}

const claveClase = (f, qis) => JSON.stringify(qis.map(q => f[q] ?? ''));

/** Agrupa las filas por la combinación de cuasi-identificadores. */
export function clasesEquivalencia(filas, qis) {
  const m = new Map();
  filas.forEach((f, i) => { const c = claveClase(f, qis); if (!m.has(c)) m.set(c, []); m.get(c).push(i); });
  return m;
}

/** ¿Cada combinación de cuasi-identificadores la comparten al menos k pacientes? */
export function verificarK(filas, qis, k) {
  const clases = clasesEquivalencia(filas, qis);
  const chicas = [...clases].filter(([, idx]) => idx.length < k);
  return {
    cumple: chicas.length === 0,
    clases: clases.size,
    clases_chicas: chicas.map(([c, idx]) => ({valores: Object.fromEntries(qis.map((q, i) => [q, JSON.parse(c)[i]])), n: idx.length})),
    filas_en_riesgo: chicas.reduce((s, [, idx]) => s + idx.length, 0)
  };
}

/**
 * Supresión local: recorre los cuasi-identificadores en el orden dado (el de menor valor analítico primero)
 * y los reemplaza por «suprimido» solo en las filas que siguen en clases de menos de k.
 * «suprimido» cuenta como un valor más (k-anonimato estricto): suprimir las celdas de un único paciente
 * raro no lo protege, porque queda solo en su clase. Por eso no elimina pacientes: devuelve los que
 * siguen sin k y la decisión (detener o excluir) es de quien llama, según el diccionario.
 */
export function suprimirHastaK(filas, qis, k, orden, suprimido = 'suprimido') {
  const pasos = [];
  const enRiesgo = () => [...clasesEquivalencia(filas, qis).values()].filter(idx => idx.length < k).flat();
  for (const campo of orden) {
    const idx = enRiesgo();
    if (!idx.length) break;
    let celdas = 0;
    for (const i of idx) if (filas[i][campo] !== suprimido) { filas[i][campo] = suprimido; celdas++; }
    pasos.push({campo, celdas});
  }
  const sinK = enRiesgo().sort((a, b) => a - b);
  return {pasos, cumple: sinK.length === 0, filas_sin_k: sinK.length, indices_sin_k: sinK};
}
