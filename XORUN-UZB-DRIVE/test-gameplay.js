/* Headless gameplay test. Stubs Three.js and runs the REAL car.js, map.js
   and parking.js. Run with: node test-gameplay.js  */
const fs = require('fs'), path = require('path'), vm = require('vm');

const { THREE } = require('./tools/render.js');
const Obj = THREE.Object3D;

const sandbox = { window: {}, THREE, console, Math, Object, Array, String, Number, Float32Array, requestAnimationFrame: () => {} };
sandbox.window.THREE = THREE;
vm.createContext(sandbox);
for (const f of ['car.js', 'map.js', 'parking.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', f), 'utf8'), sandbox, { filename: f });
}

const { Car, VEHICLE_DEFS, buildKichikIttifoqMap, ParkingChecker } = sandbox.window;

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + '   ' + x));

const scene = new Obj();
const map = buildKichikIttifoqMap(scene, { shadows: true });
const car = new Car(scene, 'cobalt');
const checker = new ParkingChecker(map.parkingZone);
const bay = map.parkingZone.center;

console.log('\n=== 1. WORLD ===');
check('map built with colliders', map.obstacles.length > 60, map.obstacles.length);
check('map exposes a parking zone and a spawn point', !!map.parkingZone && !!map.spawnPoint);
check('spawn point is clear of every obstacle', (() => {
  car.setPosition(map.spawnPoint.x, map.spawnPoint.z, map.spawnPoint.heading);
  return !car.update(0.016, { throttle: 0, steer: 0, brake: false }, map.obstacles).collided;
})());

console.log('\n=== 2. THE CAR (3D model) ===');
let meshCount = 0, shadowCasters = 0;
car.group.traverse(o => { if (o.isMesh) { meshCount++; if (o.castShadow) shadowCasters++; } });
check('Cobalt is a real lofted 3D body, not a box', (() => {
  const tris = car.shell.geometry.tris.length / 9;
  return tris > 250;
})(), (car.shell.geometry.tris.length / 9) + ' body triangles');
check('the car is assembled from many 3D meshes', meshCount > 25, meshCount + ' meshes');
check('the greenhouse produced real glass surfaces', car.windows.geometry.tris.length > 0,
  (car.windows.geometry.tris.length / 9) + ' glass triangles');
check('car casts shadows', shadowCasters > 30, shadowCasters);
check('car has 4 wheels', Object.keys(car.wheels).length === 4);
check('front wheels steer on their own pivots', Object.keys(car.steerPivots).length === 2);
check('car has headlights and beams', car.headlights.length === 2 && car.beams.length === 2);
check('car has brake lights', car.tailLights.length === 2);
check('all six Uzbek vehicles are defined', Object.keys(VEHICLE_DEFS).length === 6, Object.keys(VEHICLE_DEFS).join(','));
check('only the Cobalt starts unlocked',
  Object.keys(VEHICLE_DEFS).filter(k => VEHICLE_DEFS[k].unlocked).join() === 'cobalt');
check('every other vehicle also builds without error', (() => {
  try { Object.keys(VEHICLE_DEFS).forEach(k => new Car(new Obj(), k)); return true; }
  catch (e) { console.log('     ' + e.message); return false; }
})());

console.log('\n=== 3. DRIVING (W A S D) ===');
car.setPosition(0, -70, Math.PI);
const z0 = car.position.z;
for (let i = 0; i < 120; i++) car.update(1 / 60, { throttle: 1, steer: 0, brake: false }, map.obstacles);
check('W drives forward, toward the parking side of the map', car.position.z > z0 + 5, `z ${z0} -> ${car.position.z.toFixed(1)}`);
check('speed is capped at the vehicle limit', car.speed > 0 && car.speed <= car.maxSpeed + 0.01, car.speed.toFixed(2));
check('gear reads D when moving forward', car.gear === 'D');

for (let i = 0; i < 150; i++) car.update(1 / 60, { throttle: 0, steer: 0, brake: true }, map.obstacles);
check('Space brakes to a complete stop', car.speed === 0);

car.setPosition(0, -70, Math.PI);
for (let i = 0; i < 90; i++) car.update(1 / 60, { throttle: 1, steer: 1, brake: false }, map.obstacles);
const leftX = car.position.x;
car.setPosition(0, -70, Math.PI);
for (let i = 0; i < 90; i++) car.update(1 / 60, { throttle: 1, steer: -1, brake: false }, map.obstacles);
const rightX = car.position.x;
check('A and D steer to opposite sides', Math.sign(leftX) !== Math.sign(rightX) && Math.abs(leftX) > 0.5,
  `A->x=${leftX.toFixed(2)} D->x=${rightX.toFixed(2)}`);
check('front wheels visually turn with the steering', Math.abs(car.steerPivots.fl.rotation.y) > 0.1);

