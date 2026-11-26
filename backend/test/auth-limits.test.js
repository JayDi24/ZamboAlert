// Password reset expiry/attempts, login lockout, and email-verification attempts.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./_helpers');

let h;
before(async () => { h = await startApp(); });
after(async () => { await h.close(); });

const other = code => (code === '000000' ? '111111' : '000000');

test('password reset: 5 wrong codes -> 429, then the right code is rejected', async () => {
  const email = 'reset.limit@example.com';
  await h.signupCitizen(email);
  const f = await h.api('POST', '/api/auth/forgot-password', { email });
  assert.equal(f.status, 200);
  const code = h.lastCode(email);

  const row = await h.dbGet('SELECT password_reset_code, password_reset_expires FROM users WHERE email=?', [email]);
  assert.notEqual(row.password_reset_code, code, 'reset code is stored hashed');
  assert.ok(Number(row.password_reset_expires) > Date.now() + 14 * 60 * 1000);

  for (let i = 1; i <= 4; i++) {
    const r = await h.api('POST', '/api/auth/reset-password', { email, code: other(code), newPassword: 'New#Pass1' });
    assert.equal(r.status, 400, `attempt ${i}`);
  }
  const fifth = await h.api('POST', '/api/auth/reset-password', { email, code: other(code), newPassword: 'New#Pass1' });
  assert.equal(fifth.status, 429);
  assert.match(fifth.body.error, /request a new/i);

  const late = await h.api('POST', '/api/auth/reset-password', { email, code, newPassword: 'New#Pass1' });
  assert.equal(late.status, 400);
});

test('password reset: an expired code is rejected', async () => {
  const email = 'reset.expired@example.com';
  await h.signupCitizen(email);
  assert.equal((await h.api('POST', '/api/auth/request-reset', { email })).status, 200);
  const code = h.lastCode(email);
  await h.dbRun('UPDATE users SET password_reset_expires=? WHERE email=?', [Date.now() - 1000, email]);
  const r = await h.api('POST', '/api/auth/reset-password', { email, code, newPassword: 'New#Pass1' });
  assert.equal(r.status, 400);
});

test('password reset: success sets a new password usable for login and clears the code', async () => {
  const email = 'reset.ok@example.com';
  await h.signupCitizen(email, 'Old#Pass1');
  assert.equal((await h.api('POST', '/api/auth/forgot-password', { email })).status, 200);
  const code = h.lastCode(email);
  const r = await h.api('POST', '/api/auth/reset-password', { email, code, newPassword: 'Brand#New1' });
  assert.equal(r.status, 200);

  const row = await h.dbGet('SELECT password_reset_code, password_reset_expires, password_reset_attempts FROM users WHERE email=?', [email]);
  assert.equal(row.password_reset_code, null);
  assert.equal(row.password_reset_expires, null);
  assert.equal(row.password_reset_attempts, 0);

  assert.equal((await h.api('POST', '/api/auth/login', { email, password: 'Old#Pass1' })).status, 400);
  const ok = await h.api('POST', '/api/auth/login', { email, password: 'Brand#New1' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.success, true);

  // the code cannot be reused
  assert.equal((await h.api('POST', '/api/auth/reset-password', { email, code, newPassword: 'Again#1' })).status, 400);
});

test('login lockout after 5 wrong passwords -> 429 even with the correct password', async () => {
  const email = 'lockout@example.com';
  await h.signupCitizen(email, 'Right#Pass1');
  for (let i = 1; i <= 4; i++) {
    const r = await h.api('POST', '/api/auth/login', { email, password: 'wrong' });
    assert.equal(r.status, 400, `attempt ${i}`);
  }
  const fifth = await h.api('POST', '/api/auth/login', { email, password: 'wrong' });
  assert.equal(fifth.status, 429);

  const locked = await h.api('POST', '/api/auth/login', { email, password: 'Right#Pass1' });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.message, 'Too many failed sign-in attempts. Try again in 15 minutes.');
  assert.equal(locked.body.error, locked.body.message);

  const row = await h.dbGet('SELECT failed_attempts FROM users WHERE email=?', [email]);
  assert.equal(row.failed_attempts, 0, 'counter reset when the lockout starts');

  // After the lockout expires the correct password works and resets state
  await h.dbRun('UPDATE users SET lockout_until=? WHERE email=?', [Date.now() - 1000, email]);
  const ok = await h.api('POST', '/api/auth/login', { email, password: 'Right#Pass1' });
  assert.equal(ok.status, 200);
  const after = await h.dbGet('SELECT failed_attempts, lockout_until FROM users WHERE email=?', [email]);
  assert.equal(after.failed_attempts, 0);
  assert.equal(after.lockout_until, null);
});

test('a successful login resets the failed-attempt counter', async () => {
  const email = 'reset.counter@example.com';
  await h.signupCitizen(email, 'Right#Pass1');
  for (let i = 0; i < 4; i++) await h.api('POST', '/api/auth/login', { email, password: 'wrong' });
  assert.equal((await h.api('POST', '/api/auth/login', { email, password: 'Right#Pass1' })).status, 200);
  for (let i = 0; i < 4; i++) {
    assert.equal((await h.api('POST', '/api/auth/login', { email, password: 'wrong' })).status, 400);
  }
});

test('verify-email: 5 wrong codes -> 429 and the code is cleared; a new code resets the counter', async () => {
  const email = 'verify.limit@example.com';
  const s = await h.api('POST', '/api/auth/signup', {
    firstName: 'V', lastName: 'L', email, password: 'Pass#123', role: 'citizen', contactNumber: '0917',
  });
  assert.equal(s.status, 200);
  const code = h.lastCode(email);
  for (let i = 1; i <= 4; i++) {
    assert.equal((await h.api('POST', '/api/auth/verify-email', { email, code: other(code) })).status, 400, `attempt ${i}`);
  }
  const fifth = await h.api('POST', '/api/auth/verify-email', { email, code: other(code) });
  assert.equal(fifth.status, 429);
  assert.match(fifth.body.error, /request a new code/i);
  assert.equal((await h.api('POST', '/api/auth/verify-email', { email, code })).status, 400);

  assert.equal((await h.api('POST', '/api/auth/resend-code', { email, type: 'register' })).status, 200);
  const fresh = h.lastCode(email);
  for (let i = 0; i < 4; i++) {
    assert.equal((await h.api('POST', '/api/auth/verify-email', { email, code: other(fresh) })).status, 400);
  }
  const ok = await h.api('POST', '/api/auth/verify-email', { email, code: fresh });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.isVerified, true);
});
