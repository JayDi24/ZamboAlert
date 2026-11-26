const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./_helpers');

let h;
const email = 'twofa.official@example.com';
const password = 'Official#123';

before(async () => {
  h = await startApp();
  const id = await h.registerOfficial(email, password);
  await h.approveOfficial(id);
});
after(async () => { await h.close(); });

const login = () => h.api('POST', '/api/auth/login', { email, password });
const verify = code => h.api('POST', '/api/auth/verify-2fa', { username: email, code });
const resend = () => h.api('POST', '/api/auth/resend-code', { email, type: 'mfa' });
const wrongCode = right => (right === '000000' ? '111111' : '000000');

test('resend-code mfa without a pending password-verified login is refused', async () => {
  const r = await resend();
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Sign in again to get a new code.');
});

test('the 2FA code is stored hashed', async () => {
  assert.equal((await login()).status, 200);
  const code = h.lastCode(email);
  const row = await h.dbGet('SELECT two_fa_code FROM users WHERE email=?', [email]);
  assert.notEqual(row.two_fa_code, code);
  assert.match(row.two_fa_code, /^[0-9a-f]{64}$/);
});

test('empty code is rejected', async () => {
  assert.equal((await login()).status, 200);
  assert.equal((await verify('')).status, 400);
});

test('5 wrong codes -> 429 and the right code no longer works', async () => {
  assert.equal((await login()).status, 200);
  const right = h.lastCode(email);
  for (let i = 1; i <= 4; i++) {
    const r = await verify(wrongCode(right));
    assert.equal(r.status, 400, `attempt ${i}`);
  }
  const fifth = await verify(wrongCode(right));
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.message, 'Too many attempts. Sign in again.');
  const late = await verify(right);
  assert.equal(late.status, 400);
  // resend also needs a fresh login now
  assert.equal((await resend()).status, 400);
});

test('max 3 resends per challenge; resend issues a new code; correct flow returns a JWT', async () => {
  assert.equal((await login()).status, 200);
  const original = h.lastCode(email);
  for (let i = 1; i <= 3; i++) {
    const r = await resend();
    assert.equal(r.status, 200, `resend ${i}`);
  }
  const fourth = await resend();
  assert.equal(fourth.status, 429);

  const latest = h.lastCode(email);
  if (latest !== original) {
    assert.equal((await verify(original)).status, 400, 'old code replaced by resend');
  }
  const ok = await verify(latest);
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  // The JWT opens dashboard routes
  const settings = await h.api('GET', '/api/settings', undefined, { Authorization: `Bearer ${ok.body.token}` });
  assert.equal(settings.status, 200);

  // A code works only once
  assert.equal((await verify(latest)).status, 400);
});

test('a fresh login resets the resend counter', async () => {
  assert.equal((await login()).status, 200);
  for (let i = 0; i < 3; i++) assert.equal((await resend()).status, 200);
  assert.equal((await resend()).status, 429);
  assert.equal((await login()).status, 200);
  assert.equal((await resend()).status, 200);
});

test('a resend resets the wrong-attempt counter', async () => {
  assert.equal((await login()).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await verify(wrongCode(h.lastCode(email)))).status, 400);
  assert.equal((await resend()).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await verify(wrongCode(h.lastCode(email)))).status, 400);
  assert.equal((await verify(h.lastCode(email))).status, 200);
});

test('an expired code is refused', async () => {
  assert.equal((await login()).status, 200);
  await h.dbRun('UPDATE users SET two_fa_expires=? WHERE email=?', [Date.now() - 1000, email]);
  assert.equal((await verify(h.lastCode(email))).status, 400);
  assert.equal((await resend()).status, 400);
});