// Decisive check: does A actually move the car to the LEFT OF THE SCREEN?
// Three.js cameras look down their local -Z, so for a chase camera looking
// toward +Z the camera's right axis is world -X. Screen-x is computed the
// same way the renderer does it.
function screenX(carPos, camHeading, camPos) {
  const fwd = [-Math.sin(camHeading), 0, -Math.cos(camHeading)];
  const right = [-fwd[2], 0, fwd[0]];       // cross(fwd, up) — a Three.js
                                            // camera looking toward +Z has
                                            // its right axis along world -X
  const d = [carPos.x - camPos[0], 0, carPos.z - camPos[2]];
  const vx = d[0] * right[0] + d[2] * right[2];
  const vz = d[0] * fwd[0] + d[2] * fwd[2];
  return vx / Math.max(vz, 0.001);
}
(function () {
  const camAt = [0, 0, -70 - 9.2 * Math.cos(Math.PI) * -1];
  const camPos = [0, 4.4, -70 - (-Math.cos(Math.PI)) * 9.2];
  car.setPosition(0, -70, Math.PI);
  for (let i = 0; i < 90; i++) car.update(1 / 60, { throttle: 1, steer: 1, brake: false }, map.obstacles);
  const sxLeft = screenX(car.position, Math.PI, camPos);
  car.setPosition(0, -70, Math.PI);
  for (let i = 0; i < 90; i++) car.update(1 / 60, { throttle: 1, steer: -1, brake: false }, map.obstacles);
  const sxRight = screenX(car.position, Math.PI, camPos);
  check('A moves the car toward the LEFT of the screen', sxLeft < 0, 'screenX=' + sxLeft.toFixed(3));
  check('D moves the car toward the RIGHT of the screen', sxRight > 0, 'screenX=' + sxRight.toFixed(3));
})();

car.setPosition(0, -70, Math.PI);
for (let i = 0; i < 90; i++) car.update(1 / 60, { throttle: -1, steer: 0, brake: false }, map.obstacles);
check('S reverses', car.position.z < -70);
check('gear reads R in reverse', car.gear === 'R');
check('reverse is slower than forward', car.reverseMaxSpeed < car.maxSpeed);

console.log('\n=== 4. COLLISION ===');
car.damage = 0;
car.setPosition(4, 16, -Math.PI / 2);
let hit = false;
for (let i = 0; i < 400 && !hit; i++) hit = car.update(1 / 60, { throttle: 1, steer: 0, brake: false }, map.obstacles).collided;
check('car hits the roadside buildings', hit);
check('impact causes damage', car.damage > 0, car.damage.toFixed(1));
check('car does not pass through the building', car.position.x < 12, 'x=' + car.position.x.toFixed(2));

car.damage = 0;
car.setPosition(0, 100, Math.PI);
for (let i = 0; i < 2500; i++) car.update(1 / 60, { throttle: 1, steer: 0, brake: false }, map.obstacles);
check('car cannot leave the map', Math.abs(car.position.z) < 126, 'z=' + car.position.z.toFixed(1));

console.log('\n=== 5. PARKING DETECTION ===');
function tryPark(x, z, heading, speed, ticks = 120) {
  checker.reset();
  car.setPosition(x, z, heading);
  car.speed = speed || 0;
  let done = false, last = null;
  for (let i = 0; i < ticks; i++) { last = checker.update(car, 1 / 60); if (last.justCompleted) done = true; }
  return { done, last };
}
check('parked correctly -> COMPLETED', tryPark(bay.x, bay.z, Math.PI, 0).done);
check('parked crooked -> rejected', !tryPark(bay.x, bay.z, Math.PI + 1.1, 0).done);
check('outside the bay -> rejected', !tryPark(bay.x + 14, bay.z, Math.PI, 0).done);
check('rolling through the bay -> rejected', !tryPark(bay.x, bay.z, Math.PI, 8, 50).done);
check('reverse-parked -> COMPLETED', tryPark(bay.x, bay.z, 0, 0).done);
check('slightly off-centre but square -> COMPLETED', tryPark(bay.x + 1.4, bay.z - 1.5, Math.PI + 0.2, 0).done);
const neat = tryPark(bay.x, bay.z, Math.PI, 0);
const sloppy = tryPark(bay.x + 1.8, bay.z + 2.5, Math.PI + 0.4, 0);
check('accuracy rewards a neater park', neat.last.accuracy > sloppy.last.accuracy,
  neat.last.accuracy.toFixed(2) + ' vs ' + sloppy.last.accuracy.toFixed(2));

console.log('\n=== 6. FULL RUN: START -> DRIVE -> PARK ===');
car.setPosition(map.spawnPoint.x, map.spawnPoint.z, map.spawnPoint.heading);
car.damage = 0;
checker.reset();

const route = [
  { x: 0, z: -20 }, { x: 0, z: 40 }, { x: -2, z: 70 },
  { x: bay.x, z: bay.z - 9 }, { x: bay.x, z: bay.z }
];
let wp = 0, crashes = 0, seconds = 0;
for (let i = 0; i < 60 * 150; i++) {
  const t = route[wp];
  const dx = t.x - car.position.x, dz = t.z - car.position.z;
  const dist = Math.hypot(dx, dz);
  const last = wp === route.length - 1;
  if (!last && dist < 4) { wp++; continue; }

  let err = Math.atan2(-dx, -dz) - car.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;

  const targetSpeed = last
    ? Math.min(2.5, Math.max(0, (dist - 0.25) * 1.6))
    : Math.min(Math.abs(err) > 0.5 ? 5 : 12, dist * 1.2);

  const r = car.update(1 / 60, {
    throttle: car.speed < targetSpeed - 0.2 ? 0.7 : 0,
    steer: Math.max(-1, Math.min(1, err * 2.5)),
    brake: car.speed > targetSpeed + 0.4
  }, map.obstacles);
  if (r.collided) crashes++;
  seconds += 1 / 60;
  if (checker.update(car, 1 / 60).justCompleted) break;
}
check('a normal driving route reaches the bay and completes', checker.completed,
  `x=${car.position.x.toFixed(1)} z=${car.position.z.toFixed(1)}`);
check('the route from START to PARKING is not blocked', crashes < 60, 'collision frames=' + crashes);
check('the run finishes in a sensible time', seconds > 5 && seconds < 120, seconds.toFixed(1) + 's');
check('a clean run takes no damage', car.damage < 5, car.damage.toFixed(1));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
