// Servidor de NeuroVisor en Cloudflare Workers: cuentas Lite/PRO y la red de puntas.
//
// Qué hace:
//   - Cuentas de médicos (correo + código de acceso que genera el administrador), con plan Lite o PRO, vencimiento,
//     límite de equipos y de horas de EEG por día. Se guardan en la base D1 (binding DB).
//   - La red entrenada de puntas corre acá. El navegador manda tramos de 60 s ya preparados (19 canales, 128 Hz, sin
//     nombre, sin fechas, sin unidades) y recibe la probabilidad de punta. Los pesos de la red están solo en D1.
//   - Antes de cada análisis se vuelve a leer la cuenta en D1: si el administrador la pasa a Lite o la desactiva, deja
//     de funcionar en el acto.
//   - La señal del EEG no se guarda ni se escribe en los registros: se analiza en memoria y se descarta.
//
// Lo que NO está acá: la página pública (public/), el cobro con PayPal, el detector de crisis por reglas (sigue en el
// visor), el reentrenamiento de la red.

import { snLoad, snForward, snChanOf } from "./red.js";

const VERSION = "1.0.0";
const DIA = 86400000;
const TOKEN_DIAS = 60; // la sesión dura 60 días y se renueva sola mientras se use
const MAX_L = 12000; // muestras por canal en un pedido (≈ 94 s a 128 Hz)
const RED_FS = 128;

// ---------------------------------------------------------------- utilidades
const enc = new TextEncoder();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const SEG = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };

function json(obj, status = 200, cors = true) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...SEG, ...(cors ? CORS : {}) } });
}
class Fallo extends Error {
  constructor(status, codigo, msg) {
    super(msg);
    this.status = status;
    this.codigo = codigo;
  }
}
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function sha256(txt) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(txt)));
}
function igual(a, b) {
  // comparación de tiempo constante (para hashes de igual largo)
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// códigos legibles: sin I, L, O ni U para que no se confundan al dictarlos (alfabeto de Crockford)
const ALFA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function codigoNuevo(grupos, pref) {
  const n = grupos * 4, r = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (let i = 0; i < n; i++) s += ALFA[r[i] & 31] + ((i % 4 === 3 && i < n - 1) ? "-" : "");
  return pref + s;
}
const normCodigo = (c) => String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/^NV/, "");
const normEmail = (e) => String(e || "").trim().toLowerCase();
const emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const hoy = () => new Date().toISOString().slice(0, 10);
const recorte = (s, n) => String(s ?? "").slice(0, n);

