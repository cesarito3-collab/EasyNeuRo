// Prueba del servidor sin internet: base D1 imitada con SQLite y la red con los pesos reales.
// uso: node server/pruebas/probar-servidor.mjs <spikenet-w.js> [<spikenet.js de la v3.11 para comparar>]
// Los pesos NO están en el repositorio: se pasan desde la copia local del visor.
import fs from "node:fs";
import vm from "node:vm";
import { d1Local } from "./d1-local.mjs";
import worker from "../index.js";

const [wFile, refFile] = process.argv.slice(2);
if (!wFile) throw Error("falta el archivo de pesos");
const env = { DB: d1Local(), ENTORNO: "prueba" };
const BASE = "https://prueba.local";
let fallas = 0, pasos = 0;
const ok = (cond, txt) => { pasos++; if (!cond) { fallas++; console.log("  FALLA:", txt); } else console.log("  ok:", txt); };
async function pedir(path, { method = "GET", body, token, admin, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = "Bearer " + token;
  if (admin) h["X-Admin-Clave"] = admin;
  if (body && !(body instanceof ArrayBuffer) && typeof body !== "string") { h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  if (body instanceof ArrayBuffer) h["Content-Length"] = String(body.byteLength);
  const r = await worker.fetch(new Request(BASE + path, { method, headers: h, body }), env);
  const ct = r.headers.get("Content-Type") || "";
  return { r, j: ct.includes("json") ? await r.json() : null, buf: ct.includes("octet") ? await r.arrayBuffer() : null };
}
function tramo(X) {
  const L = X[0].length, buf = new ArrayBuffer(12 + 19 * L * 4), dv = new DataView(buf);
  dv.setUint32(0, 0x4e565231, false);
  dv.setUint32(4, 19, true);
  dv.setUint32(8, L, true);
  const f = new Float32Array(buf, 12);
  X.forEach((x, c) => f.set(x, c * L));
  return buf;
}
function leerZ(buf) {
  const dv = new DataView(buf), nz = dv.getUint32(4, true);
  return { magic: dv.getUint32(0, false), thr: { baja: dv.getFloat32(8, true), media: dv.getFloat32(12, true), alta: dv.getFloat32(16, true) }, z: new Float32Array(buf, 20, nz), ch: new Int8Array(buf, 20 + 4 * nz, nz) };
}
// EEG preparado de juguete: ruido + algunas puntas (solo para la mecánica; la paridad numérica va aparte)
function juguete(seg, semilla = 1) {
  let s = semilla;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5;
  const L = Math.round(seg * 128);
  return Array.from({ length: 19 }, (_, c) => {
    const x = new Float32Array(L);
    for (let i = 0; i < L; i++) x[i] = 1.2 * rnd() + 0.6 * Math.sin((2 * Math.PI * 10 * i) / 128 + c);
    for (let t = 3; t < seg - 1; t += 4.3) { const i0 = Math.round(t * 128); for (let k = -6; k <= 6; k++) if (i0 + k < L && c >= 7 && c <= 13) x[i0 + k] -= 9 * Math.exp(-(k * k) / 6); }
    return x;
  });
}

console.log("1. salud y base");
let q = await pedir("/api/salud");
ok(q.r.status === 200 && q.j.ok, "GET /api/salud responde");
q = await pedir("/api/admin/estado", { admin: "x" });
ok(q.r.status === 503 && q.j.codigo === "sin_admin", "sin clave de administrador configurada → 503");
q = await pedir("/api/entrar", { method: "OPTIONS", headers: { Origin: "null", "Access-Control-Request-Method": "POST" } });
ok(q.r.status === 204 && q.r.headers.get("Access-Control-Allow-Origin") === "*", "CORS abierto para el visor (incluso abierto desde un archivo)");
q = await pedir("/api/admin/estado", { method: "OPTIONS" });
ok(!q.r.headers.get("Access-Control-Allow-Origin"), "la administración NO acepta pedidos de otros sitios");

console.log("2. clave de administrador (como la siembra el instalador)");
const ADM = "ADM-PRUEBA-1234-5678";
const { createHash } = await import("node:crypto");
env.DB._db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('admin_hash', ?)").run(createHash("sha256").update("admin:" + ADM).digest("hex"));
q = await pedir("/api/admin/estado", { admin: "mala" });
ok(q.r.status === 401, "clave de administrador equivocada → 401");
q = await pedir("/api/admin/estado", { admin: ADM });
ok(q.r.status === 200 && q.j.modelo.cargado === false, "estado: la red todavía no está cargada");

console.log("3. cargar la red (archivo spikenet-w.js tal cual)");
q = await pedir("/api/admin/modelo", { method: "PUT", admin: ADM, body: "const SN_W64 = \"AAAA\"; SN_THR = { baja: 0.8, media: 0.7, alta: 0.3 };" });
ok(q.r.status === 400, "pesos de otro tamaño → rechazados");
q = await pedir("/api/admin/modelo", { method: "PUT", admin: ADM, body: fs.readFileSync(wFile, "utf8") });
ok(q.r.status === 200 && q.j.umbrales.media === 0.706, `red cargada (versión ${q.j?.ver}, ${q.j?.bytes} caracteres en ${Math.ceil((q.j?.bytes || 0) / 90000)} partes)`);

console.log("4. cuentas");
q = await pedir("/api/admin/cuentas", { method: "POST", admin: ADM, body: { email: "Lite@Ejemplo.com", nombre: "Dra. Lite", plan: "lite" } });
ok(q.r.status === 200 && /^NV-[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(q.j.codigo), "cuenta Lite creada, código " + q.j?.codigo);
const codLite = q.j.codigo;
q = await pedir("/api/admin/cuentas", { method: "POST", admin: ADM, body: { email: "pro@ejemplo.com", nombre: "Dr. Pro", plan: "pro", vence: "2099-12-31", max_equipos: 2, limite_horas_dia: 1 } });
const codPro = q.j.codigo;
ok(q.r.status === 200, "cuenta PRO creada (vence 2099, 2 equipos, 1 h por día)");
q = await pedir("/api/admin/cuentas", { method: "POST", admin: ADM, body: { email: "pro@ejemplo.com", plan: "pro" } });
ok(q.r.status === 409, "correo repetido → rechazado");
q = await pedir("/api/admin/cuentas", { method: "POST", admin: ADM, body: { email: "no-es-correo", plan: "pro" } });
ok(q.r.status === 400, "correo inválido → rechazado");

console.log("5. entrar");
q = await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: "NV-0000-0000-0000-0000" } });
ok(q.r.status === 401 && q.j.msg === "Correo o código incorrecto.", "código equivocado → 401");
q = await pedir("/api/entrar", { method: "POST", body: { email: "nadie@ejemplo.com", codigo: codPro } });
ok(q.r.status === 401 && q.j.msg === "Correo o código incorrecto.", "correo sin cuenta → el mismo mensaje (no revela qué correos existen)");
q = await pedir("/api/entrar", { method: "POST", body: { email: " PRO@ejemplo.com ", codigo: codPro.toLowerCase().replace(/-/g, " "), equipo: "PC consultorio" } });
ok(q.r.status === 200 && q.j.cuenta.plan === "pro", "entra con mayúsculas/espacios distintos; plan PRO");
const tPro1 = q.j.token;
q = await pedir("/api/entrar", { method: "POST", body: { email: "lite@ejemplo.com", codigo: codLite } });
const tLite = q.j.token;
ok(q.r.status === 200 && q.j.cuenta.plan === "lite", "cuenta Lite entra; plan Lite");
q = await pedir("/api/yo", { token: tPro1 });
ok(q.r.status === 200 && q.j.cuenta.email === "pro@ejemplo.com", "GET /api/yo con la sesión");
q = await pedir("/api/yo", { token: tPro1.slice(0, -2) + (tPro1.endsWith("A") ? "BB" : "AA") });
ok(q.r.status === 401, "token alterado → 401");

