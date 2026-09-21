/* Cobalt model + gameplay-integration test. Run: node test-cobalt.js
   Loads the REAL baked mesh, car.js, map.js and checks that the player car is
   genuine geometry (right size, closed, outward-facing), that it drives, and
   that its collision hull matches the body.                               */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { THREE } = require('./tools/render.js');

const sandbox = { window: {}, THREE, console, Math, Object, Array, String, Number, Float32Array, Int16Array, Uint16Array, Uint8Array,
  atob: b => Buffer.from(b, 'base64').toString('binary'), requestAnimationFrame: () => {} };
sandbox.window.THREE = THREE;
vm.createContext(sandbox);
for (const f of ['assets/cars/cobalt-model.js', 'js/car.js', 'js/map.js', 'js/parking.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: f });
const { Car, VEHICLE_DEFS, COBALT_MODEL } = sandbox.window;

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + '   ' + x));
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
function mesh(part) { const p = dec(part.p, Int16Array), i = dec(part.i, Uint16Array); return { pos: Array.from(p, v => v / 1000), idx: Array.from(i) }; }
function volume(m) { // signed volume; > 0 means triangles wind outward
  let v = 0;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3, P = m.pos;
    v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return v;
}

console.log('\n=== 1. BAKED MODEL IS REAL GEOMETRY ===');
const names = COBALT_MODEL.parts.map(p => p.n);
['body', 'glass', 'trim', 'chrome', 'headlamp', 'taillamp', 'reverse', 'plate', 'interior'].forEach(n =>
  check('model has part: ' + n, names.includes(n)));
const parts = {}; COBALT_MODEL.parts.forEach(p => { parts[p.n] = mesh(p); });
const wparts = {}; COBALT_MODEL.wheel.forEach(p => { wparts[p.n] = mesh(p); });
check('body is a dense mesh, not a box (> 4000 triangles)', parts.body.idx.length / 3 > 4000, parts.body.idx.length / 3);
check('whole car under 14 000 triangles (mobile friendly)',
  Object.values(parts).reduce((t, m) => t + m.idx.length / 3, 0) < 14000);
let bad = 0, maxIdx = 0;
[...Object.values(parts), ...Object.values(wparts)].forEach(m => {
  m.pos.forEach(v => { if (!isFinite(v)) bad++; });
  m.idx.forEach(i => { maxIdx = Math.max(maxIdx, i - m.pos.length / 3 + 1); });
});
check('no NaN vertices and every index is valid', bad === 0 && maxIdx <= 0);
const all = [...parts.body.pos.keys()].length;
const bb = { x: [1e9, -1e9], y: [1e9, -1e9], z: [1e9, -1e9] };
['body', 'glass', 'trim'].forEach(n => { const P = parts[n].pos; for (let i = 0; i < P.length; i += 3) {
  bb.x = [Math.min(bb.x[0], P[i]), Math.max(bb.x[1], P[i])]; bb.y = [Math.min(bb.y[0], P[i + 1]), Math.max(bb.y[1], P[i + 1])]; bb.z = [Math.min(bb.z[0], P[i + 2]), Math.max(bb.z[1], P[i + 2])]; } });
check('length is Cobalt-sized (4.4-4.6 m)', bb.z[1] - bb.z[0] > 4.4 && bb.z[1] - bb.z[0] < 4.6, (bb.z[1] - bb.z[0]).toFixed(2));
check('width incl. mirrors is 1.7-2.2 m', bb.x[1] - bb.x[0] > 1.7 && bb.x[1] - bb.x[0] < 2.2, (bb.x[1] - bb.x[0]).toFixed(2));
check('height is 1.40-1.55 m', bb.y[1] > 1.4 && bb.y[1] < 1.55 && bb.y[0] >= 0, bb.y[1].toFixed(2));
check('body triangles wind outward (not inside-out)', volume(parts.body) > 0, volume(parts.body).toFixed(3));
check('tyre triangles wind outward', volume(wparts.w_tire) > 0, volume(wparts.w_tire).toFixed(4));
check('tyre radius is a 195/65 R15 (0.31-0.32 m)', (() => { let r = 0; const P = wparts.w_tire.pos; for (let i = 0; i < P.length; i += 3) r = Math.max(r, Math.hypot(P[i + 1], P[i + 2])); return r > 0.31 && r < 0.32; })());

