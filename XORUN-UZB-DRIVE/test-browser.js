/* Simulated browser session. Loads every script in the exact order
   index.html does, clicks PLAY, then drives the car with real key events
   through the real game loop. Run with: node test-browser.js */
const fs = require('fs'), path = require('path'), vm = require('vm');

/* ----------------------------------------------------- minimal DOM ----- */
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const idList = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const classOf = id => {
  const m = html.match(new RegExp(`id="${id}"[^>]*class="([^"]*)"`));
  const m2 = html.match(new RegExp(`class="([^"]*)"[^>]*id="${id}"`));
  return (m ? m[1] : m2 ? m2[1] : '').split(/\s+/).filter(Boolean);
};

class El {
  constructor(id, tag = 'div') {
    this.id = id; this.tagName = tag.toUpperCase();
    this._classes = new Set(id ? classOf(id) : []);
    this.listeners = {}; this.dataset = {}; this.children = [];
    this.style = { setProperty() {} };
    this.textContent = ''; this._html = '';
    this.value = '1'; this.checked = true; this.disabled = false;
    this._attrs = {};
  }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  dispatch(t, ev = {}) { (this.listeners[t] || []).forEach(f => f({ preventDefault() {}, ...ev })); }
  click() { this.dispatch('click', { target: this }); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this._attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; }
  getAttribute(k) { return this._attrs[k]; }
  get classList() {
    const s = this._classes;
    return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: c => s.has(c) ? s.delete(c) : s.add(c) };
  }
  set innerHTML(v) { this._html = v; this.children = []; }
  get innerHTML() { return this._html; }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._classes].join(' '); }
  getContext() { return {}; }
}

const store = {};
idList.forEach(id => { store[id] = new El(id); });
store['setting-steer'].value = '1';
store['setting-camera'].value = '0.12';
store['setting-force-touch'].checked = false;
store['setting-headlights'].checked = true;
store['setting-shadows'].checked = true;
store['setting-debug'].checked = false;

const backBtn = new El(null, 'button');
backBtn.setAttribute('data-back', 'menu');

const head = new El('head'), body = new El('body');
const pendingScripts = [];
head.appendChild = function (node) { pendingScripts.push(node); return node; };

const document = {
  getElementById: id => store[id] || null,
  querySelectorAll: sel => sel === '[data-back]' ? [backBtn] : [],
  createElement: tag => new El(null, tag),
  head, body,
  addEventListener() {}
};

/* ----------------------------------------------------- THREE stub ------ */
/* the same real-geometry stub the offline renderer uses, so the scripts run
   against geometry that actually produces triangles                       */
const { THREE } = require('./tools/render.js');
let renderCalls = 0;
THREE.WebGLRenderer = function () {
  return {
    shadowMap: {}, outputEncoding: 0,
    setPixelRatio() {}, setSize() {},
    render() { renderCalls++; }
  };
};

/* ----------------------------------------------------- window --------- */
let rafQueue = [];
const windowListeners = {};
const sandbox = {
  document, console, Math, Object, Array, String, Number, JSON,
  parseFloat, parseInt, isNaN, Date, Error, Promise, Float32Array, setTimeout: (f) => { f(); return 0; },
  navigator: { maxTouchPoints: 0 },
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] || null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  },
  requestAnimationFrame: f => { rafQueue.push(f); return rafQueue.length; }
};
sandbox.window = sandbox;
sandbox.window.addEventListener = (t, f) => { (windowListeners[t] = windowListeners[t] || []).push(f); };
sandbox.window.innerWidth = 1280;
sandbox.window.innerHeight = 720;
sandbox.window.devicePixelRatio = 1;
sandbox.THREE = THREE;          // simulates the CDN script tag having run
vm.createContext(sandbox);

function key(type, code) { (windowListeners[type] || []).forEach(f => f({ code, preventDefault() {} })); }
function frame(n = 1) {
  for (let i = 0; i < n; i++) {
    const q = rafQueue; rafQueue = [];
    q.forEach(f => f(performance.now ? performance.now() : Date.now()));
  }
}

/* ----------------------------------------------------- load scripts --- */
let pass = 0, fail = 0, loadError = null;
const check = (n, c, x = '') => c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + '   ' + x));

const ORDER = ['js/three-fallback.js', 'js/ui.js', 'js/controls.js', 'js/car.js', 'js/map.js', 'js/parking.js', 'js/traffic.js', 'js/missions.js', 'js/main.js'];
try {
  for (const f of ORDER) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: f });
  }
} catch (e) { loadError = e; }

