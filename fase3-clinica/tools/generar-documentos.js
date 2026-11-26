// Genera, a partir de diccionario/diccionario-clinico.json (la única fuente):
//   docs/diccionario-preliminar.md          tablas por categoría para leer y revisar
//   diccionario/diccionario-clinico-vX.csv  planilla para el bioestadístico (separador «;», BOM)
// Uso: node tools/generar-documentos.js   (o npm run docs)
// No editar los generados a mano: se pisan en cada corrida.

import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {aCSV} from '../src/csv.js';
import {validarDiccionario, resolverValores, seExporta} from '../src/diccionario.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = p => JSON.parse(readFileSync(join(raiz, p), 'utf8'));
const dic = leer('diccionario/diccionario-clinico.json');
const terminologias = Object.fromEntries(Object.entries(dic.terminologias).map(([k, t]) => [k, leer(join('diccionario', t.archivo))]));

const problemas = validarDiccionario(dic, terminologias);
if (problemas.length) { console.error('El diccionario tiene problemas:\n' + problemas.join('\n')); process.exit(1); }

const RIESGO = {seudonimo: 'Seudónimo', cuasi_alto: 'Alto', cuasi_medio: 'Medio', bajo: 'Bajo'};
const k = dic.parametros.k_minimo;

function valores(c) {
  if (c.derivado) return `calculado: ${c.derivado.de.join(' − ')}`;
  if (c.tipo === 'codigo') return `patrón ${c.patron}`;
  if (c.tipo === 'entero' || c.tipo === 'decimal') return `${c.tipo}${c.rango ? ` ${c.rango[0]} a ${c.rango[1]}` : ''}${c.unidad ? ` ${c.unidad}` : ''}`;
  const ref = c.valores;
  let txt;
  if (typeof ref === 'string' && ref.startsWith('terminologia:')) {
    const [p] = ref.slice(13).split('.');
    const t = terminologias[p];
    const v = resolverValores(ref, dic, terminologias);
    txt = t.estado === 'confirmada' ? `${ref} (${v.length})` : `${ref} (vacía hasta confirmar la cita; ${resolverValores(ref, dic, terminologias, {permitirProvisionales: true})?.length ?? 0} provisionales solo para pruebas)`;
  } else if (typeof ref === 'string') {
    txt = `${ref} (${resolverValores(ref, dic, terminologias).length})`;
  } else {
    txt = ref.length <= 8 ? ref.join(', ') : `${ref.slice(0, 6).join(', ')}… (${ref.length})`;
  }
  const extra = [];
  if (c.tipo === 'localizacion' || c.tipo === 'secuencia') extra.push(`cada elemento «valor|lado», lado de ${c.lado || 'lista:lado'}`);
  if (c.tipo !== 'categoria' && c.max) extra.push(`hasta ${c.max}`);
  return `${c.tipo}: ${txt}${extra.length ? '; ' + extra.join('; ') : ''}`;
}

function mitigacion(c) {
  const m = [];
  if (!seExporta(c)) m.push('No se exporta en v0.1.');
  const t = c.transformacion;
  if (t.tipo === 'tramos') m.push(`Sale en tramos: ${t.tramos.map(x => x.etiqueta).join(', ')}.`);
  if (t.tipo === 'colapsar_raros') m.push(`Valores con menos de ${k} pacientes → «${dic.parametros.valor_colapso}» (o «${dic.parametros.valor_suprimido}» si «${dic.parametros.valor_colapso}» también es chico).`);
  if (c.riesgo === 'seudonimo') m.push('Seudónimo del desidentificador EDF; la correspondencia queda en la carpeta privada.');
  if (c.cuasi_identificador) m.push(`Entra al control de k-anonimato (k = ${k}) y a la supresión local.`);
  if (c.si) m.push(`Solo se carga si ${c.si.campo} ${c.si.en ? 'es ' + c.si.en.join('/') : c.si.no_en ? 'no es ' + c.si.no_en.join('/') : 'contiene ' + c.si.contiene}; si no, «no_aplica».`);
  if (c.sensible) m.push('Dato sensible (salud mental o neurodesarrollo): minimizar.');
  if (!m.length) m.push('Se exporta tal cual (lista cerrada o número acotado).');
  return m.join(' ');
}

const filasCSV = dic.campos.map(c => ({
  campo: c.id, tabla: c.tabla, categoria: c.categoria, etiqueta: c.etiqueta, tipo: c.tipo, valores: valores(c),
  requerido: c.requerido ? 'si' : 'no', riesgo: RIESGO[c.riesgo], cuasi_identificador: c.cuasi_identificador ? 'si' : 'no',
  exporta: seExporta(c) ? 'si' : 'no', mitigacion: mitigacion(c), uso: c.uso || '', referencia: c.referencia || '',
  nota: c.nota || '', decision_pendiente: c.decision_pendiente || ''
}));
const columnasCSV = Object.keys(filasCSV[0]);
const nombreCSV = `diccionario/diccionario-clinico-v${dic.version}.csv`;
writeFileSync(join(raiz, nombreCSV), aCSV(columnasCSV, filasCSV));