console.log('\n=== 2. PLAYER CAR IN THE ENGINE ===');
const scene = new THREE.Scene();
const car = new Car(scene, 'cobalt');
car.setPosition(0, 0, 0);
const meshes = []; car.group.traverse(o => { if (o.isMesh) meshes.push(o); });
check('player car is the baked Cobalt (not the old loft)', car.shell && car.shell.name === 'body' && car.shell.geometry.tris.length / 9 === parts.body.idx.length / 3,
  car.shell && car.shell.geometry.tris.length / 9);
check('car added to the scene', scene.children.includes(car.group));
check('four wheels, each with tyre + alloy + disc + hub', Object.keys(car.wheels).length === 4 &&
  Object.values(car.wheels).every(w => { let n = 0; w.traverse(o => { if (o.isMesh) n++; }); return n === 4; }));
check('front wheels steer on pivots', Object.keys(car.steerPivots).sort().join() === 'fl,fr');
check('glass, head lamps, tail lamps, reverse lamp are wired', !!car.windows && car.headlights.length >= 1 && car.tailLights.length >= 1 && !!car.reverseLamp && car.beams.length === 2);
const w0 = car.wheels.fl.rotation.x;
for (let i = 0; i < 30; i++) car.update(1 / 60, { throttle: 1, steer: 1, brake: false }, []);
check('driving spins the wheels', car.wheels.fl.rotation.x !== w0);
check('steering turns the front pivots', Math.abs(car.steerPivots.fl.rotation.y) > 0.1, car.steerPivots.fl.rotation.y.toFixed(3));
car.update(1 / 60, { throttle: 0, steer: 0, brake: true }, []);
check('brake lights glow harder while braking', car.tailLights[0].material.emissiveIntensity > 1);
const all2 = {}; ['nexia', 'gentra', 'malibu', 'spark', 'damas'].forEach(k => { all2[k] = new Car(new THREE.Scene(), k); });
check('the other five vehicles still build', Object.keys(all2).length === 5);

console.log('\n=== 3. COLLISION HULL MATCHES THE BODY ===');
const L = VEHICLE_DEFS.cobalt.length / 2;
function drive(dir) {
  const c = new Car(new THREE.Scene(), 'cobalt');
  c.setPosition(0, 0, 0);                                   // heading 0 faces -Z
  const wall = { type: 'box', minX: -20, maxX: 20, minZ: dir > 0 ? -40 : 20, maxZ: dir > 0 ? -20 : 40 };
  for (let i = 0; i < 600; i++) c.update(1 / 60, { throttle: dir, steer: 0, brake: false }, [wall]);
  const tip = dir > 0 ? c.position.z - L : c.position.z + L;
  return { pen: dir > 0 ? wall.maxZ - tip : tip - wall.minZ, damage: c.damage };
}
const f = drive(1), r = drive(-1);
check('nose stops at the wall (penetration < 0.3 m)', f.pen < 0.3, f.pen.toFixed(2) + ' m');
check('tail stops at the wall (penetration < 0.3 m)', r.pen < 0.3, r.pen.toFixed(2) + ' m');
check('the hit registers damage', f.damage > 0 && r.damage > 0);
const side = new Car(new THREE.Scene(), 'cobalt'); side.setPosition(0, 0, 0);
for (let i = 0; i < 300; i++) side.update(1 / 60, { throttle: 1, steer: 0, brake: false }, [{ type: 'box', minX: 1.0, maxX: 5, minZ: -400, maxZ: 400 }]);
check('side of the car does not enter a wall it is scraping', side.position.x <= 1.0 - VEHICLE_DEFS.cobalt.width / 2 + 0.05, side.position.x.toFixed(2));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
