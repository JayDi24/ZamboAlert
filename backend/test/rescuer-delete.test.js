const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./_helpers');

let h;
before(async () => { h = await startApp(); });
after(async () => { await h.close(); });

const PASSWORD = 'Rescuer#123';

/** Signup + documents + rescuers row + approval + email verify + login. Returns { rescuerId, token, userId }. */
async function createApprovedRescuer(email, official) {
  const s = await h.api('POST', '/api/auth/signup', {
    firstName: 'Del', lastName: 'Ete', email, password: PASSWORD, role: 'rescuer', contactNumber: '0917',
  });
  assert.equal(s.status, 200);
  const { docUploadToken } = s.body;
  assert.equal((await h.api('POST', '/api/auth/rescuer-verify', {
    email, idType: 'Barangay ID', idNumber: 'B-9', idFrontUri: 'data:f', idBackUri: 'data:b', docUploadToken,
  })).status, 200);
  const reg = await h.api('POST', '/api/rescuers/register', {
    email, first_name: 'Del', last_name: 'Ete', phone_number: '0917', id_type: 'Barangay ID', id_number: 'B-9', docUploadToken,
  });
  assert.equal(reg.status, 201);
  const rescuerId = reg.body.rescuerId;

  const auth = { Authorization: `Bearer ${official}` };
  assert.equal((await h.api('POST', `/api/rescuers/verify/${rescuerId}`, {}, auth)).status, 200);
  assert.equal((await h.api('POST', '/api/auth/verify-email', { email, code: h.lastCode(email) })).status, 200);

  const login = await h.api('POST', '/api/auth/login', { email, password: PASSWORD, role: 'rescuer' });
  assert.equal(login.status, 200, login.text);
  const user = await h.dbGet('SELECT id FROM users WHERE email=?', [email]);
  return { rescuerId, token: login.body.session.token, userId: user.id };
}

test('dashboard delete removes both rows, keeps logs, kills the old session, and allows re-registration', async () => {
  const offId = await h.registerOfficial('del.official@example.com');
  await h.approveOfficial(offId);
  const official = await h.officialToken('del.official@example.com');
  const auth = { Authorization: `Bearer ${official}` };

  const email = 'del.rescuer@example.com';
  const first = await createApprovedRescuer(email, official);
  const phone = { Authorization: `Bearer ${first.token}` };

  // While the account exists, the session check passes and the phone can send a field log.
  assert.equal((await h.api('GET', '/api/rescuers/me/session', undefined, phone)).status, 200);
  const log = await h.api('POST', '/api/logs/rescuer', {
    log_type: 'victim_update', victim_label: 'JUAN', victim_status: 'injured', message: 'found',
  }, phone);
  assert.equal(log.status, 201, log.text);

  // Delete from the dashboard.
  const del = await h.api('DELETE', `/api/rescuers/${first.rescuerId}`, undefined, auth);
  assert.equal(del.status, 200, del.text);
  assert.equal(del.body.accountDeleted, true);
  assert.equal(await h.dbGet('SELECT id FROM rescuers WHERE id=?', [first.rescuerId]), undefined);
  assert.equal(await h.dbGet('SELECT id FROM users WHERE email=?', [email]), undefined);

  // The session check the app polls reports the deletion.
  const session = await h.api('GET', '/api/rescuers/me/session', undefined, phone);
  assert.equal(session.status, 401);
  assert.match(session.body.message, /removed or is no longer approved/);

  // Field log history is kept.
  const kept = await h.dbGet('SELECT victim_label FROM rescuer_reports WHERE rescuer_email=?', [email]);
  assert.equal(kept.victim_label, 'JUAN');

  // The old phone session is refused right away.
  const after = await h.api('POST', '/api/rescuers/me/location', { lat: 6.9, lng: 122.07 }, phone);
  assert.equal(after.status, 401);
  assert.equal((await h.api('POST', '/api/logs/rescuer', {
    log_type: 'casualty_count', casualty_count: 1, disaster_type: 'Flood',
  }, phone)).status, 401);

  // The same email can register again, and the old token still does not work for the new account.
  const second = await createApprovedRescuer(email, official);
  assert.notEqual(second.userId, first.userId);
  assert.equal((await h.api('POST', '/api/rescuers/me/location', { lat: 6.9, lng: 122.07 }, phone)).status, 401);
  const fresh = await h.api('POST', '/api/rescuers/me/location', { lat: 6.9, lng: 122.07 },
    { Authorization: `Bearer ${second.token}` });
  assert.equal(fresh.status, 200, fresh.text);

  // Deleting a missing rescuer is a 404.
  assert.equal((await h.api('DELETE', `/api/rescuers/${first.rescuerId}`, undefined, auth)).status, 404);
});

test('a rescuer set back to pending loses phone access', async () => {
  const offId = await h.registerOfficial('pend.official@example.com');
  await h.approveOfficial(offId);
  const official = await h.officialToken('pend.official@example.com');
  const email = 'pend.rescuer@example.com';
  const r = await createApprovedRescuer(email, official);

  assert.equal((await h.api('POST', `/api/admin/rescuers/${r.userId}/reject`, {}, h.admin)).status, 200);
  const res = await h.api('POST', '/api/rescuers/me/location', { lat: 6.9, lng: 122.07 },
    { Authorization: `Bearer ${r.token}` });
  assert.equal(res.status, 401);
});
