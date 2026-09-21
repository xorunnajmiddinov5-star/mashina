/* ==========================================================================
   main.js
   The engine.

   The world is built as soon as Three.js is available — while you are still
   looking at the menu. The menu sits on a transparent overlay above the live
   3D scene, so PLAY does not "load a level": it simply moves the camera
   behind the car and gives you the controls. Nothing to fail in between.

   window.Game API: start / stop / reset / setView / previewVehicle /
   applySettings.
   ========================================================================== */

(function () {
  'use strict';

  var renderer, scene, camera, sun, hemi;
  var input = null;
  var world = null;      // map data
  var car = null;
  var parking = null;
  var traffic = null;
  var missions = null;
  var colliders = null;   // world.obstacles + traffic (har kadrda yangilanadi)
  var staticCount = 0;
  var parkCooldown = false;

  var view = 'menu';     // 'menu' | 'garage' | 'playing' | 'completed'
  var settings = {
    steerSensitivity: 1, cameraSmoothing: 0.12, forceTouch: false,
    headlights: true, shadows: true, debug: false
  };

  var elapsed = 0;
  var sessionCoins = 0;
  var score = 0;
  var clock = null;
  var orbitAngle = 0;

  var camPos = null, camLook = null, camReady = false;
  var frames = 0, fpsTime = 0, fps = 0;

  // ------------------------------------------------------------- bootstrap
  function boot() {
    try {
      buildRenderer();
      buildLights();
      world = window.buildKichikIttifoqMap(scene, { shadows: settings.shadows });
      parking = new ParkingChecker(world.parkingZone);
      traffic = new TrafficSystem(scene, world, { shadows: settings.shadows });
      missions = new MissionSystem(scene, world);
      missions.onComplete = function (def) {
        UI.addReward(def.coins, def.xp, 'MISSION BAJARILDI');
      };
      missions.onFail = function () { UI.toast('Vaqt tugadi \u2014 qaytadan urining'); };
      colliders = world.obstacles.slice();
      staticCount = colliders.length;
      input = new InputManager();
      spawnCar(UI.selectedVehicle);
      clock = new THREE.Clock();
      window.addEventListener('resize', resize);
      resize();
      animate();
      UI.setEngineReady('Three.js r' + THREE.REVISION + ' \u00b7 ' + world.obstacles.length + ' obyekt \u00b7 tayyor');
      console.log('[XORUN] world ready:', world.obstacles.length, 'colliders, Three.js r' + THREE.REVISION);
    } catch (err) {
      console.error('[XORUN] boot failed:', err);
      UI.showError('3D sahna qurilmadi: ' + err.message);
    }
  }

  function buildRenderer() {
    var canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputEncoding' in renderer && typeof THREE.sRGBEncoding !== 'undefined') {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ccfdd);
    scene.fog = new THREE.Fog(0xa8d4de, 80, 230);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
    camPos = new THREE.Vector3(0, 8, 10);
    camLook = new THREE.Vector3(0, 1, 0);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function buildLights() {
    hemi = new THREE.HemisphereLight(0xd8eef5, 0x6c6a4a, 0.68);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    sun = new THREE.DirectionalLight(0xfff0cf, 1.2);
    sun.position.set(45, 65, 25);
    sun.castShadow = settings.shadows;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0016;
    scene.add(sun);
    scene.add(sun.target);
  }

  function resize() {
    if (!renderer || !camera) return;
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function spawnCar(key) {
    if (car) car.dispose();
    car = new Car(scene, key);
    car.setHeadlights(settings.headlights);
    car.setShadows(settings.shadows);
    var sp = world.spawnPoint;
    car.setPosition(sp.x, sp.z, sp.heading);
    camReady = false;
  }

  // ------------------------------------------------------------- API
  function start(vehicleKey, newSettings) {
    if (newSettings) settings = newSettings;
    if (!car || car.key !== vehicleKey) spawnCar(vehicleKey);

    var sp = world.spawnPoint;
    car.setPosition(sp.x, sp.z, sp.heading);
    car.damage = 0;
    car.setHeadlights(settings.headlights);

    parking.reset();
    parkCooldown = false;
    missions.reset();
    if (traffic) traffic.clearAround(sp.x, sp.z, 14);
    elapsed = 0;
    sessionCoins = 0;
    score = 0;

    input.releaseAll();
    input.consumeReset();
    input.enabled = true;

    view = 'playing';
    camReady = false;
    updateChaseCamera(1);

    UI.updateHUD({ speedKmh: 0, gear: 'N', time: 0, damage: 0 });
    UI.setMission('FREE DRIVE', 'Erkin haydang \u2014 mission ixtiyoriy', 0, 0, null);
    UI.toast('FREE DRIVE \u2014 erkin haydang');
  }

  function stop() {
    view = 'menu';
    if (input) { input.enabled = false; input.releaseAll(); }
    if (car && world) {
      var sp = world.spawnPoint;
      car.setPosition(sp.x, sp.z, sp.heading);
      car.damage = 0;
    }
    camReady = false;
  }

  function reset() {
    if (!car || !world) return;
    var sp = world.spawnPoint;
    car.setPosition(sp.x, sp.z, sp.heading);
    car.damage = 0;
    parking.reset();
    parkCooldown = false;
    camReady = false;
    UI.hideResult();
    if (traffic) traffic.clearAround(sp.x, sp.z, 14);
    if (view === 'completed') { view = 'playing'; elapsed = 0; input.enabled = true; }
  }

  function setView(name) {
    if (view === 'playing' || view === 'completed') return;
    view = name === 'garage' ? 'garage' : 'menu';
    camReady = false;
  }

  function previewVehicle(key) {
    if (!world) return;
    spawnCar(key);
    view = 'garage';
    camReady = false;
  }

  function applySettings(s) {
    settings = s || settings;
    if (car) {
      car.setHeadlights(settings.headlights);
      car.setShadows(settings.shadows);
    }
    if (traffic) traffic.cars.forEach(function (t) { t.car.setShadows(settings.shadows); });
    if (renderer) renderer.shadowMap.enabled = settings.shadows;
    if (sun) sun.castShadow = settings.shadows;
  }

  // ------------------------------------------------------------- gameplay
  function distanceToBay() {
    var c = world.parkingZone.center;
    return Math.sqrt(Math.pow(car.position.x - c.x, 2) + Math.pow(car.position.z - c.z, 2));
  }

  /**
   * To'g'ri park qilinganda mukofot beriladi, lekin o'yin TO'XTAMAYDI —
   * bu FREE DRIVE: player park qilgandan keyin ham haydashda davom etadi.
   */
  function awardParking(accuracy) {
    var coins = 100;
    var xp = 50;
    sessionCoins += coins;
    score += 100 + Math.round(accuracy * 100);
    UI.addReward(coins, xp, 'PARKING OK');
    parkCooldown = true;
  }

  // ------------------------------------------------------------- loop
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.1);

    frames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }

    if (traffic) traffic.update(dt, car);

    if (view === 'playing') {
      stepGameplay(dt);
      updateChaseCamera(dt);
    } else if (view === 'completed') {
      updateChaseCamera(dt);
    } else {
      updateShowcaseCamera(dt);
    }

    followSun();
    renderer.render(scene, camera);
  }

  function stepGameplay(dt) {
    elapsed += dt;

    if (input.consumeReset()) reset();

    var raw = input.getDrivingInput();
    var drive = {
      throttle: raw.throttle,
      steer: raw.steer * settings.steerSensitivity,
      brake: raw.brake
    };

    // statik to'siqlar + harakatdagi traffic
    colliders.length = staticCount;
    var moving = traffic.getObstacles();
    for (var i = 0; i < moving.length; i++) colliders.push(moving[i]);

    var res = car.update(dt, drive, colliders);
    if (res.collided && res.impact > 0.05) UI.flashCollision(res.impact);

    var dist = distanceToBay();
    var state = parking.update(car, dt);

    // parking mukofoti — majburiy emas, xohlagan paytda qilish mumkin
    if (state.justCompleted && !parkCooldown) awardParking(parking.bestAccuracy || state.accuracy);
    if (parkCooldown && dist > 14) { parking.reset(); parkCooldown = false; }

    var m = missions.update(dt, car, state);
    UI.setMission(m.title, m.text, m.progress, m.distance, m.timeLeft);
    UI.setArrow(bearingTo(missions.targetPoint()), m.distance > 5);

    UI.updateHUD({
      speedKmh: car.speedKmh,
      gear: car.gear,
      time: elapsed,
      damage: car.damage
    });

    if (settings.debug) {
      UI.setDebug([
        'FPS ' + fps,
        'pos x=' + car.position.x.toFixed(1) + ' z=' + car.position.z.toFixed(1),
        'speed ' + Math.round(car.speedKmh) + ' km/s',
        'mission ' + m.id + '  dist ' + m.distance.toFixed(1) + ' m',
        'bay dist ' + dist.toFixed(1) + '  inside=' + state.insideBoundary,
        'colliders ' + colliders.length + ' (traffic ' + moving.length + ')'
      ]);
    }
  }

  /** Angle (degrees, clockwise from straight ahead) toward the parking bay. */
  function bearingTo(c) {
    var relX = c.x - car.position.x;
    var relZ = c.z - car.position.z;
    var fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
    var rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    var forward = relX * fx + relZ * fz;
    var right = relX * rx + relZ * rz;
    return Math.atan2(right, forward) * 180 / Math.PI;
  }

  // ------------------------------------------------------------- cameras
  function updateChaseCamera(dt) {
    if (!car) return;
    var fx = -Math.sin(car.heading);
    var fz = -Math.cos(car.heading);

    // pull back and rise a little with speed, so fast driving feels faster
    var speedT = Math.min(Math.abs(car.speed) / car.maxSpeed, 1);
    var dist = 9.2 + speedT * 1.8;
    var height = 4.4 + speedT * 0.5;

    var targetPos = new THREE.Vector3(
      car.position.x - fx * dist,
      height,
      car.position.z - fz * dist
    );
    var targetLook = new THREE.Vector3(
      car.position.x + fx * 5.5,
      1.15,
      car.position.z + fz * 5.5
    );

    if (!camReady) {
      camPos.copy(targetPos);
      camLook.copy(targetLook);
      camReady = true;
    } else {
      var t = 1 - Math.pow(1 - settings.cameraSmoothing, dt * 60);
      camPos.lerp(targetPos, t);
      camLook.lerp(targetLook, t);
    }

    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  /** Slow orbit used behind the menu and in the garage. */
  function updateShowcaseCamera(dt) {
    if (!car) return;
    var garage = view === 'garage';
    orbitAngle += dt * (garage ? 0.35 : 0.12);

    var radius = garage ? 7.5 : 13;
    var height = garage ? 2.8 : 5.4;

    var targetPos = new THREE.Vector3(
      car.position.x + Math.sin(orbitAngle) * radius,
      height,
      car.position.z + Math.cos(orbitAngle) * radius
    );
    var targetLook = new THREE.Vector3(car.position.x, garage ? 1.0 : 1.4, car.position.z);

    if (!camReady) {
      camPos.copy(targetPos);
      camLook.copy(targetLook);
      camReady = true;
    } else {
      var t = 1 - Math.pow(1 - 0.06, dt * 60);
      camPos.lerp(targetPos, t);
      camLook.lerp(targetLook, t);
    }

    camera.position.copy(camPos);
    camera.lookAt(camLook);

    if (settings.debug) {
      UI.setDebug(['FPS ' + fps, 'view ' + view, 'colliders ' + (world ? world.obstacles.length : 0)]);
    }
  }

  /** Keep the shadow frustum around the car so shadows stay crisp. */
  function followSun() {
    if (!car || !sun) return;
    sun.position.set(car.position.x + 45, 65, car.position.z + 25);
    sun.target.position.set(car.position.x, 0, car.position.z);
    sun.target.updateMatrixWorld();
  }

  // ------------------------------------------------------------- expose
  window.Game = {
    start: start,
    stop: stop,
    reset: reset,
    setView: setView,
    previewVehicle: previewVehicle,
    applySettings: applySettings,
    get view() { return view; },
    get fps() { return fps; },
    get car() { return car; },
    get cameraPosition() { return camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null; },
    get world() { return world; },
    get traffic() { return traffic; },
    get missions() { return missions; }
  };

  // Surface any uncaught error in the banner instead of only the console.
  window.addEventListener('error', function (e) {
    if (window.UI && UI.showError) {
      UI.showError((e.message || 'Noma\u2019lum xatolik') +
        (e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : ''));
    }
  });

  // Start as soon as Three.js is present; the fallback loader tells us when.
  if (window.ThreeLoader) {
    window.ThreeLoader.ready(boot);
    window.ThreeLoader.onFail(function () {
      UI.showError('Three.js yuklanmadi. Internet aloqasini tekshiring yoki ' +
        'three.min.js faylini vendor/three.min.js sifatida saqlang.');
    });
  } else if (typeof window.THREE !== 'undefined') {
    boot();
  } else {
    UI.showError('Three.js topilmadi.');
  }
})();
