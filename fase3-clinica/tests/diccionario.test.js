import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cargar, copia} from './cargar.js';
import {validarDiccionario, claveProhibida, resolverValores, cuasiIdentificadores} from '../src/diccionario.js';

const {diccionario, terminologias} = cargar();

test('el diccionario v0.1 está bien formado', () => {
  assert.deepEqual(validarDiccionario(diccionario, terminologias), []);
});

test('ningún campo del diccionario se llama como un identificador prohibido', () => {
  for (const c of diccionario.campos) assert.equal(claveProhibida(c.id, diccionario), null, c.id);
});

test('las columnas de identificación se reconocen aunque vengan escritas distinto', () => {
  for (const k of ['Apellido y Nombre', 'DNI', 'N° HC', 'Historia Clínica', 'Teléfono', 'e-mail', 'Domicilio', 'Fecha de nacimiento', 'C.I.', 'Médico derivante', 'Observaciones'])
    assert.ok(claveProhibida(k, diccionario), k);
});

test('no se aceptan tipos fecha ni texto libre', () => {
  const d = copia(diccionario);
  d.campos.push({id: 'dia_cirugia', tabla: 'paciente', categoria: 'seeg_cirugia', tipo: 'fecha', riesgo: 'bajo', transformacion: {tipo: 'ninguna'}});
  d.campos.push({id: 'relato', tabla: 'crisis', categoria: 'semiologia', tipo: 'texto_libre', riesgo: 'bajo', transformacion: {tipo: 'ninguna'}});
  const p = validarDiccionario(d, terminologias).join('\n');
  assert.match(p, /dia_cirugia: el tipo «fecha» está prohibido/);
  assert.match(p, /relato: el tipo «texto_libre» está prohibido/);
});

test('un número de riesgo medio o alto tiene que ir en tramos', () => {
  const d = copia(diccionario);
  d.campos.find(c => c.id === 'edad_eeg_indice').transformacion = {tipo: 'ninguna'};
  assert.match(validarDiccionario(d, terminologias).join('\n'), /edad_eeg_indice: un número con riesgo «cuasi_alto» debe agruparse/);
});

test('la terminología de semiología sigue pendiente: lista vacía salvo en modo de prueba', () => {
  assert.equal(terminologias.semiologia.estado, 'pendiente_confirmacion');
  assert.deepEqual(resolverValores('terminologia:semiologia.descriptores', diccionario, terminologias), []);
  assert.ok(resolverValores('terminologia:semiologia.descriptores', diccionario, terminologias, {permitirProvisionales: true}).length > 0);
});

test('los cuasi-identificadores exportados coinciden con el orden de supresión', () => {
  assert.deepEqual(new Set(cuasiIdentificadores(diccionario)), new Set(diccionario.parametros.orden_supresion));
});
