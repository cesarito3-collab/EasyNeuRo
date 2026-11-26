// Carga el diccionario y las terminologías desde disco (solo para las pruebas en Node).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = p => JSON.parse(readFileSync(join(raiz, p), 'utf8'));

export function cargar() {
  const diccionario = leer('diccionario/diccionario-clinico.json');
  const terminologias = Object.fromEntries(Object.entries(diccionario.terminologias).map(([k, v]) => [k, leer(join('diccionario', v.archivo))]));
  const config = leer('config/fase3.config.ejemplo.json');
  return {diccionario, terminologias, config};
}
export const copia = x => JSON.parse(JSON.stringify(x));