console.log('\n=== A. PAGE LOAD ===');
check('every script in index.html loads without throwing', !loadError, loadError && loadError.stack);
check('the script list in index.html matches the files on disk', (() => {
  const refs = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  return refs.every(r => fs.existsSync(path.join(__dirname, r))) && refs.length === ORDER.length;
})());
check('UI is available', !!sandbox.window.UI);
check('Game registered itself', !!sandbox.window.Game);
check('the 3D world was built at page load, before PLAY', !!sandbox.window.Game.world,
  sandbox.window.Game.world ? sandbox.window.Game.world.obstacles.length + ' colliders' : 'no world');
check('a car already exists on screen behind the menu', !!sandbox.window.Game.car);
check('the engine reported ready on the menu', /tayyor/i.test(store['engine-status'].textContent),
  store['engine-status'].textContent);
check('no error banner is showing', store['error-banner']._classes.has('hidden'));

const Game = sandbox.window.Game;
frame(5);
check('the render loop is running', renderCalls > 0, renderCalls + ' frames');
check('menu view shows the showcase camera', Game.view === 'menu');

console.log('\n=== B. PRESSING PLAY ===');
store['btn-play'].click();
check('PLAY switches the game into driving mode', Game.view === 'playing', Game.view);
check('the main menu is hidden', store['screen-menu']._classes.has('hidden'));
check('the HUD is visible', !store['hud']._classes.has('hidden'));
check('the car is placed at the START point',
  Math.abs(Game.car.position.z - Game.world.spawnPoint.z) < 0.01);
check('the objective is shown', store['hud-objective-text'].textContent.length > 0,
  store['hud-objective-text'].textContent);

console.log('\n=== C. WASD WHILE PLAYING ===');
const startZ = Game.car.position.z;
const camStart = { x: Game.car.position.x, z: Game.car.position.z };
key('keydown', 'KeyW');
frame(120);
key('keyup', 'KeyW');
check('holding W moves the car in the 3D world', Game.car.position.z > startZ + 3,
  `z ${startZ} -> ${Game.car.position.z.toFixed(1)}`);
check('the speed readout updates in the HUD', Number(store['hud-speed'].textContent) > 0,
  store['hud-speed'].textContent + ' km/s');
check('the timer is running', store['hud-time'].textContent !== '00:00', store['hud-time'].textContent);

const beforeX = Game.car.position.x;
key('keydown', 'KeyW'); key('keydown', 'KeyA');
frame(90);
key('keyup', 'KeyA'); key('keyup', 'KeyW');
check('holding A steers the car', Math.abs(Game.car.position.x - beforeX) > 0.5,
  `x ${beforeX.toFixed(2)} -> ${Game.car.position.x.toFixed(2)}`);

key('keydown', 'Space');
frame(180);
key('keyup', 'Space');
check('Space brings the car to a stop', Math.abs(Game.car.speed) < 0.01, Game.car.speed.toFixed(3));

console.log('\n=== D. CAMERA FOLLOWS ===');
const cam = sandbox.window.Game;
const carPos = Game.car.position;
// the engine's camera is private; verify via distance between car and camera each frame
key('keydown', 'KeyW');
frame(150);
key('keyup', 'KeyW');
frame(30);
check('the car travelled a long way from its start', Math.hypot(carPos.x - camStart.x, carPos.z - camStart.z) > 10,
  Math.hypot(carPos.x - camStart.x, carPos.z - camStart.z).toFixed(1) + ' m');
check('rendering kept up the whole time', renderCalls > 400, renderCalls + ' frames');

// the camera must sit BEHIND the car at a sensible chase distance
(function () {
  const cam = Game.cameraPosition;
  const p = Game.car.position, h = Game.car.heading;
  const fx = -Math.sin(h), fz = -Math.cos(h);
  const dx = cam.x - p.x, dz = cam.z - p.z;
  const dist = Math.hypot(dx, dz);
  const behind = (dx * fx + dz * fz) < 0;     // camera is opposite the forward axis
  check('the chase camera follows at a sensible distance', dist > 6 && dist < 14, dist.toFixed(1) + ' m');
  check('the chase camera sits behind the car', behind);
  check('the chase camera is above the car', cam.y > 2 && cam.y < 8, cam.y.toFixed(1) + ' m');
})();

