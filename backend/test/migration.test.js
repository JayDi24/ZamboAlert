// An existing database (created before the security columns existed) must be
// migrated in place, and officials already in it must stay approved.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { startApp, bcryptHash } = require('./_helpers');

let h;

async function createLegacyDb(dbPath) {
  const db = new sqlite3.Database(dbPath);
  const run = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, err => (err ? reject(err) : resolve())));
  // users table as it existed before this change (no official_approved etc.)
  await run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      password_hash TEXT NOT NULL,
      password_bcrypt TEXT,
      role TEXT NOT NULL DEFAULT 'citizen',
      is_verified INTEGER DEFAULT 0,
      is_rescuer_verified INTEGER,
      failed_attempts INTEGER DEFAULT 0,
      mfa_enabled INTEGER DEFAULT 0,
      contact_number TEXT,
      phone_number TEXT,
      id_type TEXT,
      id_number TEXT,
      id_front_uri TEXT,
      id_back_uri TEXT,
      email_verification_code_hash TEXT,
      email_verification_expires_at INTEGER,
      two_fa_code TEXT,
      two_fa_expires INTEGER,
      password_reset_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  await run(
    `INSERT INTO users (id, first_name, last_name, email, password_hash, password_bcrypt, role, is_verified)
     VALUES ('old-official', 'Old', 'Official', 'old.official@example.com', 'legacy-sha', ?, 'barangay_official', 1)`,
    [bcryptHash('OldPass#123')]
  );
  await new Promise(resolve => db.close(() => resolve()));
}

before(async () => { h = await startApp({ beforeRequire: createLegacyDb }); });
after(async () => { await h.close(); });

test('existing official rows are approved after the migration', async () => {
  const row = await h.dbGet("SELECT official_approved, two_fa_attempts, lockout_until FROM users WHERE id='old-official'");
  assert.equal(row.official_approved, 1);
  assert.equal(row.two_fa_attempts, 0);
  assert.equal(row.lockout_until, null);

  const l = await h.api('POST', '/api/auth/login', { email: 'old.official@example.com', password: 'OldPass#123' });
  assert.equal(l.status, 200);
  assert.equal(l.body.requires2fa, true);
});
