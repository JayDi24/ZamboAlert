const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, sha256Hex } = require('./_helpers');

let h;
before(async () => { h = await startApp(); });
after(async () => { await h.close(); });

const sos = (clientId, lat, lng, extra = {}) =>
  h.api('POST', '/api/sos', { clientId, name: 'Juan', disasterType: 'flood', lat, lng, ...extra });

const citizenPods = async () =>
  (await h.api('GET', '/api/telemetry')).body.filter(p => p.gatewayId === 'CITIZEN-APP-GATEWAY');

test('clientIds sharing the first 8 chars get different SOS ids (sha256-based)', async () => {
  const a = 'phone-lq3x9k2-aaaa';
  const b = 'phone-lq3x9k2-bbbb';
  assert.equal(a.slice(0, 8), b.slice(0, 8));
  const ra = await sos(a, 6.91, 122.07);
  const rb = await sos(b, 6.92, 122.08);
  assert.equal(ra.status, 202);
  assert.equal(rb.status, 202);
  assert.match(ra.body.id, /^SOS-[0-9A-F]{8}$/);
  assert.notEqual(ra.body.id, rb.body.id);
  assert.equal(ra.body.id, `SOS-${sha256Hex(a).slice(0, 8).toUpperCase()}`);

  // The virtual pod uses the same 8-char hash as nearestVictimId.
  const pod = (await citizenPods()).find(p => p.nodeId === ra.body.virtualNodeId);
  assert.ok(pod);
  assert.equal(pod.nearestVictimId, ra.body.id.slice(4));

  const list = (await h.api('GET', '/api/sos')).body;
  assert.ok(list.some(s => s.id === ra.body.id));
  assert.ok(list.some(s => s.id === rb.body.id));
});

test('no-location SOS (null or omitted) is accepted and creates no virtual pod', async () => {
  const before = (await citizenPods()).length;
  const r1 = await sos('phone-noloc-1', null, null);
  assert.equal(r1.status, 202);
  assert.equal(r1.body.virtualNodeId, null);
  const r2 = await h.api('POST', '/api/sos', { clientId: 'phone-noloc-2', name: 'Ana', disasterType: 'earthquake' });
  assert.equal(r2.status, 202);

  assert.equal((await citizenPods()).length, before);
  const list = (await h.api('GET', '/api/sos')).body;
  const s1 = list.find(s => s.clientId === 'phone-noloc-1');
  assert.ok(s1);
  assert.equal(s1.lat, null);
  assert.equal(s1.lng, null);
  const s2 = list.find(s => s.clientId === 'phone-noloc-2');
  assert.equal(s2.lat, null);
  assert.equal(s2.lng, null);
});

test('a phone that loses location has its virtual pod removed', async () => {
  const id = 'phone-moving-1';
  const withLoc = await sos(id, 6.95, 122.1);
  assert.equal(withLoc.status, 202);
  const nodeId = withLoc.body.virtualNodeId;
  assert.ok((await citizenPods()).some(p => p.nodeId === nodeId));

  const noLoc = await sos(id, null, null);
  assert.equal(noLoc.status, 202);
  assert.equal(noLoc.body.id, withLoc.body.id);
  assert.ok(!(await citizenPods()).some(p => p.nodeId === nodeId));

  const entry = (await h.api('GET', '/api/sos')).body.find(s => s.clientId === id);
  assert.equal(entry.lat, null);
  assert.equal(entry.lng, null);
});

test('a single or invalid coordinate is rejected', async () => {
  assert.equal((await sos('phone-bad-1', 6.9, null)).status, 400);
  assert.equal((await sos('phone-bad-2', null, 122.0)).status, 400);
  assert.equal((await h.api('POST', '/api/sos', { clientId: 'phone-bad-3', disasterType: 'flood', lat: 6.9 })).status, 400);
  assert.equal((await sos('phone-bad-4', '6.9', 122.0)).status, 400);
  assert.equal((await sos('phone-bad-5', 95, 122.0)).status, 400);
  assert.equal((await sos('phone-bad-6', 6.9, 122.0, { disasterType: 'fire' })).status, 400);
});
