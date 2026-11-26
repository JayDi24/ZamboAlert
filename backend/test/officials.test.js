const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, bcryptHash } = require('./_helpers');

let h;
before(async () => { h = await startApp(); });
after(async () => { await h.close(); });

const PENDING_MSG = 'Your barangay official account is waiting for approval by an administrator.';

test('new official: register -> verify -> login 403 pending -> admin approve -> login requires 2FA', async () => {
  const email = 'kapitan@example.com';
  const id = await h.registerOfficial(email);

  const row = await h.dbGet('SELECT official_approved, password_bcrypt FROM users WHERE id=?', [id]);
  assert.equal(row.official_approved, 0);
  assert.ok(row.password_bcrypt);

  const mailsBefore = h.app.sentMail.length;
  const pending = await h.api('POST', '/api/auth/login', { email, password: 'Official#123' });
  assert.equal(pending.status, 403);
  assert.equal(pending.body.message, PENDING_MSG);
  assert.equal(pending.body.error, PENDING_MSG);
  assert.equal(h.app.sentMail.length, mailsBefore, 'no 2FA code is sent to an unapproved official');

  // verify-2fa refuses unapproved officials too
  const v = await h.api('POST', '/api/auth/verify-2fa', { username: email, code: '123456' });
  assert.equal(v.status, 403);

  // Admin routes need the key
  assert.equal((await h.api('GET', '/api/admin/officials')).status, 401);
  const list = await h.api('GET', '/api/admin/officials', undefined, h.admin);
  assert.equal(list.status, 200);
  const entry = list.body.find(o => o.email === email);
  assert.deepEqual(Object.keys(entry).sort(), ['created_at', 'email', 'id', 'is_verified', 'name', 'official_approved']);
  assert.equal(entry.official_approved, 0);
  assert.equal(entry.is_verified, 1);
  assert.equal(entry.name, 'Ofi Cial');

  assert.equal((await h.api('POST', `/api/admin/officials/${id}/approve`, {})).status, 401);
  await h.approveOfficial(id);

  const ok = await h.api('POST', '/api/auth/login', { email, password: 'Official#123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.requires2fa, true);
});

test('reject removes only a not-yet-approved official', async () => {
  const id = await h.registerOfficial('pending.reject@example.com');
  const r = await h.api('POST', `/api/admin/officials/${id}/reject`, {}, h.admin);
  assert.equal(r.status, 200);
  assert.equal(await h.dbGet('SELECT id FROM users WHERE id=?', [id]), undefined);

  const id2 = await h.registerOfficial('approved.keep@example.com');
  await h.approveOfficial(id2);
  const r2 = await h.api('POST', `/api/admin/officials/${id2}/reject`, {}, h.admin);
  assert.equal(r2.status, 400);
  assert.ok(await h.dbGet('SELECT id FROM users WHERE id=?', [id2]));

  assert.equal((await h.api('POST', '/api/admin/officials/does-not-exist/reject', {}, h.admin)).status, 404);
  assert.equal((await h.api('POST', '/api/admin/officials/does-not-exist/approve', {}, h.admin)).status, 404);
});

test('register cannot overwrite an unverified non-official account', async () => {
  const email = 'unverified.citizen@example.com';
  const s = await h.api('POST', '/api/auth/signup', {
    firstName: 'Cita', lastName: 'Zen', email, password: 'Original#1', role: 'citizen', contactNumber: '0917',
  });
  assert.equal(s.status, 200);
  const beforeRow = await h.dbGet('SELECT password_hash FROM users WHERE email=?', [email]);
  const r = await h.api('POST', '/api/auth/register', {
    firstName: 'Evil', lastName: 'Actor', email, password: 'Hijack#1',
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'An account with this email already exists.');
  const row = await h.dbGet('SELECT first_name, password_hash, password_bcrypt, role FROM users WHERE email=?', [email]);
  assert.equal(row.first_name, 'Cita');
  assert.equal(row.password_hash, beforeRow.password_hash);
  assert.equal(row.password_bcrypt, null);
  assert.equal(row.role, 'citizen');
});

test('re-registering an unverified official updates both hashes and keeps it pending', async () => {
  const email = 'redo.official@example.com';
  const first = await h.api('POST', '/api/auth/register', { firstName: 'A', lastName: 'B', email, password: 'First#123' });
  assert.equal(first.status, 200);
  const before = await h.dbGet('SELECT password_hash, password_bcrypt FROM users WHERE email=?', [email]);

  const again = await h.api('POST', '/api/auth/register', { firstName: 'C', lastName: 'D', email, password: 'Second#123' });
  assert.equal(again.status, 200);
  const row = await h.dbGet('SELECT id, first_name, password_hash, password_bcrypt, official_approved FROM users WHERE email=?', [email]);
  assert.equal(row.first_name, 'C');
  assert.ok(row.password_hash && row.password_hash !== before.password_hash, 'sha256 hash rewritten');
  assert.ok(row.password_bcrypt && row.password_bcrypt !== before.password_bcrypt, 'bcrypt hash rewritten');
  assert.equal(row.official_approved, 0);

  // The new password works (after verification + approval); the old one does not.
  assert.equal((await h.api('POST', '/api/auth/verify-email', { email, code: h.lastCode(email) })).status, 200);
  await h.approveOfficial(row.id);
  assert.equal((await h.api('POST', '/api/auth/login', { email, password: 'First#123' })).status, 400);
  const ok = await h.api('POST', '/api/auth/login', { email, password: 'Second#123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.requires2fa, true);
});

test('verify-2fa refuses non-dashboard roles', async () => {
  const email = 'plain.citizen@example.com';
  await h.signupCitizen(email);
  const r = await h.api('POST', '/api/auth/verify-2fa', { email, code: '123456' });
  assert.equal(r.status, 403);
});

test('an official inserted without official_approved defaults to approved', async () => {
  await h.dbRun(
    `INSERT INTO users (id, first_name, last_name, email, password_hash, password_bcrypt, role, is_verified)
     VALUES ('legacy-1', 'Leg', 'Acy', 'legacy@example.com', 'legacy-sha', ?, 'barangay_official', 1)`,
    [bcryptHash('Legacy#123')]
  );
  const row = await h.dbGet("SELECT official_approved FROM users WHERE id='legacy-1'");
  assert.equal(row.official_approved, 1);
  const l = await h.api('POST', '/api/auth/login', { email: 'legacy@example.com', password: 'Legacy#123' });
  assert.equal(l.status, 200);
  assert.equal(l.body.requires2fa, true);
});
