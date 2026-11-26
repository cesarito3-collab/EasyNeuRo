import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cargar, copia} from './cargar.js';
import {estadoPuerta, exigirPuerta} from '../src/puerta.js';

const base = cargar();

test('hoy faltan los tres requisitos', () => {
  const e = estadoPuerta(base.config, base.diccionario, base.terminologias);
  assert.equal(e.lista, false);
  assert.deepEqual(e.faltan, ['cei', 'bioestadistica', 'cita_semiologia']);
});

test('el modo real se niega y explica qué falta', () => {
  assert.throws(() => exigirPuerta({modo: 'real', ...base, pacientes: []}), /todavía no puede usarse con datos reales[\s\S]*comité de ética[\s\S]*bioestadístico[\s\S]*semiología/);
});

test('llenar la configuración no alcanza si el diccionario sigue en borrador y la terminología sin confirmar', () => {
  const config = {
    aprobacion_cei: {comite: 'CEI de prueba', numero_dictamen: '0', fecha_dictamen: '2027-01-01', incluye_datos_clinicos_fase3: true},
    diccionario_validado: {bioestadistico: 'Prueba', version_validada: base.diccionario.version},
    cita_semiologia: {doi: '10.1002/epd2.70110', confirmada_por_investigador: true}
  };
  const e = estadoPuerta(config, base.diccionario, base.terminologias);
  assert.deepEqual(e.faltan, ['bioestadistica', 'cita_semiologia']);
});

test('con los tres requisitos cumplidos la puerta se abre', () => {
  const dic = copia(base.diccionario); dic.estado = 'validado';
  const t = copia(base.terminologias);
  for (const p of Object.values(t)) { p.estado = 'confirmada'; p.referencia_confirmada.doi = '10.1002/epd2.70110'; }
  t.semiologia.descriptores = ['descriptor_de_prueba'];
  const config = {
    aprobacion_cei: {comite: 'CEI de prueba', numero_dictamen: '0', fecha_dictamen: '2027-01-01', incluye_datos_clinicos_fase3: true},
    diccionario_validado: {bioestadistico: 'Prueba', version_validada: dic.version},
    cita_semiologia: {doi: '10.1002/EPD2.70110', confirmada_por_investigador: true}
  };
  assert.equal(estadoPuerta(config, dic, t).lista, true);
});

test('el modo de prueba rechaza registros que no están marcados como inventados', () => {
  assert.throws(() => exigirPuerta({modo: 'sintetico', ...base, pacientes: [{_sintetico: true}, {paciente: {}}]}), /no están marcados como inventados/);
});
