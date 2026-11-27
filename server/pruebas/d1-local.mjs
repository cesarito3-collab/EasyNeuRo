// Imitación mínima de Cloudflare D1 con node:sqlite (Node 22+), para probar el servidor sin internet.
import { DatabaseSync } from "node:sqlite";
const norm = (v) => (v === undefined ? null : v);
class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args.map(norm)); }
  first(col) { const r = this.db.prepare(this.sql).get(...this.args); return r === undefined ? null : col ? r[col] : { ...r }; }
  all() { return { results: this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })), success: true }; }
  run() { const r = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}
export function d1Local(file = ":memory:") {
  const db = new DatabaseSync(file);
  return {
    _db: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try { const out = stmts.map((s) => (/^\s*(SELECT|WITH)/i.test(s.sql) ? s.all() : s.run())); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    async exec(sql) { db.exec(sql); return { count: 1 }; },
  };
}
