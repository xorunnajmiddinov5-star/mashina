/* ==========================================================================
   missions.js
   Uchta oddiy mission, navbat bilan takrorlanadi:
     1. PARKING       — sariq chiziqli joyga park qilish
     2. BORISH        — belgilangan joyga yetib borish
     3. CHECKPOINT    — 60 sekund ichida checkpointga yetish

   Mission majburiy emas: player istagan joyda erkin haydashi mumkin,
   mission fonda kutib turadi.
   ========================================================================== */

function MissionSystem(scene, world) {
  this.scene = scene;
  this.world = world;

  var bay = world.parkingZone.center;

  this.defs = [
    {
      id: 'park', title: 'MISSION 1 \u00b7 PARKING',
      text: 'Sariq chiziqli joyga park qiling',
      target: { x: bay.x, z: bay.z }, radius: 4,
      type: 'park', coins: 50, xp: 25
    },
    {
      id: 'goto', title: 'MISSION 2 \u00b7 BORISH',
      text: 'Belgilangan joyga boring',
      target: { x: 2.05, z: -28 }, radius: 5,
      type: 'reach', coins: 60, xp: 30
    },
    {
      id: 'checkpoint', title: 'MISSION 3 \u00b7 CHECKPOINT',
      text: '60 sekund ichida checkpointga yeting',
      target: { x: -2.05, z: 72 }, radius: 5,
      type: 'timed', limit: 60, coins: 80, xp: 40
    }
  ];

  this.index = 0;
  this.timer = 0;
  this.onComplete = null;   // function(def)
  this.onFail = null;       // function(def)

  // aylanib turuvchi belgi (marker)
  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.6;

  var beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 9, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide
    })
  );
  beam.position.y = 4.5;

  this.marker = new THREE.Group();
  this.marker.add(ring);
  this.marker.add(beam);
  scene.add(this.marker);

  this.reset();
}

MissionSystem.prototype.current = function () {
  return this.defs[this.index];
};

MissionSystem.prototype.reset = function () {
  this.index = 0;
  this.timer = 0;
  this._placeMarker();
};

MissionSystem.prototype._placeMarker = function () {
  var t = this.current().target;
  this.marker.position.set(t.x, 0, t.z);
};

MissionSystem.prototype._next = function () {
  this.index = (this.index + 1) % this.defs.length;
  this.timer = 0;
  this._placeMarker();
};

MissionSystem.prototype.distance = function (car) {
  var t = this.current().target;
  var dx = car.position.x - t.x, dz = car.position.z - t.z;
  return Math.sqrt(dx * dx + dz * dz);
};

/**
 * @param parkingState parking.update() dan qaytgan holat
 * @returns { text, title, progress, distance, timeLeft }
 */
MissionSystem.prototype.update = function (dt, car, parkingState) {
  var def = this.current();
  var dist = this.distance(car);
  var progress = 0;
  var timeLeft = null;
  var done = false;

  this.marker.rotation.y += dt * 1.2;
  this.marker.children[0].position.y = 0.6 + Math.sin(this.timer * 2.4) * 0.25;
  this.timer += dt;

  if (def.type === 'park') {
    progress = parkingState ? parkingState.readyProgress : 0;
    done = !!(parkingState && parkingState.justCompleted);
  } else if (def.type === 'reach') {
    progress = Math.max(0, Math.min(1, 1 - dist / 120));
    done = dist <= def.radius;
  } else if (def.type === 'timed') {
    timeLeft = Math.max(0, def.limit - this.timer);
    progress = Math.max(0, Math.min(1, timeLeft / def.limit));
    done = dist <= def.radius;
    if (!done && timeLeft <= 0) {
      this.timer = 0;                       // qaytadan urinish
      if (this.onFail) this.onFail(def);
    }
  }

  if (done) {
    var finished = def;
    this._next();
    if (this.onComplete) this.onComplete(finished);
    def = this.current();
    dist = this.distance(car);
  }

  return {
    id: def.id,
    title: def.title,
    text: def.text,
    progress: progress,
    distance: dist,
    timeLeft: timeLeft
  };
};

MissionSystem.prototype.targetPoint = function () {
  return this.current().target;
};

window.MissionSystem = MissionSystem;
