const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./_helpers');

let h;
before(async () => { h = await startApp(); });
after(async () => { await h.close(); });

const EXPIRED_MSG = 'Your verification session has expired. Contact the barangay office to finish rescuer verification.';

async function signupRescuer(email) {
  const r = await h.api('POST', '/api/auth/signup', {
    firstName: 'Res', lastName: 'Cuer', email, password: 'Rescuer#123', role: 'rescuer', contactNumber: '0917',
    idType: 'Barangay ID', idNumber: 'B-1',
  });
  assert.equal(r.status, 200);
  return r.body;
}

const docs = (email, docUploadToken) => h.api('POST', '/api/auth/rescuer-verify', {
  email, idType: 'Barangay ID', idNumber: 'B-123', idFrontUri: 'data:front', idBackUri: 'data:back',
  ...(docUploadToken !== undefined ? { docUploadToken } : {}),
});
const register = (email, docUploadToken) => h.api('POST', '/api/rescuers/register', {
  email, first_name: 'Res', last_name: 'Cuer', phone_number: '0917', id_type: 'Barangay ID', id_number: 'B-123',
  ...(docUploadToken !== undefined ? { docUploadToken } : {}),
});

test('signup returns docUploadToken for rescuers only', async () => {
  const r = await signupRescuer('token.rescuer@example.com');
  assert.match(r.docUploadToken, /^[0-9a-f]{48}$/);
  const row = await h.dbGet('SELECT doc_upload_token_hash FROM users WHERE email=?', ['token.rescuer@example.com']);
  assert.notEqual(row.doc_upload_token_hash, r.docUploadToken, 'token stored hashed');

  const c = await h.api('POST', '/api/auth/signup', {
    firstName: 'C', lastName: 'Z', email: 'token.citizen@example.com', password: 'Citizen#1', role: 'citizen', contactNumber: '0917',
  });
  assert.equal(c.status, 200);
  assert.equal(c.body.docUploadToken, undefined);
});

test('document upload and rescuers/register require the token; approval syncs both tables', async () => {
  const email = 'flow.rescuer@example.com';
  const { docUploadToken } = await signupRescuer(email);

  const noToken = await docs(email);
  assert.equal(noToken.status, 401);
  assert.equal(noToken.body.message, EXPIRED_MSG);
  assert.equal((await docs(email, 'f'.repeat(48))).status, 401);
  // someone else's valid token does not work for this email
  const { docUploadToken: otherToken } = await signupRescuer('other.rescuer@example.com');
  assert.equal((await docs(email, otherToken)).status, 401);

  const ok = await docs(email, docUploadToken);
  assert.equal(ok.status, 200);
  const u = await h.dbGet('SELECT id, id_number, id_front_uri, is_rescuer_verified FROM users WHERE email=?', [email]);
  assert.equal(u.id_number, 'B-123');
  assert.equal(u.id_front_uri, 'data:front');
  assert.equal(u.is_rescuer_verified, 0);

  assert.equal((await register(email)).status, 401);
  assert.equal((await register(email, 'nope')).status, 401);
  const reg = await register(email, docUploadToken);
  assert.equal(reg.status, 201);
  assert.equal(reg.body.isVerified, false);
  // token stays valid for a retry; the duplicate is rejected by the UNIQUE email
  assert.equal((await register(email, docUploadToken)).status, 400);

  // admin approve-by-email syncs rescuers.is_verified
  const appr = await h.api('POST', '/api/admin/rescuers/approve-by-email', { email }, h.admin);
  assert.equal(appr.status, 200);
  let rr = await h.dbGet('SELECT is_verified, status FROM rescuers WHERE email=?', [email]);
  assert.equal(rr.is_verified, 1);
  assert.equal(rr.status, 'available');
  let uu = await h.dbGet('SELECT is_rescuer_verified FROM users WHERE email=?', [email]);
  assert.equal(uu.is_rescuer_verified, 1);

  // an approved rescuer's documents cannot be replaced
  const locked = await docs(email, docUploadToken);
  assert.equal(locked.status, 409);

  // reject by id syncs both tables
  const rej = await h.api('POST', `/api/admin/rescuers/${u.id}/reject`, {}, h.admin);
  assert.equal(rej.status, 200);
  rr = await h.dbGet('SELECT is_verified, status FROM rescuers WHERE email=?', [email]);
  assert.equal(rr.is_verified, 0);
  assert.equal(rr.status, 'offline');
  uu = await h.dbGet('SELECT is_rescuer_verified FROM users WHERE email=?', [email]);
  assert.equal(uu.is_rescuer_verified, 0);

  // approve by id syncs both tables
  const appr2 = await h.api('POST', `/api/admin/rescuers/${u.id}/approve`, {}, h.admin);
  assert.equal(appr2.status, 200);
  rr = await h.dbGet('SELECT is_verified, status FROM rescuers WHERE email=?', [email]);
  assert.equal(rr.is_verified, 1);
  assert.equal(rr.status, 'available');
  uu = await h.dbGet('SELECT is_rescuer_verified FROM users WHERE email=?', [email]);
  assert.equal(uu.is_rescuer_verified, 1);

  // admin routes still require the key
  assert.equal((await h.api('POST', '/api/admin/rescuers/approve-by-email', { email })).status, 401);
});

test('an expired docUploadToken is refused', async () => {
  const email = 'expired.rescuer@example.com';
  const { docUploadToken } = await signupRescuer(email);
  await h.dbRun('UPDATE users SET doc_upload_token_expires=? WHERE email=?', [Date.now() - 1000, email]);
  assert.equal((await docs(email, docUploadToken)).status, 401);
  assert.equal((await register(email, docUploadToken)).status, 401);
});
