// Free-tier persistence: hosts like Render Free / Koyeb Free have NO persistent disk — the SQLite file
// is wiped on every restart or deploy. This module snapshots the whole database (gzipped, usually <1 MB)
// to a remote libSQL/Turso database after every write (debounced) and restores it on boot.
//
// Enable by setting:  TURSO_DATABASE_URL=libsql://xxx.turso.io   TURSO_AUTH_TOKEN=eyJ...
// (Turso free tier: 5 GB, no card.)  Without these vars this module is a no-op.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const URL_ = process.env.TURSO_DATABASE_URL;
const TOKEN = process.env.TURSO_AUTH_TOKEN;
const enabled = !!URL_;
let client = null, dirty = false, timer = null, uploading = false, lastUpload = 0, db = null;

function remote() {
  if (!client) { const { createClient } = require('@libsql/client'); client = createClient({ url: URL_, authToken: TOKEN }); }
  return client;
}

// 1) Called BEFORE the DB is opened. Downloads the latest snapshot if the local file is missing.
async function restore(dbPath) {
  if (!enabled) return false;
  try {
    const c = remote();
    await c.execute('CREATE TABLE IF NOT EXISTS nducare_snapshots (id INTEGER PRIMARY KEY CHECK (id=1), data BLOB NOT NULL, bytes INTEGER, updated_at INTEGER)');
    if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
      // local file exists (e.g. warm restart on a host WITH a disk) — keep local, it is newest
      return false;
    }
    const r = await c.execute('SELECT data, bytes, updated_at FROM nducare_snapshots WHERE id=1');
    if (!r.rows.length) { console.log('[persist] no remote snapshot yet — starting fresh (will be seeded)'); return false; }
    const blob = r.rows[0].data;
    const buf = zlib.gunzipSync(Buffer.from(blob instanceof ArrayBuffer ? new Uint8Array(blob) : blob));
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + ext); } catch { } }
    fs.writeFileSync(dbPath, buf);
    console.log(`[persist] restored database from Turso (${(buf.length / 1024).toFixed(0)} KB, saved ${new Date(Number(r.rows[0].updated_at)).toISOString()})`);
    return true;
  } catch (e) { console.error('[persist] restore failed:', e.message); return false; }
}

// 2) Called AFTER the DB is opened. Hooks every write statement and schedules an upload.
function attach(database) {
  if (!enabled) return;
  db = database;
  const Statement = db.prepare('SELECT 1').constructor;
  const origRun = Statement.prototype.run;
  Statement.prototype.run = function (...a) { const r = origRun.apply(this, a); if (this.database === db || true) markDirty(); return r; };
  const origExec = db.exec.bind(db);
  db.exec = (sql) => { const r = origExec(sql); markDirty(); return r; };
  // flush on shutdown (Render sends SIGTERM before spin-down / deploy)
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { console.log(`[persist] ${sig} — flushing snapshot…`); clearTimeout(timer); await upload(true); process.exit(0); });
  // safety net: periodic upload even if the hook missed something
  setInterval(() => { if (dirty) upload(); }, 5 * 60 * 1000).unref();
  console.log('[persist] Turso snapshot persistence enabled');
}

function markDirty() { dirty = true; clearTimeout(timer); timer = setTimeout(() => upload(), 3000); }

async function upload(force = false) {
  if (!enabled || !db || uploading) { if (uploading && force) await new Promise(r => setTimeout(r, 1500)); return; }
  if (!dirty && !force) return;
  uploading = true; dirty = false;
  try {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { }
    const raw = db.serialize();
    const gz = zlib.gzipSync(raw, { level: 6 });
    await remote().execute({ sql: 'INSERT INTO nducare_snapshots (id, data, bytes, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, bytes=excluded.bytes, updated_at=excluded.updated_at', args: [gz, raw.length, Date.now()] });
    lastUpload = Date.now();
    if (process.env.PERSIST_VERBOSE) console.log(`[persist] snapshot uploaded (${(gz.length / 1024).toFixed(0)} KB gz / ${(raw.length / 1024).toFixed(0)} KB)`);
  } catch (e) { dirty = true; console.error('[persist] upload failed, will retry:', e.message); }
  finally { uploading = false; if (dirty) markDirty(); }
}

module.exports = { enabled, restore, attach, upload, status: () => ({ enabled, dirty, lastUpload }) };
