import {test} from 'node:test';
import assert from 'node:assert/strict';
import {colapsarRaros, verificarK, suprimirHastaK} from '../src/kanonimato.js';
import {aTramo, detectarPII} from '../src/transformar.js';

const filas = (vals, campo = 'x') => vals.map((v, i) => ({codigo_paciente: 'P' + i, [campo]: v}));

test('tramos: «hasta» es exclusivo y el último es abierto', () => {
  const t = [{hasta: 30, etiqueta: '18-29'}, {hasta: 40, etiqueta: '30-39'}, {etiqueta: '40+'}];
  assert.equal(aTramo(29, t), '18-29');
  assert.equal(aTramo(30, t), '30-39');
  assert.equal(aTramo(97, t), '40+');
});

test('valores con menos de k pacientes pasan a «otro»', () => {
  const f = filas(['a', 'a', 'a', 'b', 'b', 'b', 'c', 'd', 'e']);
  const r = colapsarRaros(f, 'x', {k: 3});
  assert.equal(r.destino, 'otro');
  assert.deepEqual(f.map(x => x.x), ['a', 'a', 'a', 'b', 'b', 'b', 'otro', 'otro', 'otro']);
});

test('si «otro» tampoco llega a k, se suprime', () => {
  const f = filas(['a', 'a', 'a', 'c', 'desconocido']);
  const r = colapsarRaros(f, 'x', {k: 3, protegidos: ['desconocido']});
  assert.equal(r.destino, 'suprimido');
  assert.deepEqual(f.map(x => x.x), ['a', 'a', 'a', 'suprimido', 'desconocido']);
});

test('en listas con lado se cuenta el descriptor y se conserva el lado', () => {
  const f = filas([['raro|izquierdo', 'comun'], ['comun'], ['comun'], ['otro_raro|derecho'], ['tercero']]);
  colapsarRaros(f, 'x', {k: 3});
  assert.deepEqual(f[0].x, ['otro|izquierdo', 'comun']);
  assert.deepEqual(f[3].x, ['otro|derecho']);
});

test('k-anonimato: cinco combinaciones únicas se protegen entre sí con supresión local', () => {
  const f = [];
  for (let i = 0; i < 6; i++) f.push({sexo: 'F', edad: '30-39', sindrome: 'mtle'});
  for (let i = 0; i < 6; i++) f.push({sexo: 'M', edad: '30-39', sindrome: 'mtle'});
  ['a', 'b', 'c', 'd', 'e'].forEach(s => f.push({sexo: 'F', edad: '30-39', sindrome: s}));
  const qis = ['sexo', 'edad', 'sindrome'];
  assert.equal(verificarK(f, qis, 5).cumple, false);
  const s = suprimirHastaK(f, qis, 5, ['sindrome', 'sexo', 'edad']);
  assert.equal(s.cumple, true);
  assert.deepEqual(f.slice(12).map(x => x.sindrome), Array(5).fill('suprimido'));
  assert.equal(f[12].sexo, 'F', 'solo se suprime lo necesario');
});

test('k-anonimato: un único paciente raro NO se protege suprimiendo sus propias celdas', () => {
  const f = [];
  for (let i = 0; i < 12; i++) f.push({sexo: i % 2 ? 'M' : 'F', edad: '30-39', sindrome: 'mtle'});
  f.push({sexo: 'F', edad: '30-39', sindrome: 'rasmussen'});
  const s = suprimirHastaK(f, ['sexo', 'edad', 'sindrome'], 5, ['sindrome', 'sexo', 'edad']);
  assert.equal(s.cumple, false);
  assert.deepEqual(s.indices_sin_k, [12]);
});

test('detectarPII reconoce fechas, documentos y correos', () => {
  assert.equal(detectarPII('12/05/1961'), 'una fecha');
  assert.equal(detectarPII('3 de marzo de 2019'), 'una fecha');
  assert.equal(detectarPII('25.123.456'), 'un número de documento');
  assert.equal(detectarPII('ana@ejemplo.com'), 'un correo electrónico');
  assert.equal(detectarPII('esclerosis_hipocampal'), null);
});