console.log("6. la red");
const X = juguete(64);
q = await pedir("/api/red", { method: "POST", token: tLite, body: tramo(X) });
ok(q.r.status === 403 && q.j.codigo === "no_pro", "cuenta Lite no puede usar la red → 403");
q = await pedir("/api/red", { method: "POST", body: tramo(X) });
ok(q.r.status === 401, "sin sesión → 401");
let t0 = performance.now();
q = await pedir("/api/red", { method: "POST", token: tPro1, body: tramo(X) });
const ms = performance.now() - t0;
ok(q.r.status === 200 && q.buf, `cuenta PRO: la red responde (${ms.toFixed(0)} ms para 64 s de EEG, ${(tramo(X).byteLength / 1024).toFixed(0)} KB enviados)`);
const Z = leerZ(q.buf);
ok(Z.magic === 0x4e565a31 && Math.abs(Z.thr.media - 0.706) < 1e-6, "respuesta con los umbrales de la red");
if (refFile) {
  const ctx = { Math, Float32Array, Float64Array, Int8Array, Uint8Array, Buffer, atob };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(refFile, "utf8").replace(/^const SN = /m, "var SN = ") + "\nthis.snLoad=snLoad;this.snForward=snForward;this.snChanOf=snChanOf;", ctx);
  const W = ctx.snLoad(/SN_W64\s*=\s*"([^"]+)"/.exec(fs.readFileSync(wFile, "utf8"))[1]);
  const z0 = ctx.snForward(X, W), ch0 = ctx.snChanOf(X, z0.length);
  let dz = 0, dch = 0;
  for (let i = 0; i < z0.length; i++) (dz = Math.max(dz, Math.abs(z0[i] - Z.z[i]))), (dch += ch0[i] !== Z.ch[i] ? 1 : 0);
  ok(z0.length === Z.z.length && dz === 0 && dch === 0, `idéntico a la red de la v3.11 en el navegador (${z0.length} salidas, diferencia máxima ${dz})`);
}
q = await pedir("/api/red", { method: "POST", token: tPro1, body: new ArrayBuffer(40) });
ok(q.r.status === 400, "datos con formato malo → 400");
const bad = tramo(X); new Float32Array(bad, 12)[5] = NaN;
q = await pedir("/api/red", { method: "POST", token: tPro1, body: bad });
ok(q.r.status === 200, "un valor NaN no rompe el servidor");