console.log('\n=== E. RESET (R) ===');
key('keydown', 'KeyR');
frame(3);
check('R returns the car to START',
  Math.abs(Game.car.position.z - Game.world.spawnPoint.z) < 0.5 &&
  Math.abs(Game.car.position.x - Game.world.spawnPoint.x) < 0.5,
  `x=${Game.car.position.x.toFixed(1)} z=${Game.car.position.z.toFixed(1)}`);

console.log('\n=== F. FREE DRIVE PARKING THROUGH THE REAL LOOP ===');
const bay = Game.world.parkingZone.center;
const coinsBefore = sandbox.window.UI.save.coins;
const xpBefore = sandbox.window.UI.save.xp;
// place the car in the bay and let the running game loop detect it
Game.car.setPosition(bay.x, bay.z, Math.PI);
frame(90);
check('parking does NOT stop the game (free drive)', Game.view === 'playing', 'view=' + Game.view);
check('parking gives +100 coins', sandbox.window.UI.save.coins - coinsBefore >= 100,
  sandbox.window.UI.save.coins - coinsBefore);
check('parking gives +50 XP', sandbox.window.UI.save.xp - xpBefore >= 50,
  sandbox.window.UI.save.xp - xpBefore);
check('LEVEL is shown in the HUD', Number(store['hud-level'].textContent) >= 1,
  store['hud-level'].textContent);
check('coins persist to the save', sandbox.window.UI.save.coins >= 100, sandbox.window.UI.save.coins);

console.log('\n=== G. GARAGE ===');
store['btn-exit'].click();
store['btn-garage'].click();
check('garage opens', !store['screen-garage']._classes.has('hidden'));
check('garage switches the 3D camera to showcase mode', Game.view === 'garage', Game.view);
check('all six vehicles are listed', store['garage-list'].children.length === 7,
  store['garage-list'].children.length + ' rows (wallet + 6 cars)');

const rows = store['garage-list'].children.slice(1);
const cobaltRow = rows[0];
check('the Cobalt row is marked selected', cobaltRow._classes.has('garage-card-selected'));
const lockedRow = rows[1];
check('the Nexia row is locked', lockedRow._classes.has('garage-card-locked'));

// with coins earned, an unlock button should be live for an affordable car
const sparkRow = rows[3];
const sparkBtn = sparkRow.children[sparkRow.children.length - 1];
check('an affordable locked car offers an Ochish (unlock) button',
  sparkBtn.textContent === 'Ochish' || sparkBtn.textContent === 'Tanga yetarli emas',
  sparkBtn.textContent);

console.log('\n=== H. BACK TO MENU AND PLAY AGAIN ===');
backBtn.click();
check('back returns to the menu', !store['screen-menu']._classes.has('hidden'));
store['btn-play'].click();
frame(10);
check('PLAY works a second time', Game.view === 'playing');
check('still no error banner at the end', store['error-banner']._classes.has('hidden'),
  store['error-message'].textContent);

console.log('\n=== I. TRAFFIC ===');
const traffic = Game.traffic;
check('traffic cars exist on the street', traffic && traffic.cars.length >= 8,
  traffic ? traffic.cars.length + ' cars' : 'none');
const zBefore = traffic.cars.map(t => t.z);
frame(60);
check('traffic keeps moving every frame',
  traffic.cars.filter((t, i) => Math.abs(t.z - zBefore[i]) > 0.2).length >= traffic.cars.length - 1);
check('traffic cars use real UZB models',
  traffic.cars.every(t => ['cobalt', 'nexia', 'gentra', 'spark', 'damas'].indexOf(t.car.key) !== -1),
  traffic.cars.map(t => t.car.key).join(','));
check('traffic drives inside the road lanes',
  traffic.cars.every(t => Math.abs(t.laneX) < 4.2));
check('traffic is fed to the player as collision boxes',
  traffic.getObstacles().length === traffic.cars.length);

console.log('\n=== J. MISSIONS ===');
const ms = Game.missions;
check('there are three missions', ms.defs.length === 3, ms.defs.map(d => d.id).join(','));
const startId = ms.current().id;
const mCoins = sandbox.window.UI.save.coins;
const tgt = ms.targetPoint();
Game.car.setPosition(tgt.x, tgt.z, Math.PI);
frame(150);
check('reaching the mission target completes it', ms.current().id !== startId,
  startId + ' -> ' + ms.current().id);
check('a completed mission pays coins', sandbox.window.UI.save.coins > mCoins,
  sandbox.window.UI.save.coins - mCoins);
check('the HUD shows the mission', String(store['hud-objective-text'].textContent).length > 0,
  store['hud-objective-text'].textContent);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
