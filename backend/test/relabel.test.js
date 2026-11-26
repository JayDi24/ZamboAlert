// Features that are recorded but not actually transmitted must say so.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./_helpers');

let h;
let auth;
before(async () => {
  h = await startApp();
  const email = 'relabel.official@example.com';
  const id = await h.registerOfficial(email);
  await h.approveOfficial(id);
  auth = { Authorization: `Bearer ${await h.officialToken(email)}` };
});
after(async () => { await h.close(); });

test('household broadcast reports that no SMS was sent', async () => {
  const add = await h.api('POST', '/api/households', {
    resident_name: 'Maria', household_head: 'Maria', phone_number: '0917', purok_zone: 'Purok 1',
  }, auth);
  assert.equal(add.status, 201);
  const r = await h.api('POST', '/api/households/broadcast', { purok_zone: 'ALL', message: 'Evacuate now' }, auth);
  assert.equal(r.status, 200);
  assert.equal(r.body.smsSent, false);
  assert.equal(r.body.recipientsCount, 1);
  assert.equal(r.body.message, 'Broadcast recorded for 1 household contact(s). SMS sending is not connected yet, so no messages were sent.');
});

test('agency escalation is recorded, not transmitted', async () => {
  const r = await h.api('POST', '/api/manpower/escalate-agency', {
    target_barangays: ['Tetuan'], requested_agency: 'BFP', requested_units: 'Rescue boats', total_reinforcements: 5,
  }, auth);
  assert.equal(r.status, 201);
  assert.equal(r.body.transmitted, false);
  assert.equal(r.body.message, `Escalation request recorded (reference ${r.body.reference_no}). It was not sent to BFP; contact the agency directly.`);
  const row = await h.dbGet('SELECT status FROM manpower_escalations WHERE id=?', [r.body.escalationId]);
  assert.equal(row.status, 'Recorded - not transmitted');
});

test('red alert is recorded without a broadcast', async () => {
  const a = await h.api('POST', '/api/manpower/alerts', { barangay_name: 'Tetuan', required_sar: 10 }, auth);
  assert.equal(a.status, 201);
  const r = await h.api('POST', '/api/manpower/trigger-alert', { barangay_name: 'Tetuan' }, auth);
  assert.equal(r.status, 200);
  assert.equal(r.body.broadcastSent, false);
  assert.equal(r.body.message, 'Red alert recorded for Barangay Tetuan. No broadcast was sent.');
  const row = await h.dbGet('SELECT mobilization_status FROM manpower_alerts WHERE id=?', [a.body.alertId]);
  assert.equal(row.mobilization_status, 'Red Alert Recorded (no broadcast sent)');
});

test('mutual aid transfer message says recorded', async () => {
  const r = await h.api('POST', '/api/manpower/mutual-aid-transfer', {
    from_barangay: 'Tetuan', to_barangay: 'Tumaga', sar_count: 3, medic_count: 1,
  }, auth);
  assert.equal(r.status, 201);
  assert.equal(r.body.message, 'Mutual aid transfer recorded: 4 personnel from Tetuan to Tumaga.');
});