console.log("7. límite de horas por día (1 h)");
let n = 0;
for (; n < 80; n++) { q = await pedir("/api/red", { method: "POST", token: tPro1, body: tramo(juguete(64, n + 2)) }); if (q.r.status !== 200) break; }
ok(q.r.status === 429 && q.j.codigo === "cupo", `después de ${n + 2} tramos de 64 s (~${((n + 2) * 64 / 3600).toFixed(2)} h) → 429 «${q.j?.msg}»`);
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { limite_horas_dia: 24 } });
q = await pedir("/api/red", { method: "POST", token: tPro1, body: tramo(X) });
ok(q.r.status === 200, "el administrador sube el límite y vuelve a andar");

console.log("8. equipos (máximo 2)");
const tPro2 = (await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: codPro, equipo: "notebook" } })).j.token;
const tPro3 = (await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: codPro, equipo: "tablet" } })).j.token;
ok((await pedir("/api/yo", { token: tPro1 })).r.status === 401, "al entrar en un 3.er equipo se cierra el más viejo");
ok((await pedir("/api/yo", { token: tPro2 })).r.status === 200 && (await pedir("/api/yo", { token: tPro3 })).r.status === 200, "los 2 más nuevos siguen");

console.log("9. el administrador manda (se revisa en cada uso)");
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { plan: "lite" } });
q = await pedir("/api/red", { method: "POST", token: tPro2, body: tramo(X) });
ok(q.r.status === 403, "pasado a Lite → la red deja de andar en el acto");
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { plan: "pro", vence: "2020-01-01" } });
q = await pedir("/api/red", { method: "POST", token: tPro2, body: tramo(X) });
ok(q.r.status === 403 && /venció/.test(q.j.msg), "PRO vencido → «Su plan PRO venció»");
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { vence: "" } });
ok((await pedir("/api/red", { method: "POST", token: tPro2, body: tramo(X) })).r.status === 200, "PRO sin vencimiento → anda");
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { activa: false } });
q = await pedir("/api/yo", { token: tPro3 });
ok(q.r.status === 403 && q.j.codigo === "desactivada", "desactivada → sus sesiones dejan de valer y el médico ve «cuenta desactivada»");
q = await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: codPro } });
ok(q.r.status === 403 && q.j.codigo === "desactivada", "desactivada → no puede entrar");
await pedir("/api/admin/cuentas/2", { method: "POST", admin: ADM, body: { activa: true } });
q = await pedir("/api/admin/cuentas/2/codigo", { method: "POST", admin: ADM });
const codPro2 = q.j.codigo;
ok((await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: codPro } })).r.status === 401, "código nuevo → el viejo ya no sirve");
const tPro4 = (await pedir("/api/entrar", { method: "POST", body: { email: "pro@ejemplo.com", codigo: codPro2 } })).j.token;
ok(!!tPro4, "con el código nuevo entra");
q = await pedir("/api/salir", { method: "POST", token: tPro4 });
ok((await pedir("/api/yo", { token: tPro4 })).r.status === 401, "salir cierra la sesión");

console.log("10. panel");
q = await pedir("/api/admin/cuentas", { admin: ADM });
const pro = q.j.cuentas.find((c) => c.email === "pro@ejemplo.com");
ok(q.j.cuentas.length === 2 && pro.horas_hoy > 1, `lista de cuentas con uso del día (${pro.horas_hoy} h)`);
q = await pedir("/api/admin/registro", { admin: ADM });
ok(q.j.registro.length >= 8, `registro de cambios (${q.j.registro.length} entradas)`);
q = await pedir("/api/admin/clave", { method: "POST", admin: ADM });
const ADM2 = q.j.clave;
ok((await pedir("/api/admin/estado", { admin: ADM })).r.status === 401 && (await pedir("/api/admin/estado", { admin: ADM2 })).r.status === 200, "cambiar la clave de administrador anula la vieja");
q = await pedir("/api/admin/cuentas/1/borrar", { method: "POST", admin: ADM2 });
ok((await pedir("/api/admin/cuentas", { admin: ADM2 })).j.cuentas.length === 1, "borrar cuenta");

console.log(`\n${pasos - fallas} de ${pasos} pruebas bien${fallas ? `, ${fallas} FALLAS` : ""}.`);
process.exit(fallas ? 1 : 0);
