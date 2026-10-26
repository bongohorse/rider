const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {cases, text, objects, PHONE} = require('../../tools/gym/levels.cjs');

const all = cases();
const accepted = all.filter(c => c.expect === 'accepted');
const finite = v => Number.isFinite(v) && Math.abs(v) < 100000;

test('the generator is deterministic and ids are unique station ids', () => {
  assert.deepEqual(cases().map(c => text(c.level)), all.map(c => text(c.level)));
  assert.equal(new Set(all.map(c => c.id)).size, all.length);
  for (const c of all) assert.match(c.level.id, /^[a-z][a-z0-9-]*$/);
});

test('accepted levels stay inside the unchanged validator limits', () => {
  for (const {id, level: d} of accepted) {
    const [x0, x1, y0, y1] = d.bounds;
    assert.ok([x0, x1, y0, y1].every(finite) && x0 < d.spawn[0] && d.spawn[0] < x1 && y0 < d.spawn[1] && d.spawn[1] < y1, id);
    assert.ok(Math.abs(d.spawn[0]) <= 500 && Math.abs(d.spawn[1]) <= 500, id + ': provisional start limit');
    assert.ok(d.chains.length <= 32 && objects(d) <= 1521 && Buffer.byteLength(text(d)) <= 256 * 1024, id);
    assert.equal(d.kind, undefined);
    for (const chain of d.chains) {
      assert.ok(chain.length >= 2 && chain.length <= 2048, id);
      assert.ok(chain.every(p => p.length === 2 && p.every(finite)), id);
      // Right to left (solid side below) with at least 1 cm between points.
      assert.ok(chain.every((p, i) => i === 0 || (p[0] < chain[i - 1][0] && (p[0] - chain[i - 1][0]) ** 2 + (p[1] - chain[i - 1][1]) ** 2 >= 0.0001)), id);
    }
    assert.ok(d.chains[0][0][0] > x1 && d.chains.at(-1).at(-1)[0] < x0, id + ': chain ends outside the bounds');
    for (const h of d.hulls || []) {
      const v = h.vertices;
      assert.ok(v.length >= 3 && v.length <= 8 && v.every(p => p.every(finite)), id);
      v.forEach((p, i) => {
        const q = v[(i + 1) % v.length];
        v.forEach((r, j) => {if (j !== i && j !== (i + 1) % v.length) assert.ok((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0, id + ': convex CCW');});
      });
    }
    assert.ok((d.hulls || []).length <= 64, id);
  }
});

test('length and complexity vary independently with at least three accepted steps each', () => {
  const by = name => accepted.filter(c => c.dimension === name);
  const length = by('length'), segments = by('segments'), hulls = by('hulls');
  assert.ok(length.length >= 3 && segments.length >= 3 && hulls.length >= 3);
  assert.equal(new Set(length.map(c => c.segments)).size, 1);
  assert.equal(new Set(length.map(c => c.length_m)).size, length.length);
  assert.equal(new Set(segments.map(c => c.length_m)).size, 1);
  assert.equal(new Set(segments.map(c => c.segments)).size, segments.length);
  assert.equal(new Set(hulls.map(c => c.length_m + '/' + c.segments)).size, 1);
  assert.equal(new Set(hulls.map(c => c.objects)).size, hulls.length);
  assert.equal(Math.max(...accepted.map(c => c.objects)), 1521);
});

test('each rejected case breaks exactly the named limit', () => {
  const rejected = Object.fromEntries(all.filter(c => c.expect === 'rejected').map(c => [c.id, c]));
  assert.equal(rejected['reject-length-100km'].level.bounds[1], 100000);
  assert.equal(objects(rejected['reject-mesh-payload'].level), 1650);
  assert.equal(objects(rejected['reject-cpu'].level), 1522);
  assert.equal(rejected['reject-chain-2049'].level.chains[0].length, 2049);
  assert.equal(rejected['reject-chains-33'].level.chains.length, 33);
  assert.equal(rejected['reject-hulls-65'].level.hulls.length, 65);
  assert.equal(rejected['reject-hull-9'].level.hulls[0].vertices.length, 9);
  assert.ok(Buffer.byteLength(text(rejected['reject-text-256k'].level)) > 256 * 1024);
  for (const x of [1000, 1500, 2000, 4000, 98800]) assert.equal(rejected['start-' + x + 'm'].level.spawn[0], x);
  for (const c of Object.values(rejected)) assert.ok(c.reason === null ? c.id === 'reject-text-256k' : c.reason.length > 0);
});

test('committed phone samples equal the generator output', () => {
  for (const id of PHONE) {
    const c = accepted.find(x => x.id === id);
    assert.ok(c, id);
    assert.equal(fs.readFileSync(path.join(__dirname, '../../main/gym/samples', id + '.json'), 'utf8'), text(c.level) + '\n');
  }
});
