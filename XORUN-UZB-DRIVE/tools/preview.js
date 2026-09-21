/* tools/preview.js — renders the real game assets to PNGs so they can be
   inspected without a browser.  Usage: node tools/preview.js            */

const fs = require('fs'), path = require('path'), vm = require('vm');
const { THREE, renderScene, writePNG, Object3D } = require('./render.js');

const root = path.join(__dirname, '..');
const sandbox = { window: {}, THREE, console, Math, Object, Array, String, Number, Float32Array, requestAnimationFrame: () => {} };
sandbox.window.THREE = THREE;
vm.createContext(sandbox);
for (const f of ['car.js', 'map.js', 'parking.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), sandbox, { filename: f });
}
const { Car, buildKichikIttifoqMap } = sandbox.window;

const outDir = path.join(root, 'tools', 'preview');
fs.mkdirSync(outDir, { recursive: true });

function shot(name, scene, opts) {
  const img = renderScene(scene, opts);
  writePNG(path.join(outDir, name + '.png'), img);
  console.log(`  ${name}.png  —  ${img.stats.triangles} tris, ${img.stats.drawn} drawn, ${img.stats.culled} back-faces culled`);
}

/* ---------------------------------------------------- 1. the car alone */
{
  const scene = new Object3D();
  // simple ground so the car is not floating in the void
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x6f7a58 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const car = new Car(scene, 'cobalt');
  car.setPosition(0, 0, 0);

  shot('car-hero', scene, {
    width: 900, height: 520,
    eye: [4.6, 2.0, -5.2], target: [0, 0.75, 0], fov: 42, fogNear: 200, fogFar: 400
  });
  shot('car-side', scene, {
    width: 900, height: 420,
    eye: [9.5, 1.3, 0.2], target: [0, 0.8, 0], fov: 36, fogNear: 200, fogFar: 400
  });
  shot('car-front', scene, {
    width: 760, height: 480,
    eye: [0.4, 1.5, -8], target: [0, 0.8, 0], fov: 32, fogNear: 200, fogFar: 400
  });
  shot('car-rear', scene, {
    width: 760, height: 480,
    eye: [-0.6, 1.6, 8], target: [0, 0.8, 0], fov: 32, fogNear: 200, fogFar: 400
  });
}

/* ------------------------------------------- 2. gameplay chase camera */
function chase(scene, car, dist = 9.2, height = 4.4, look = 5.5) {
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  return {
    eye: [car.position.x - fx * dist, height, car.position.z - fz * dist],
    target: [car.position.x + fx * look, 1.15, car.position.z + fz * look]
  };
}

{
  const scene = new Object3D();
  const map = buildKichikIttifoqMap(scene, { shadows: true });
  const car = new Car(scene, 'cobalt');

  // at the start line
  car.setPosition(map.spawnPoint.x, map.spawnPoint.z, map.spawnPoint.heading);
  shot('drive-start', scene, Object.assign({ width: 960, height: 560, fov: 60 }, chase(scene, car)));

  // approaching the junction
  car.setPosition(0.6, -26, Math.PI);
  shot('drive-junction', scene, Object.assign({ width: 960, height: 560, fov: 60 }, chase(scene, car)));

  // among the mahalla houses
  car.setPosition(-1.2, 34, Math.PI + 0.12);
  shot('drive-mahalla', scene, Object.assign({ width: 960, height: 560, fov: 60 }, chase(scene, car)));

  // turning into the car park
  car.setPosition(-5.5, 80, Math.PI - 0.5);
  shot('drive-parking-approach', scene, Object.assign({ width: 960, height: 560, fov: 60 }, chase(scene, car)));

  // parked in the yellow bay
  const bay = map.parkingZone.center;
  car.setPosition(bay.x, bay.z, Math.PI);
  shot('parked', scene, Object.assign({ width: 960, height: 560, fov: 60 }, chase(scene, car, 10, 5.2, 4)));

  // a high overview of the whole level
  shot('overview', scene, {
    width: 960, height: 620, fov: 55,
    eye: [46, 52, -40], target: [0, 0, 20], fogNear: 150, fogFar: 420
  });
}

/* -------------------------------------------------- 3. the whole garage */
{
  const scene = new Object3D();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x4a5340 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const keys = Object.keys(sandbox.window.VEHICLE_DEFS);
  keys.forEach((k, i) => {
    const c = new Car(scene, k);
    c.setPosition((i - (keys.length - 1) / 2) * 3.1, 0, 0);
  });

  shot('garage-lineup', scene, {
    width: 1000, height: 420, fov: 40,
    eye: [3, 5.5, -16], target: [0, 0.7, 0], fogNear: 200, fogFar: 400
  });
}

console.log('\nPreviews written to tools/preview/\n');
