/* ==========================================================================
   traffic.js
   Ko'chadagi jonli harakat: Cobalt, Nexia, Gentra, Spark, Damas.

   Mashinalar ayni o'sha Car modelidan quriladi (car.js ga tegilmagan).
   Ular bosh ko'cha bo'ylab ikki yo'nalishda yuradi, oldindagi mashinaga
   yoki playerga yaqinlashsa sekinlashadi, xarita chetiga yetganda
   boshqa uchidan qaytib kiradi.

   Player bilan to'qnashuv: har bir mashina har kadrda box collider
   sifatida qaytariladi va main.js uni car.update() ga uzatadi.
   ========================================================================== */

function TrafficSystem(scene, world, options) {
  options = options || {};
  this.scene = scene;
  this.world = world;
  this.cars = [];
  this.obstacles = [];

  var keys = ['cobalt', 'nexia', 'gentra', 'spark', 'damas'];
  var lanes = [
    { x: -2.05, dir: 1, heading: Math.PI },  // +Z tomonga
    { x: 2.05, dir: -1, heading: 0 }         // -Z tomonga
  ];

  this.zMin = -106;
  this.zMax = 106;
  var span = this.zMax - this.zMin;
  var perLane = options.perLane || 5;

  var n = 0;
  for (var l = 0; l < lanes.length; l++) {
    for (var i = 0; i < perLane; i++) {
      var lane = lanes[l];
      var key = keys[n % keys.length];
      var z = this.zMin + (i + (l ? 0.5 : 0)) * (span / perLane);

      var car = new window.Car(scene, key);
      car.setHeadlights(false);
      car.setShadows(options.shadows !== false);
      car.setPosition(lane.x, z, lane.heading);

      this.cars.push({
        car: car,
        laneX: lane.x,
        dir: lane.dir,
        heading: lane.heading,
        z: z,
        speed: 6 + (n % 3),
        target: 7.5 + (n % 4) * 1.2,
        halfLen: car.def.length / 2,
        halfWid: car.def.width / 2
      });
      n++;
    }
  }
}

/** Oldindagi eng yaqin to'siqgacha bo'lgan masofa (o'z yo'nalishi bo'yicha). */
TrafficSystem.prototype._gapAhead = function (t, playerCar) {
  var gap = Infinity, i, o, d;

  for (i = 0; i < this.cars.length; i++) {
    o = this.cars[i];
    if (o === t || o.dir !== t.dir || Math.abs(o.laneX - t.laneX) > 1.5) continue;
    d = (o.z - t.z) * t.dir - t.halfLen - o.halfLen;
    if (d > 0 && d < gap) gap = d;
  }

  if (playerCar && Math.abs(playerCar.position.x - t.laneX) < 2.6) {
    d = (playerCar.position.z - t.z) * t.dir - t.halfLen - playerCar.def.length / 2;
    if (d > 0 && d < gap) gap = d;
  }
  return gap;
};

TrafficSystem.prototype.update = function (dt, playerCar) {
  if (dt > 0.1) dt = 0.1;
  this.obstacles.length = 0;

  for (var i = 0; i < this.cars.length; i++) {
    var t = this.cars[i];

    var gap = this._gapAhead(t, playerCar);
    var desired = t.target;
    if (gap < 5) desired = 0;
    else if (gap < 16) desired = t.target * ((gap - 5) / 11);

    if (desired > t.speed) t.speed = Math.min(desired, t.speed + 4.5 * dt);
    else t.speed = Math.max(desired, t.speed - 9 * dt);

    t.z += t.dir * t.speed * dt;

    if (t.z > this.zMax) t.z = this.zMin;
    else if (t.z < this.zMin) t.z = this.zMax;

    t.car.position.x = t.laneX;
    t.car.position.z = t.z;
    t.car.heading = t.heading;
    t.car.speed = t.speed;
    t.car._syncMesh();

    this.obstacles.push({
      type: 'box',
      minX: t.laneX - t.halfWid,
      maxX: t.laneX + t.halfWid,
      minZ: t.z - t.halfLen,
      maxZ: t.z + t.halfLen
    });
  }
};

/** START paytida player turgan joyni bo'shatadi. */
TrafficSystem.prototype.clearAround = function (x, z, radius) {
  for (var i = 0; i < this.cars.length; i++) {
    var t = this.cars[i];
    if (Math.abs(t.laneX - x) < 3 && Math.abs(t.z - z) < radius) {
      t.z += t.dir * radius * 2;
      if (t.z > this.zMax) t.z = this.zMin;
      if (t.z < this.zMin) t.z = this.zMax;
      t.car.setPosition(t.laneX, t.z, t.heading);
    }
  }
};

/** main.js har kadrda buni world.obstacles bilan birga car.update() ga beradi. */
TrafficSystem.prototype.getObstacles = function () {
  return this.obstacles;
};

TrafficSystem.prototype.dispose = function () {
  this.cars.forEach(function (t) { t.car.dispose(); });
  this.cars.length = 0;
  this.obstacles.length = 0;
};

window.TrafficSystem = TrafficSystem;