const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const cuenta = r => dic.campos.filter(c => c.riesgo === r).length;
const qis = dic.campos.filter(c => c.cuasi_identificador);
const md = [];
md.push(`# Diccionario clínico preliminar · v${dic.version} (${dic.estado})`, '');
md.push(`> **${dic.aviso}**`, '');
md.push(`Generado desde \`diccionario/diccionario-clinico.json\` con \`npm run docs\`. No editar a mano. La misma información está en \`${nombreCSV}\` para revisarla en una planilla.`, '');
md.push('## Resumen', '');
md.push(`- ${dic.campos.length} campos en ${dic.categorias.length} categorías y ${Object.keys(dic.tablas).length} tablas (${Object.entries(dic.tablas).map(([t, x]) => `\`${t}\`: ${x.descripcion.replace(/\.$/, '')}`).join('; ')}).`);
md.push(`- Riesgo de reidentificación: ${cuenta('seudonimo')} seudónimos, ${cuenta('cuasi_alto')} alto, ${cuenta('cuasi_medio')} medio, ${cuenta('bajo')} bajo.`);
md.push(`- Cuasi-identificadores que entran al control de k-anonimato (k = ${k}): ${qis.filter(seExporta).map(c => `\`${c.id}\``).join(', ')}. Riesgo alto pero fuera de la salida en v0.1: ${dic.campos.filter(c => c.riesgo === 'cuasi_alto' && !seExporta(c)).map(c => `\`${c.id}\``).join(', ') || 'ninguno'}.`);
md.push(`- Orden de supresión local cuando un grupo queda con menos de ${k}: ${dic.parametros.orden_supresion.map(x => `\`${x}\``).join(' → ')}. Si aun así quedan pacientes sin k, la política es «${dic.parametros.politica_sin_k}».`);
md.push(`- Edad mínima: ${dic.parametros.edad_minima} años. ${dic.parametros.fecha_indice}`);
md.push('- No hay campos de fecha ni de texto libre: esos tipos están prohibidos en el validador.', '');
md.push('## Columnas que frenan el lote entero', '');
md.push('Si el archivo de entrada trae una columna cuyo nombre se parece a uno de estos, no se procesa nada.', '');
md.push('| Grupo | Patrón (sobre el nombre normalizado) | Motivo |', '|---|---|---|');
for (const p of dic.identificadores_prohibidos) md.push(`| ${p.id} | \`${esc(p.patron)}\` | ${esc(p.motivo)} |`);
md.push('');
const pendientes = dic.campos.filter(c => c.decision_pendiente);
md.push('## Decisiones abiertas para el bioestadístico', '');
for (const c of pendientes) md.push(`- **${c.id}**: ${c.decision_pendiente}`);
md.push('');
for (const cat of dic.categorias) {
  const campos = dic.campos.filter(c => c.categoria === cat.id);
  if (!campos.length) continue;
  md.push(`## ${cat.titulo}`, '');
  if (cat.nota) md.push(cat.nota, '');
  md.push('| Campo | Qué es | Tipo y valores | Riesgo | Mitigación | Nota |', '|---|---|---|---|---|---|');
  for (const c of campos) {
    const nota = [c.nota, c.referencia ? `Ref.: ${c.referencia}` : '', c.decision_pendiente ? `**Pendiente:** ${c.decision_pendiente}` : ''].filter(Boolean).join(' ');
    md.push(`| \`${c.id}\`${c.requerido ? ' *' : ''} | ${esc(c.etiqueta)} | ${esc(valores(c))} | ${RIESGO[c.riesgo]}${c.cuasi_identificador ? ' (CI)' : ''} | ${esc(mitigacion(c))} | ${esc(nota)} |`);
  }
  md.push('');
}
md.push('`*` obligatorio · CI = cuasi-identificador', '');
md.push('## Listas cerradas', '');
for (const [nombre, v] of Object.entries(dic.listas)) md.push(`- **${nombre}** (${v.length}): ${v.join(', ')}`);
md.push('');
md.push('## Terminologías', '');
for (const [nombre, t] of Object.entries(terminologias)) {
  md.push(`- **${nombre}** · estado «${t.estado}». ${t.aviso || ''}`.trim());
  for (const cand of t.candidatas_verificadas_en_pubmed || []) md.push(`  - candidata: ${cand.cita} doi:${cand.doi} (PMID ${cand.pmid}). ${cand.comentario || ''}`.trim());
}
md.push('');
writeFileSync(join(raiz, 'docs/diccionario-preliminar.md'), md.join('\n'));
console.log(`Listo: docs/diccionario-preliminar.md y ${nombreCSV} (${dic.campos.length} campos).`);
