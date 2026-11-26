import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cargar, copia} from './cargar.js';
import {convertir} from '../src/conversor.js';
import {tablasACSV} from '../src/csv.js';
import {pacientesSinteticos} from './fixtures/sinteticos.js';

const base = cargar();
const correr = (pacientes, extra = {}) => convertir({...base, pacientes, modo: 'sintetico', ...extra});

test('40 pacientes inventados se convierten sin errores', () => {
  const r = correr(pacientesSinteticos(40));
  assert.equal(r.ok, true, JSON.stringify(r.errores?.slice(0, 5), null, 1));
  assert.equal(r.tablas.paciente.filas.length, 40);
  assert.equal(r.tablas.estudio.filas.length, 40);
  assert.equal(r.informe_publico.cumple_k, true);
  assert.match(r.sello.aviso, /DATOS INVENTADOS/);
});

test('la salida no trae edades exactas ni columnas fuera del diccionario', () => {
  const r = correr(pacientesSinteticos(40));
  const ids = new Set(base.diccionario.campos.map(c => c.id));
  for (const t of Object.values(r.tablas)) for (const c of t.columnas) assert.ok(ids.has(c), c);
  for (const f of r.tablas.paciente.filas) assert.match(f.edad_eeg_indice, /^(\d\d-\d\d|90\+|suprimido)$/);
  assert.ok(!r.tablas.farmaco.columnas.includes('farmaco_dosis_mg_dia'), 'la dosis no se exporta en v0.1');
});

test('los síndromes y fármacos raros no salen con su nombre', () => {
  const r = correr(pacientesSinteticos(40));
  const sind = r.tablas.paciente.filas.map(f => f.sindrome_epileptico);
  assert.ok(!sind.includes('sindrome_de_rasmussen'));
  assert.ok(!sind.includes('epilepsia_hipermotora_relacionada_con_el_sueno'));
  const farm = r.tablas.farmaco.filas.map(f => f.farmaco);
  assert.ok(!farm.includes('cenobamato') && !farm.includes('fenfluramina'));
  assert.ok(!r.tablas.paciente.filas.some(f => f.cirugia === 'desconexion_o_hemisferotomia'));
});

test('el informe público solo trae cantidades; los valores raros van al privado', () => {
  const r = correr(pacientesSinteticos(40));
  assert.ok(!JSON.stringify(r.informe_publico).includes('rasmussen'));
  assert.ok(JSON.stringify(r.informe_privado).includes('rasmussen'));
});

test('una columna DNI o Fecha de nacimiento frena todo el lote', () => {
  const p = pacientesSinteticos(6);
  p[3].paciente.DNI = '25123456';
  const r = correr(p);
  assert.equal(r.ok, false);
  assert.equal(r.tablas, undefined);
  assert.match(r.errores[0].mensaje, /parece un identificador \(documento\)/);
  const q = pacientesSinteticos(6);
  q[0].crisis[0]['Fecha de la crisis'] = '2024-03-01';
  assert.match(correr(q).errores[0].mensaje, /identificador \(fechas\)/);
});

test('una fecha escrita en un campo de lista se rechaza con un mensaje claro', () => {
  const p = pacientesSinteticos(6);
  p[0].paciente.tec_previo = '12/05/2019';
  const r = correr(p);
  assert.equal(r.ok, false);
  assert.match(r.errores[0].mensaje, /parece una fecha/);
});

test('campos condicionales: sin crisis febriles no se carga su tipo', () => {
  const p = pacientesSinteticos(6);
  p[0].paciente.crisis_febriles = 'no';
  p[0].paciente.crisis_febriles_tipo = 'simples';
  assert.match(correr(p).errores.map(e => e.mensaje).join('\n'), /crisis_febriles_tipo solo se carga si crisis_febriles/);
});

test('reglas cruzadas: inicio posterior a la edad actual y código de estudio ajeno', () => {
  const p = pacientesSinteticos(6);
  p[0].paciente.edad_inicio_epilepsia = 99;
  p[1].estudios[0].codigo_estudio = 'PRUEBA-0999-01';
  const m = correr(p).errores.map(e => e.mensaje).join('\n');
  assert.match(m, /edad de inicio no puede ser mayor/);
  assert.match(m, /debe empezar con el código del paciente/);
});

test('el modo real está bloqueado aunque los datos sean válidos', () => {
  assert.throws(() => convertir({...base, pacientes: pacientesSinteticos(6).map(({_sintetico, ...x}) => x), modo: 'real'}), /todavía no puede usarse con datos reales/);
});

test('el CSV usa las convenciones del desidentificador EDF y marca SINTETICO en el nombre', () => {
  const r = correr(pacientesSinteticos(40));
  const archivos = tablasACSV(r);
  assert.deepEqual(Object.keys(archivos).sort(), ['SINTETICO_clinico_crisis.csv', 'SINTETICO_clinico_estudio.csv', 'SINTETICO_clinico_farmaco.csv', 'SINTETICO_clinico_paciente.csv']);
  const txt = archivos['SINTETICO_clinico_paciente.csv'];
  assert.ok(txt.startsWith('﻿codigo_paciente;edad_eeg_indice;sexo;'));
});

test('el lote mínimo realista (k = 5 con 15 pacientes) se protege suprimiendo, no inventando', () => {
  const r = correr(pacientesSinteticos(15, 7));
  assert.equal(r.ok, true);
  assert.equal(r.informe_publico.cumple_k, true);
  assert.ok(r.informe_publico.celdas_suprimidas > 0);
});

// Lote armado a propósito: 25 pacientes con la misma combinación de cuasi-identificadores
// y 2 pacientes distintos que no tienen con quién agruparse.
function loteConDosSueltos() {
  const molde = JSON.stringify(pacientesSinteticos(1)[0]);
  const clones = Array.from({length: 25}, (_, i) => JSON.parse(molde.replaceAll('PRUEBA-0001', `PRUEBA-${String(1001 + i)}`)));
  return [...clones, ...pacientesSinteticos(3).slice(1, 3)];
}
const conPolitica = politica => { const d = copia(base.diccionario); d.parametros.politica_sin_k = politica; return d; };

test('por defecto («detener») no se genera salida si algún paciente queda sin k', () => {
  const r = correr(loteConDosSueltos());
  assert.equal(r.ok, false);
  assert.equal(r.tablas, undefined);
  assert.match(r.errores[0].mensaje, /2 paciente\(s\) siguen en combinaciones de menos de 5/);
  assert.equal(r.informe_privado.supresion.filas_sin_k, 2);
});

test('con «excluir» salen los pacientes protegidos y los dos sueltos quedan afuera de todas las tablas', () => {
  const r = correr(loteConDosSueltos(), {diccionario: conPolitica('excluir')});
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.informe_publico.pacientes, 25);
  assert.equal(r.informe_publico.pacientes_excluidos_por_k, 2);
  for (const t of Object.values(r.tablas)) for (const f of t.filas) assert.ok(!['PRUEBA-0002', 'PRUEBA-0003'].includes(f.codigo_paciente));
  assert.ok(!JSON.stringify(r.informe_publico).includes('PRUEBA-0002'), 'el informe público no nombra a los excluidos');
});

test('un lote con menos de k pacientes nunca produce salida', () => {
  assert.equal(correr(pacientesSinteticos(4)).ok, false);
  const r = correr(pacientesSinteticos(4), {diccionario: conPolitica('excluir')});
  assert.equal(r.ok, false);
  assert.match(r.errores[0].mensaje, /deja el lote vacío/);
});
