/**
 * Shared test setup: a fresh temp SQLite DB per test file, the app started
 * in-process on an ephemeral port, and small request helpers.
 *
 * Each `node --test` file runs in its own process, so requiring the app here
 * (after setting env vars) gives every file an isolated app + DB.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ADMIN_KEY = 'test-admin-key';
const GATEWAY_KEY = 'test-gateway-key';

// Standard SHA-256 (used for SOS ids). Note: the app's own `sha256()` password
// helper is a legacy custom implementation whose output differs, so tests that
// seed users directly use a bcrypt hash instead (login accepts either).
function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function bcryptHash(password) {
  return require('bcryptjs').hashSync(password, 4);
}

/**
 * @param {object} [opts]
 * @param {(dbPath: string) => Promise<void>} [opts.beforeRequire] prepare the DB file before the app opens it
 */
async function startApp(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zamboalert-test-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.ZAMBOALERT_DB_PATH = dbPath;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.NODE_ENV = 'test';
  process.env.GATEWAY_API_KEY = GATEWAY_KEY;
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  if (opts.beforeRequire) await opts.beforeRequire(dbPath);

  const app = require('../src/index.js');
  await app.dbReady;
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, urlPath, body, headers = {}) {
    const resp = await fetch(base + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: resp.status, body: json, text };
  }

  const dbGet = (sql, params = []) => new Promise((resolve, reject) =>
    app.db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
  const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    app.db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));

  /** Code from the most recent captured email to `email`. */
  function lastCode(email) {
    const mails = app.sentMail.filter(m => m.to === email.toLowerCase());
    if (!mails.length) throw new Error(`no mail captured for ${email}`);
    return mails[mails.length - 1].code;
  }

  async function close() {
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
    await new Promise(resolve => app.db.close(() => resolve()));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold the file briefly */ }
  }

  // ── Flows reused across files ──────────────────────────────────────────────
  const admin = { 'X-Admin-Key': ADMIN_KEY };

  async function signupCitizen(email, password = 'Citizen#123') {
    const r = await api('POST', '/api/auth/signup', {
      firstName: 'Cita', lastName: 'Zen', email, password, role: 'citizen', contactNumber: '09170000000',
    });
    if (r.status !== 200) throw new Error(`signup failed ${r.status} ${r.text}`);
    const v = await api('POST', '/api/auth/verify-email', { email, code: lastCode(email) });
    if (v.status !== 200) throw new Error(`verify failed ${v.status} ${v.text}`);
    return r.body;
  }

  async function registerOfficial(email, password = 'Official#123') {
    const r = await api('POST', '/api/auth/register', {
      firstName: 'Ofi', lastName: 'Cial', email, password, phoneNumber: '09171111111',
    });
    if (r.status !== 200) throw new Error(`register failed ${r.status} ${r.text}`);
    const v = await api('POST', '/api/auth/verify-email', { email, code: lastCode(email) });
    if (v.status !== 200) throw new Error(`verify failed ${v.status} ${v.text}`);
    const row = await dbGet('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
    return row.id;
  }

  async function approveOfficial(id) {
    const r = await api('POST', `/api/admin/officials/${id}/approve`, {}, admin);
    if (r.status !== 200) throw new Error(`approve failed ${r.status} ${r.text}`);
  }

  /** Full dashboard sign-in (password + 2FA); returns the JWT. */
  async function officialToken(email, password = 'Official#123') {
    const l = await api('POST', '/api/auth/login', { email, password });
    if (l.status !== 200 || !l.body.requires2fa) throw new Error(`login failed ${l.status} ${l.text}`);
    const v = await api('POST', '/api/auth/verify-2fa', { username: email, code: lastCode(email) });
    if (v.status !== 200) throw new Error(`2fa failed ${v.status} ${v.text}`);
    return v.body.token;
  }

  return {
    app, api, close, dbGet, dbRun, lastCode, admin,
    signupCitizen, registerOfficial, approveOfficial, officialToken,
  };
}

module.exports = { startApp, sha256Hex, bcryptHash, ADMIN_KEY, GATEWAY_KEY };
