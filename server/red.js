// Red de puntas de NeuroVisor (v3.7), del lado del servidor.
// Es la MISMA cuenta que corría en el navegador (src/spikenet.js de la v3.11), copiada sin cambios para que el resultado
// sea idéntico. Los PESOS no están en este archivo ni en el repositorio: se guardan en la base D1 y se suben desde la
// página de administración. Sin pesos, este código no detecta nada.
// Entrada: 19 canales 10-20 (orden TEN20) ya preparados por el visor (referencia promedio, 1-35 Hz, 128 Hz, divididos
// por la escala del estudio y recortados a ±30). Salida: un logit cada 4 muestras (1/32 s) y el canal donde se ve.
const SN = { stride: 4, off: 50.5 };
export const SN_SHAPES = [["a1w", [8, 1, 1, 7]], ["a1b", [8]], ["a2w", [8, 8, 1, 5]], ["a2b", [8]], ["a3w", [16, 8, 1, 5]], ["a3b", [16]], ["bw", [32, 16, 19, 1]], ["bb", [32]], ["c1w", [32, 32, 11]], ["c1b", [32]], ["c2w", [32, 32, 11]], ["c2b", [32]], ["dw", [1, 32, 1]], ["db", [1]]];

export function snLoad(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4), W = {};
  let o = 0;
  for (const [k, sh] of SN_SHAPES) {
    const n = sh.reduce((a, b) => a * b, 1);
    W[k] = f.slice(o, o + n);
    o += n;
  }
  if (o !== f.length) throw Error("pesos de la red: tamaño inesperado");
  return W;
}
function snConv(X, nIn, L, w, bias, nOut, k) {
  // convolución válida + ReLU; 4 muestras de salida a la vez (el doble de rápido que la forma directa)
  const Lo = Math.max(0, L - k + 1), Y = new Float32Array(nOut * Lo), K = nIn * k;
  for (let o = 0; o < nOut; o++) {
    const yo = o * Lo, wo = o * K, b = bias[o];
    let i = 0;
    for (; i + 3 < Lo; i += 4) {
      let s0 = b, s1 = b, s2 = b, s3 = b;
      for (let c = 0; c < nIn; c++) {
        const xb = c * L + i, wb = wo + c * k;
        for (let t = 0; t < k; t++) {
          const wv = w[wb + t], p = xb + t;
          s0 += wv * X[p];
          s1 += wv * X[p + 1];
          s2 += wv * X[p + 2];
          s3 += wv * X[p + 3];
        }
      }
      Y[yo + i] = s0 > 0 ? s0 : 0;
      Y[yo + i + 1] = s1 > 0 ? s1 : 0;
      Y[yo + i + 2] = s2 > 0 ? s2 : 0;
      Y[yo + i + 3] = s3 > 0 ? s3 : 0;
    }
    for (; i < Lo; i++) {
      let s = b;
      for (let c = 0; c < nIn; c++) for (let t = 0; t < k; t++) s += w[wo + c * k + t] * X[c * L + i + t];
      Y[yo + i] = s > 0 ? s : 0;
    }
  }
  return [Y, Lo];
}
function snPool(X, nC, L) {
  const Lo = L >> 1, Y = new Float32Array(nC * Lo);
  for (let c = 0; c < nC; c++) for (let i = 0; i < Lo; i++) Y[c * Lo + i] = Math.max(X[c * L + 2 * i], X[c * L + 2 * i + 1]);
  return [Y, Lo];
}
export function snForward(X, W) {
  const L = X[0].length, A = [];
  let La = 0;
  for (let c = 0; c < 19; c++) {
    let [y, l] = snConv(X[c], 1, L, W.a1w, W.a1b, 8, 7);
    [y, l] = snConv(y, 8, l, W.a2w, W.a2b, 8, 5);
    [y, l] = snPool(y, 8, l);
    [y, l] = snConv(y, 8, l, W.a3w, W.a3b, 16, 5);
    [y, l] = snPool(y, 16, l);
    A.push(y);
    La = l;
  }
  if (La <= 20) return new Float32Array(0);
  // espacial: 32 × (16 rasgos × 19 canales), como una convolución de 1 muestra sobre 304 entradas (rasgo h, canal c → h·19 + c)
  const Ac = new Float32Array(304 * La);
  for (let c = 0; c < 19; c++) for (let h = 0; h < 16; h++) Ac.set(A[c].subarray(h * La, (h + 1) * La), (h * 19 + c) * La);
  const [B] = snConv(Ac, 304, La, W.bw, W.bb, 32, 1);
  let [y, l] = snConv(B, 32, La, W.c1w, W.c1b, 32, 11);
  [y, l] = snConv(y, 32, l, W.c2w, W.c2b, 32, 11);
  const out = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    let s = W.db[0];
    for (let c = 0; c < 32; c++) s += W.dw[c] * y[c * l + i];
    out[i] = s;
  }
  return out;
}
export function snChanOf(X, nz) {
  const ch = new Int8Array(nz);
  for (let j = 0; j < nz; j++) {
    const m = Math.floor(SN.stride * j + SN.off);
    let bc = 0, bv = 0;
    for (let c = 0; c < 19; c++) for (let k = Math.max(0, m - 6); k <= Math.min(X[c].length - 1, m + 6); k++) if (Math.abs(X[c][k]) > Math.abs(bv)) (bv = X[c][k]), (bc = c);
    ch[j] = bv < 0 ? -(bc + 1) : bc + 1;
  }
  return ch;
}