// ---------------------------------------------------------------- base de datos
const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS cuentas (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT 'lite', vence INTEGER, activa INTEGER NOT NULL DEFAULT 1, codigo_hash TEXT, max_equipos INTEGER NOT NULL DEFAULT 2, limite_horas_dia REAL NOT NULL DEFAULT 24, nota TEXT NOT NULL DEFAULT '', creada INTEGER NOT NULL, ultimo_uso INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sesiones (id TEXT PRIMARY KEY, cuenta INTEGER NOT NULL, creada INTEGER NOT NULL, ultimo_uso INTEGER, equipo TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS sesiones_cuenta ON sesiones (cuenta)`,
  `CREATE TABLE IF NOT EXISTS uso (cuenta INTEGER NOT NULL, dia TEXT NOT NULL, segundos REAL NOT NULL DEFAULT 0, pedidos INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (cuenta, dia))`,
  `CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS modelo (nombre TEXT NOT NULL, parte INTEGER NOT NULL, datos TEXT NOT NULL, PRIMARY KEY (nombre, parte))`,
  `CREATE TABLE IF NOT EXISTS registro (t INTEGER NOT NULL, quien TEXT NOT NULL, que TEXT NOT NULL)`,
];
let listo = null;
function preparar(env) {
  if (!env.DB) throw new Fallo(503, "sin_base", "El servidor no tiene la base de datos conectada.");
  if (!listo) listo = env.DB.batch(ESQUEMA.map((q) => env.DB.prepare(q))).catch((e) => ((listo = null), Promise.reject(e)));
  return listo;
}
async function ajuste(env, clave) {
  const r = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = ?1").bind(clave).first();
  return r ? r.valor : null;
}
const ponerAjuste = (env, clave, valor) => env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES (?1, ?2) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").bind(clave, valor).run();
const anotar = (env, quien, que) => env.DB.prepare("INSERT INTO registro (t, quien, que) VALUES (?1, ?2, ?3)").bind(Date.now(), recorte(quien, 120), recorte(que, 500)).run();

// clave de firma de las sesiones: se crea sola la primera vez y queda en D1 (no hace falta configurar nada)
let firma = null;
async function claveFirma(env) {
  if (firma) return firma;
  let k = await ajuste(env, "clave_firma");
  if (!k) {
    k = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('clave_firma', ?1)").bind(k).run();
    k = await ajuste(env, "clave_firma");
  }
  firma = await crypto.subtle.importKey("raw", enc.encode(k), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return firma;
}
async function tokenNuevo(env, cuenta, sesion) {
  const cuerpo = b64u(enc.encode(JSON.stringify({ c: cuenta, s: sesion, e: Date.now() + TOKEN_DIAS * DIA })));
  return cuerpo + "." + b64u(await crypto.subtle.sign("HMAC", await claveFirma(env), enc.encode(cuerpo)));
}
async function leerToken(env, req) {
  const m = /^Bearer\s+([\w-]+)\.([\w-]+)$/.exec(req.headers.get("Authorization") || "");
  if (!m) throw new Fallo(401, "sin_sesion", "Inicie sesión con su cuenta de NeuroVisor.");
  let ok = false, t = null;
  try {
    ok = await crypto.subtle.verify("HMAC", await claveFirma(env), unb64u(m[2]), enc.encode(m[1]));
    t = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
  } catch {}
  if (!ok || !t || !(t.e > Date.now())) throw new Fallo(401, "sin_sesion", "La sesión venció. Vuelva a entrar con su correo y su código.");
  return t;
}
const planDe = (c, ahora = Date.now()) => (c.activa && c.plan === "pro" && (!c.vence || c.vence > ahora) ? "pro" : "lite");
// en cada uso: la sesión existe, la cuenta existe y está activa (se lee de D1 cada vez)
async function quienEs(env, req) {
  const t = await leerToken(env, req);
  const c = await env.DB.prepare("SELECT c.*, s.id AS sid, s.ultimo_uso AS s_uso FROM sesiones s JOIN cuentas c ON c.id = s.cuenta WHERE s.id = ?1 AND c.id = ?2").bind(String(t.s), Number(t.c)).first();
  if (!c) throw new Fallo(401, "sin_sesion", "La sesión se cerró en este equipo (se entró desde más equipos de los permitidos, o el administrador cerró las sesiones). Vuelva a entrar con su correo y su código.");
  if (!c.activa) throw new Fallo(403, "desactivada", "Esta cuenta está desactivada. Consulte con quien le dio el acceso.");
  return { c, t };
}
async function horasHoy(env, id) {
  const r = await env.DB.prepare("SELECT segundos FROM uso WHERE cuenta = ?1 AND dia = ?2").bind(id, hoy()).first();
  return (r ? r.segundos : 0) / 3600;
}
const resumen = (c, horas) => ({ email: c.email, nombre: c.nombre, plan: planDe(c), vence: c.vence || null, horas_hoy: Math.round(horas * 100) / 100, limite_horas_dia: c.limite_horas_dia });

// ---------------------------------------------------------------- la red (pesos en D1, cacheados por isolate)
let MODELO = null;
async function modelo(env) {
  const ver = await ajuste(env, "modelo_ver");
  if (!ver) throw new Fallo(503, "modelo", "La red todavía no está cargada en el servidor.");
  if (MODELO && MODELO.ver === ver) return MODELO;
  const { results } = await env.DB.prepare("SELECT datos FROM modelo WHERE nombre = 'spikenet' ORDER BY parte").all();
  const W = snLoad(results.map((r) => r.datos).join(""));
  const thr = JSON.parse((await ajuste(env, "modelo_umbrales")) || "null");
  if (!thr || ![thr.baja, thr.media, thr.alta].every((v) => v > 0 && v < 1)) throw new Fallo(503, "modelo", "Faltan los umbrales de la red.");
  MODELO = { ver, W, thr };
  return MODELO;
}
async function analizar(env, req) {
  const { c, t } = await quienEs(env, req);
  if (planDe(c) !== "pro") throw new Fallo(403, "no_pro", c.plan === "pro" && c.vence && c.vence <= Date.now() ? "Su plan PRO venció. Renuévelo para usar la red de puntas." : "La red de puntas es de la versión PRO.");
  const largo = Number(req.headers.get("Content-Length") || 0);
  if (largo > 12 + 19 * MAX_L * 4) throw new Fallo(413, "datos", "Tramo demasiado largo.");
  const buf = await req.arrayBuffer();
  if (buf.byteLength < 12 || buf.byteLength > 12 + 19 * MAX_L * 4) throw new Fallo(400, "datos", "Formato de datos inválido.");
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x4e565231 /* "NVR1" */) throw new Fallo(400, "datos", "Formato de datos inválido.");
  const nCh = dv.getUint32(4, true), L = dv.getUint32(8, true);
  if (nCh !== 19 || !(L > 0 && L <= MAX_L) || buf.byteLength !== 12 + nCh * L * 4) throw new Fallo(400, "datos", "Formato de datos inválido.");
  const seg = L / RED_FS;
  const usado = await horasHoy(env, c.id);
  if (usado + seg / 3600 > c.limite_horas_dia) throw new Fallo(429, "cupo", `Llegó al límite de ${String(c.limite_horas_dia).replace(".", ",")} h de EEG analizadas por día. Se renueva a las 21 h de Paraguay (0 h UTC).`);
  const M = await modelo(env);
  const all = new Float32Array(buf, 12, nCh * L), X = [];
  for (let k = 0; k < nCh; k++) {
    const x = all.slice(k * L, (k + 1) * L);
    for (let i = 0; i < L; i++) {
      const v = x[i];
      x[i] = v > 30 ? 30 : v < -30 ? -30 : v === v ? v : 0; // NaN → 0
    }
    X.push(x);
  }
  const z = snForward(X, M.W), ch = snChanOf(X, z.length), nz = z.length;
  const out = new ArrayBuffer(20 + 4 * nz + nz), o = new DataView(out);
  o.setUint32(0, 0x4e565a31, false); // "NVZ1"
  o.setUint32(4, nz, true);
  o.setFloat32(8, M.thr.baja, true);
  o.setFloat32(12, M.thr.media, true);
  o.setFloat32(16, M.thr.alta, true);
  new Float32Array(out, 20, nz).set(z);
  new Int8Array(out, 20 + 4 * nz, nz).set(ch);
  // uso del día (para el límite y para que el administrador lo vea) y última actividad
  const ahora = Date.now(), q = [env.DB.prepare("INSERT INTO uso (cuenta, dia, segundos, pedidos) VALUES (?1, ?2, ?3, 1) ON CONFLICT (cuenta, dia) DO UPDATE SET segundos = segundos + excluded.segundos, pedidos = pedidos + 1").bind(c.id, hoy(), seg)];
  if (!c.s_uso || ahora - c.s_uso > 600000) q.push(env.DB.prepare("UPDATE sesiones SET ultimo_uso = ?1 WHERE id = ?2").bind(ahora, c.sid), env.DB.prepare("UPDATE cuentas SET ultimo_uso = ?1 WHERE id = ?2").bind(ahora, c.id));
  await env.DB.batch(q);
  return new Response(out, { headers: { "Content-Type": "application/octet-stream", ...SEG, ...CORS } });
}

// ---------------------------------------------------------------- médicos: entrar, ver plan, salir
async function cuerpoJson(req) {
  try {
    return await req.json();
  } catch {
    throw new Fallo(400, "datos", "Pedido inválido.");
  }
}
async function entrar(env, req) {
  const b = await cuerpoJson(req);
  const email = normEmail(b.email), cod = normCodigo(b.codigo);
  const c = email && cod ? await env.DB.prepare("SELECT * FROM cuentas WHERE email = ?1").bind(email).first() : null;
  // el mismo mensaje si no existe el correo o si el código no coincide (no se revela qué correos tienen cuenta)
  if (!c || !c.codigo_hash || !igual(await sha256("codigo:" + cod), c.codigo_hash)) throw new Fallo(401, "credenciales", "Correo o código incorrecto.");
  if (!c.activa) throw new Fallo(403, "desactivada", "Esta cuenta está desactivada. Consulte con quien le dio el acceso.");
  const sid = hex(crypto.getRandomValues(new Uint8Array(16))), ahora = Date.now();
  await env.DB.prepare("INSERT INTO sesiones (id, cuenta, creada, ultimo_uso, equipo) VALUES (?1, ?2, ?3, ?3, ?4)").bind(sid, c.id, ahora, recorte(b.equipo, 120)).run();
  // si ya hay más equipos que los permitidos, se cierran los más viejos
  await env.DB.prepare("DELETE FROM sesiones WHERE cuenta = ?1 AND id NOT IN (SELECT id FROM sesiones WHERE cuenta = ?1 ORDER BY creada DESC LIMIT ?2)").bind(c.id, Math.max(1, c.max_equipos)).run();
  await env.DB.prepare("UPDATE cuentas SET ultimo_uso = ?1 WHERE id = ?2").bind(ahora, c.id).run();
  return json({ ok: true, token: await tokenNuevo(env, c.id, sid), cuenta: resumen(c, await horasHoy(env, c.id)) });
}
async function yo(env, req) {
  const { c, t } = await quienEs(env, req);
  const r = { ok: true, cuenta: resumen(c, await horasHoy(env, c.id)) };
  // renovación: si a la sesión le quedan menos de 30 días, se entrega un token nuevo para la misma sesión
  if (t.e - Date.now() < 30 * DIA) r.token = await tokenNuevo(env, c.id, c.sid);
  return json(r);
}
async function salir(env, req) {
  let t = null;
  try {
    t = await leerToken(env, req);
  } catch {}
  if (t) await env.DB.prepare("DELETE FROM sesiones WHERE id = ?1").bind(String(t.s)).run();
  return json({ ok: true });
}

// ---------------------------------------------------------------- administración (solo desde la página /admin)
async function esAdmin(env, req) {
  const clave = req.headers.get("X-Admin-Clave") || "";
  const h = await ajuste(env, "admin_hash");
  if (!h && !env.ADMIN_CLAVE) throw new Fallo(503, "sin_admin", "Falta configurar la clave de administrador.");
  const dada = await sha256("admin:" + clave.trim());
  if (clave && ((h && igual(dada, h)) || (env.ADMIN_CLAVE && igual(dada, await sha256("admin:" + env.ADMIN_CLAVE))))) return true;
  throw new Fallo(401, "admin", "Clave de administrador incorrecta.");
}
const fecha = (v) => {
  if (v === null || v === "" || v === undefined) return null;
  if (typeof v === "number") return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (!m) throw new Fallo(400, "datos", "Fecha inválida (use AAAA-MM-DD).");
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T23:59:59-03:00`); // vence al final de ese día (hora de Paraguay)
};
function camposCuenta(b, parcial) {
  const f = {};
  if (!parcial || "nombre" in b) f.nombre = recorte(b.nombre, 120);
  if (!parcial || "plan" in b) {
    if (!["lite", "pro"].includes(b.plan)) throw new Fallo(400, "datos", "El plan debe ser lite o pro.");
    f.plan = b.plan;
  }
  if (!parcial || "vence" in b) f.vence = fecha(b.vence);
  if ("activa" in b) f.activa = b.activa ? 1 : 0;
  if (!parcial || "max_equipos" in b) {
    f.max_equipos = Math.round(Number(b.max_equipos ?? 2));
    if (!(f.max_equipos >= 1 && f.max_equipos <= 20)) throw new Fallo(400, "datos", "Equipos: entre 1 y 20.");
  }
  if (!parcial || "limite_horas_dia" in b) {
    f.limite_horas_dia = Number(b.limite_horas_dia ?? 24);
    if (!(f.limite_horas_dia > 0 && f.limite_horas_dia <= 500)) throw new Fallo(400, "datos", "Horas por día: entre 0 y 500.");
  }
  if (!parcial || "nota" in b) f.nota = recorte(b.nota, 500);
  return f;
}
async function admin(env, req, ruta) {
  await esAdmin(env, req);
  const met = req.method;
  if (ruta === "estado" && met === "GET") {
    const ver = await ajuste(env, "modelo_ver"), thr = JSON.parse((await ajuste(env, "modelo_umbrales")) || "null");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(plan = 'pro' AND activa = 1 AND (vence IS NULL OR vence > ?1)) AS pro FROM cuentas").bind(Date.now()).first();
    const u = await env.DB.prepare("SELECT SUM(segundos) AS s, SUM(pedidos) AS p FROM uso WHERE dia = ?1").bind(hoy()).first();
    const bytes = await env.DB.prepare("SELECT SUM(LENGTH(datos)) AS b FROM modelo WHERE nombre = 'spikenet'").first();
    return json({ ok: true, version: VERSION, entorno: env.ENTORNO || "", modelo: { cargado: !!ver, ver, umbrales: thr, bytes: bytes?.b || 0 }, cuentas: n?.n || 0, pro: n?.pro || 0, horas_hoy: Math.round(((u?.s || 0) / 3600) * 100) / 100, pedidos_hoy: u?.p || 0 }, 200, false);
  }
  if (ruta === "cuentas" && met === "GET") {
    const d30 = new Date(Date.now() - 30 * DIA).toISOString().slice(0, 10);
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.email, c.nombre, c.plan, c.vence, c.activa, c.max_equipos, c.limite_horas_dia, c.nota, c.creada, c.ultimo_uso,
        (SELECT COUNT(*) FROM sesiones s WHERE s.cuenta = c.id) AS equipos,
        (SELECT GROUP_CONCAT(equipo, ' | ') FROM sesiones s WHERE s.cuenta = c.id) AS equipos_txt,
        (SELECT segundos FROM uso u WHERE u.cuenta = c.id AND u.dia = ?1) AS seg_hoy,
        (SELECT SUM(segundos) FROM uso u WHERE u.cuenta = c.id AND u.dia >= ?2) AS seg_30d
       FROM cuentas c ORDER BY c.creada DESC`
    ).bind(hoy(), d30).all();
    const ahora = Date.now();
    return json({ ok: true, cuentas: results.map((c) => ({ ...c, plan_efectivo: planDe(c, ahora), horas_hoy: Math.round(((c.seg_hoy || 0) / 3600) * 100) / 100, horas_30d: Math.round(((c.seg_30d || 0) / 3600) * 10) / 10 })) }, 200, false);
  }
  if (ruta === "cuentas" && met === "POST") {
    const b = await cuerpoJson(req), email = normEmail(b.email);
    if (!emailOk(email)) throw new Fallo(400, "datos", "Correo inválido.");
    const f = camposCuenta(b, false), cod = codigoNuevo(4, "NV-");
    try {
      await env.DB.prepare("INSERT INTO cuentas (email, nombre, plan, vence, activa, codigo_hash, max_equipos, limite_horas_dia, nota, creada) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9)")
        .bind(email, f.nombre, f.plan, f.vence, await sha256("codigo:" + normCodigo(cod)), f.max_equipos, f.limite_horas_dia, f.nota, Date.now()).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e?.message))) throw new Fallo(409, "datos", "Ya existe una cuenta con ese correo.");
      throw e;
    }
    await anotar(env, "admin", `cuenta creada: ${email} (${f.plan})`);
    return json({ ok: true, codigo: cod }, 200, false);
  }
  if (ruta === "clave" && met === "POST") {
    const nueva = codigoNuevo(6, "ADM-");
    await ponerAjuste(env, "admin_hash", await sha256("admin:" + nueva));
    await anotar(env, "admin", "clave de administrador cambiada");
    return json({ ok: true, clave: nueva }, 200, false);
  }
  if (ruta === "registro" && met === "GET") {
    const { results } = await env.DB.prepare("SELECT t, quien, que FROM registro ORDER BY t DESC LIMIT 200").all();
    return json({ ok: true, registro: results }, 200, false);
  }
  if (ruta === "modelo" && (met === "PUT" || met === "POST")) {
    // acepta el archivo spikenet-w.js tal cual, o JSON {w64, umbrales: {baja, media, alta}}
    const txt = await req.text();
    let w64 = null, thr = null;
    try {
      const j = JSON.parse(txt);
      (w64 = j.w64), (thr = j.umbrales);
    } catch {
      w64 = /SN_W64\s*=\s*"([A-Za-z0-9+/=]+)"/.exec(txt)?.[1];
      const m = /SN_THR\s*=\s*\{\s*baja:\s*([\d.]+),\s*media:\s*([\d.]+),\s*alta:\s*([\d.]+)\s*\}/.exec(txt);
      if (m) thr = { baja: +m[1], media: +m[2], alta: +m[3] };
    }
    if (!w64 || !thr || ![thr.baja, thr.media, thr.alta].every((v) => v > 0 && v < 1)) throw new Fallo(400, "datos", "No encontré los pesos (SN_W64) y los umbrales (SN_THR) de la red.");
    try {
      snLoad(w64); // comprueba que el tamaño sea el de esta red
    } catch {
      throw new Fallo(400, "datos", "Los pesos no corresponden a esta red.");
    }
    const ver = (await sha256(w64 + JSON.stringify(thr))).slice(0, 16), partes = [];
    for (let i = 0; i * 90000 < w64.length; i++) partes.push(w64.slice(i * 90000, (i + 1) * 90000));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM modelo WHERE nombre = 'spikenet'"),
      ...partes.map((p, i) => env.DB.prepare("INSERT INTO modelo (nombre, parte, datos) VALUES ('spikenet', ?1, ?2)").bind(i, p)),
      env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('modelo_umbrales', ?1) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(thr)),
      env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('modelo_ver', ?1) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").bind(ver),
    ]);
    await anotar(env, "admin", `red cargada (versión ${ver})`);
    return json({ ok: true, ver, umbrales: thr, bytes: w64.length }, 200, false);
  }
  const m = /^cuentas\/(\d+)(?:\/(codigo|cerrar|borrar))?$/.exec(ruta);
  if (m && met === "POST") {
    const id = Number(m[1]), c = await env.DB.prepare("SELECT * FROM cuentas WHERE id = ?1").bind(id).first();
    if (!c) throw new Fallo(404, "datos", "No existe esa cuenta.");
    if (m[2] === "codigo") {
      const cod = codigoNuevo(4, "NV-");
      await env.DB.batch([env.DB.prepare("UPDATE cuentas SET codigo_hash = ?1 WHERE id = ?2").bind(await sha256("codigo:" + normCodigo(cod)), id), env.DB.prepare("DELETE FROM sesiones WHERE cuenta = ?1").bind(id)]);
      await anotar(env, "admin", `código nuevo: ${c.email} (se cerraron sus sesiones)`);
      return json({ ok: true, codigo: cod }, 200, false);
    }
    if (m[2] === "cerrar") {
      await env.DB.prepare("DELETE FROM sesiones WHERE cuenta = ?1").bind(id).run();
      await anotar(env, "admin", `sesiones cerradas: ${c.email}`);
      return json({ ok: true }, 200, false);
    }
    if (m[2] === "borrar") {
      await env.DB.batch([env.DB.prepare("DELETE FROM sesiones WHERE cuenta = ?1").bind(id), env.DB.prepare("DELETE FROM uso WHERE cuenta = ?1").bind(id), env.DB.prepare("DELETE FROM cuentas WHERE id = ?1").bind(id)]);
      await anotar(env, "admin", `cuenta borrada: ${c.email}`);
      return json({ ok: true }, 200, false);
    }
    const f = camposCuenta(await cuerpoJson(req), true), k = Object.keys(f);
    if (!k.length) return json({ ok: true }, 200, false);
    await env.DB.prepare(`UPDATE cuentas SET ${k.map((x, i) => `${x} = ?${i + 1}`).join(", ")} WHERE id = ?${k.length + 1}`).bind(...k.map((x) => f[x]), id).run();
    // al desactivar NO se borran las sesiones: así el médico ve «cuenta desactivada» (y no «sesión cerrada»); igual no
    // puede usar nada, porque cada pedido vuelve a leer la cuenta en D1
    await anotar(env, "admin", `cuenta cambiada: ${c.email} → ${k.map((x) => `${x}=${x === "vence" ? (f[x] ? new Date(f[x] - 3 * 3600000).toISOString().slice(0, 10) : "sin vencimiento") : f[x]}`).join(", ")}`);
    return json({ ok: true }, 200, false);
  }
  throw new Fallo(404, "ruta", "No existe esa función.");
}

// ---------------------------------------------------------------- entrada
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (!p.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(req) : new Response("No encontrado", { status: 404 });
    const esAdm = p.startsWith("/api/admin/");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: esAdm ? SEG : { ...CORS, ...SEG } });
    try {
      if (p === "/api/salud") return json({ ok: true, version: VERSION });
      await preparar(env);
      if (esAdm) return await admin(env, req, p.slice(11));
      if (p === "/api/entrar" && req.method === "POST") return await entrar(env, req);
      if (p === "/api/yo" && req.method === "GET") return await yo(env, req);
      if (p === "/api/salir" && req.method === "POST") return await salir(env, req);
      if (p === "/api/red" && req.method === "POST") return await analizar(env, req);
      throw new Fallo(404, "ruta", "No existe esa función.");
    } catch (e) {
      if (e instanceof Fallo) return json({ ok: false, codigo: e.codigo, msg: e.message }, e.status, !esAdm);
      // error inesperado: se informa sin detalles (y sin datos del pedido)
      console.error("error interno:", e && e.message);
      return json({ ok: false, codigo: "interno", msg: "Error interno del servidor. Intente de nuevo en un momento." }, 500, !esAdm);
    }
  },
};
