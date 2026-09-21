/* ==========================================================================
   car.js  —  XORUN UZB DRIVE

   The vehicle is NOT a stack of boxes. The body is a real lofted 3D hull:
   a table of cross-sections is defined along the length of the car (nose,
   bonnet, cowl, windscreen, roof, rear screen, boot, tail) and those
   sections are skinned into a triangle mesh. That is what produces the
   sloped bonnet, the raked windscreen, the curved shoulder line and the
   tapered tail of a real car silhouette.

   The band between the shoulder and the roof edge inside the greenhouse is
   emitted as a separate geometry with a glass material, so the windscreen,
   side windows and rear screen all come out of the same loft.

   Axis convention: the mesh faces local -Z. heading 0 = facing world -Z,
   forward = ( -sin h, 0, -cos h ). Steering left (A) increases heading.
   ========================================================================== */

/* -------------------------------------------------------------- profiles */
/* z    : position along the car, as a fraction of total length
   hw   : half width, as a fraction of the car's half width
   yb   : bottom of the body (metres)
   ybelt: shoulder / belt line (metres)
   ytop : top of this section — bonnet, roof or boot lid (metres)
   rhw  : half width at ytop, as a fraction of the car's half width
   glass: the section sits inside the greenhouse                           */

var BODY_PROFILES = {
  sedan: [
    { z: -0.500, hw: 0.58, yb: 0.46, ybelt: 0.72, ytop: 0.76, rhw: 0.50 },
    { z: -0.462, hw: 0.86, yb: 0.34, ybelt: 0.78, ytop: 0.84, rhw: 0.78 },
    { z: -0.395, hw: 0.96, yb: 0.28, ybelt: 0.83, ytop: 0.89, rhw: 0.88 },
    { z: -0.300, hw: 1.00, yb: 0.27, ybelt: 0.86, ytop: 0.93, rhw: 0.92 },
    { z: -0.210, hw: 1.00, yb: 0.27, ybelt: 0.88, ytop: 0.96, rhw: 0.90 },
    { z: -0.160, hw: 1.00, yb: 0.27, ybelt: 0.90, ytop: 1.05, rhw: 0.80, glass: true },
    { z: -0.080, hw: 1.00, yb: 0.27, ybelt: 0.92, ytop: 1.30, rhw: 0.72, glass: true },
    { z: 0.010, hw: 1.00, yb: 0.27, ybelt: 0.93, ytop: 1.43, rhw: 0.70, glass: true },
    { z: 0.120, hw: 0.99, yb: 0.27, ybelt: 0.93, ytop: 1.44, rhw: 0.70, glass: true },
    { z: 0.215, hw: 0.98, yb: 0.28, ybelt: 0.92, ytop: 1.38, rhw: 0.68, glass: true },
    { z: 0.292, hw: 0.97, yb: 0.28, ybelt: 0.91, ytop: 1.17, rhw: 0.72, glass: true },
    { z: 0.358, hw: 0.96, yb: 0.29, ybelt: 0.89, ytop: 1.01, rhw: 0.86 },
    { z: 0.432, hw: 0.94, yb: 0.30, ybelt: 0.87, ytop: 0.96, rhw: 0.86 },
    { z: 0.480, hw: 0.86, yb: 0.34, ybelt: 0.83, ytop: 0.91, rhw: 0.76 },
    { z: 0.500, hw: 0.60, yb: 0.44, ybelt: 0.77, ytop: 0.83, rhw: 0.52 }
  ],
  hatch: [
    { z: -0.500, hw: 0.58, yb: 0.46, ybelt: 0.76, ytop: 0.80, rhw: 0.50 },
    { z: -0.448, hw: 0.88, yb: 0.34, ybelt: 0.82, ytop: 0.88, rhw: 0.80 },
    { z: -0.362, hw: 0.98, yb: 0.28, ybelt: 0.86, ytop: 0.94, rhw: 0.90 },
    { z: -0.258, hw: 1.00, yb: 0.27, ybelt: 0.90, ytop: 1.00, rhw: 0.88 },
    { z: -0.185, hw: 1.00, yb: 0.27, ybelt: 0.92, ytop: 1.16, rhw: 0.78, glass: true },
    { z: -0.070, hw: 1.00, yb: 0.27, ybelt: 0.94, ytop: 1.46, rhw: 0.72, glass: true },
    { z: 0.060, hw: 1.00, yb: 0.27, ybelt: 0.95, ytop: 1.54, rhw: 0.72, glass: true },
    { z: 0.200, hw: 0.99, yb: 0.28, ybelt: 0.94, ytop: 1.52, rhw: 0.70, glass: true },
    { z: 0.330, hw: 0.97, yb: 0.28, ybelt: 0.93, ytop: 1.42, rhw: 0.70, glass: true },
    { z: 0.424, hw: 0.95, yb: 0.29, ybelt: 0.91, ytop: 1.24, rhw: 0.76, glass: true },
    { z: 0.480, hw: 0.88, yb: 0.32, ybelt: 0.88, ytop: 1.08, rhw: 0.74 },
    { z: 0.500, hw: 0.64, yb: 0.42, ybelt: 0.84, ytop: 0.98, rhw: 0.54 }
  ],
  van: [
    { z: -0.500, hw: 0.62, yb: 0.44, ybelt: 0.78, ytop: 0.84, rhw: 0.54 },
    { z: -0.462, hw: 0.90, yb: 0.32, ybelt: 0.84, ytop: 0.94, rhw: 0.84 },
    { z: -0.415, hw: 0.99, yb: 0.28, ybelt: 0.88, ytop: 1.08, rhw: 0.92, glass: true },
    { z: -0.345, hw: 1.00, yb: 0.27, ybelt: 0.92, ytop: 1.60, rhw: 0.92, glass: true },
    { z: -0.180, hw: 1.00, yb: 0.27, ybelt: 0.94, ytop: 1.84, rhw: 0.94, glass: true },
    { z: 0.020, hw: 1.00, yb: 0.27, ybelt: 0.94, ytop: 1.88, rhw: 0.94, glass: true },
    { z: 0.240, hw: 1.00, yb: 0.27, ybelt: 0.94, ytop: 1.88, rhw: 0.94, glass: true },
    { z: 0.402, hw: 0.99, yb: 0.28, ybelt: 0.93, ytop: 1.86, rhw: 0.92, glass: true },
    { z: 0.480, hw: 0.90, yb: 0.30, ybelt: 0.90, ytop: 1.78, rhw: 0.80 },
    { z: 0.500, hw: 0.66, yb: 0.40, ybelt: 0.86, ytop: 1.68, rhw: 0.56 }
  ]
};

var VEHICLE_DEFS = {
  cobalt: {
    name: 'Chevrolet Cobalt', body: 'sedan', color: 0xb62b22, unlocked: true, price: 0,
    length: 4.48, width: 1.74, hScale: 1.00, wheelR: 0.33, wheelInset: 0.17,
    maxSpeed: 27, accel: 14, grip: 1.00
  },
  nexia: {
    name: 'Chevrolet Nexia', body: 'sedan', color: 0x1f5fa8, unlocked: false, price: 600,
    length: 4.24, width: 1.68, hScale: 0.98, wheelR: 0.31, wheelInset: 0.16,
    maxSpeed: 25, accel: 12.5, grip: 0.95
  },
  gentra: {
    name: 'Chevrolet Gentra', body: 'sedan', color: 0xe6e3dc, unlocked: false, price: 900,
    length: 4.52, width: 1.74, hScale: 1.01, wheelR: 0.33, wheelInset: 0.17,
    maxSpeed: 28, accel: 13.5, grip: 1.00
  },
  spark: {
    name: 'Chevrolet Spark', body: 'hatch', color: 0xdc9b2c, unlocked: false, price: 450,
    length: 3.64, width: 1.60, hScale: 1.00, wheelR: 0.30, wheelInset: 0.15,
    maxSpeed: 23, accel: 12, grip: 1.05
  },
  damas: {
    name: 'Chevrolet Damas', body: 'van', color: 0xeeece5, unlocked: false, price: 700,
    length: 3.56, width: 1.57, hScale: 1.00, wheelR: 0.29, wheelInset: 0.15,
    maxSpeed: 21, accel: 10.5, grip: 0.85
  },
  malibu: {
    name: 'Chevrolet Malibu', body: 'sedan', color: 0x141a24, unlocked: false, price: 1500,
    length: 4.92, width: 1.85, hScale: 1.03, wheelR: 0.36, wheelInset: 0.18,
    maxSpeed: 31, accel: 16, grip: 1.05
  }
};

/* ------------------------------------------------------------ loft maths */

/** One cross-section as a closed ring: right half, then mirrored. */
var BODY_LIFT = 0.085;   // ride height: how high the shell sits on the wheels

function sectionRing(s, halfWidth, hScale) {
  var hw = s.hw * halfWidth;
  var rhw = s.rhw * halfWidth;
  var yb = s.yb * hScale + BODY_LIFT;
  var ybelt = s.ybelt * hScale + BODY_LIFT;
  var ytop = s.ytop * hScale + BODY_LIFT;
  var yLow = yb + (ybelt - yb) * 0.42;

  var right = [
    [0, yb - 0.005],          // 0 floor centre
    [hw * 0.68, yb],          // 1 floor edge
    [hw * 0.97, yLow],        // 2 lower flank
    [hw, ybelt],              // 3 shoulder
    [rhw, ytop - 0.012],      // 4 roof / bonnet edge
    [rhw * 0.55, ytop],       // 5
    [0, ytop + 0.006]         // 6 centre top
  ];

  var ring = right.slice();
  for (var i = right.length - 2; i >= 1; i--) ring.push([-right[i][0], right[i][1]]);
  return ring; // 12 points
}

/** Skin the sections into triangles; the greenhouse band becomes glass. */
function buildLoft(profile, length, halfWidth, hScale) {
  var sections = profile.map(function (s) {
    return { z: s.z * length, ring: sectionRing(s, halfWidth, hScale), glass: !!s.glass };
  });

  var bodyPos = [], glassPos = [];
  var ringLen = sections[0].ring.length;

  function push(target, a, b, c, ref) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var cx = (a[0] + b[0] + c[0]) / 3 - ref[0];
    var cy = (a[1] + b[1] + c[1]) / 3 - ref[1];
    var cz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * cx + ny * cy + nz * cz < 0) { var t = b; b = c; c = t; }
    target.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  for (var i = 0; i < sections.length - 1; i++) {
    var s0 = sections[i], s1 = sections[i + 1];
    var midY = 0;
    s0.ring.forEach(function (p) { midY += p[1]; });
    midY /= ringLen;
    var ref = [0, midY, (s0.z + s1.z) / 2];
    var greenhouse = s0.glass && s1.glass;

    for (var j = 0; j < ringLen; j++) {
      var k = (j + 1) % ringLen;
      var a = [s0.ring[j][0], s0.ring[j][1], s0.z];
      var b = [s0.ring[k][0], s0.ring[k][1], s0.z];
      var c = [s1.ring[k][0], s1.ring[k][1], s1.z];
      var d = [s1.ring[j][0], s1.ring[j][1], s1.z];

      // ring segment 3->4 (right) and 7->8 (left) is the window band
      var isWindow = greenhouse && (j === 3 || j === 7);
      var target = isWindow ? glassPos : bodyPos;

      push(target, a, b, c, ref);
      push(target, a, c, d, ref);
    }
  }

  [sections[0], sections[sections.length - 1]].forEach(function (s, idx) {
    var cy = 0;
    s.ring.forEach(function (p) { cy += p[1]; });
    cy /= ringLen;
    var centre = [0, cy, s.z];
    var ref = [0, cy, s.z + (idx === 0 ? 0.5 : -0.5)];
    for (var j = 0; j < ringLen; j++) {
      var k = (j + 1) % ringLen;
      push(bodyPos, centre,
        [s.ring[j][0], s.ring[j][1], s.z],
        [s.ring[k][0], s.ring[k][1], s.z], ref);
    }
  });

  function toGeometry(arr) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    g.computeVertexNormals();
    return g;
  }

  return { body: toGeometry(bodyPos), glass: toGeometry(glassPos), sections: sections };
}

/* -------------------------------------------------------------------- Car */

function Car(scene, vehicleKey) {
  this.scene = scene;
  this.key = VEHICLE_DEFS[vehicleKey] ? vehicleKey : 'cobalt';
  this.def = VEHICLE_DEFS[this.key];

  this.position = new THREE.Vector3(0, 0, 0);
  this.heading = 0;
  this.speed = 0;
  this.steerAngle = 0;
  this.damage = 0;

  this.maxSpeed = this.def.maxSpeed;
  this.reverseMaxSpeed = this.def.maxSpeed * 0.42;
  this.acceleration = this.def.accel;
  this.brakingPower = 23;
  this.friction = 5.0;
  this.maxSteer = 0.6 * this.def.grip;
  this.steerSpeed = 3.6;
  this.turnRate = 1.95 * this.def.grip;

  this.collisionRadius = Math.max(1.12, this.def.width * 0.76);

  this.group = new THREE.Group();
  this.group.name = 'vehicle-' + this.key;
  this._build();
  scene.add(this.group);
}

Car.prototype._build = function () {
  var d = this.def;
  var g = this.group;
  var self = this;

  var L = d.length;
  var halfW = d.width / 2;
  var hS = d.hScale;
  var frontZ = -L / 2;
  var rearZ = L / 2;

  var paint = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.34, metalness: 0.5 });
  var trim = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.78, metalness: 0.05 });
  var rubber = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.97 });
  var chrome = new THREE.MeshStandardMaterial({ color: 0xcdd1d6, roughness: 0.18, metalness: 0.92 });
  var rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.28, metalness: 0.88 });
  var glassMat = new THREE.MeshStandardMaterial({
    color: 0x2b4553, roughness: 0.05, metalness: 0.55, transparent: true, opacity: 0.66
  });
  var headMat = new THREE.MeshStandardMaterial({
    color: 0xfffaea, emissive: 0xfff2c0, emissiveIntensity: 0.85, roughness: 0.1, metalness: 0.3
  });
  var tailMat = new THREE.MeshStandardMaterial({
    color: 0x8d1418, emissive: 0xa01a12, emissiveIntensity: 0.5, roughness: 0.28
  });
  var amberMat = new THREE.MeshStandardMaterial({
    color: 0xd98a2b, emissive: 0xb86a12, emissiveIntensity: 0.3, roughness: 0.3
  });

  // ---------------------------------------------------------- lofted shell
  var loft = buildLoft(BODY_PROFILES[d.body] || BODY_PROFILES.sedan, L, halfW, hS);

  this.shell = new THREE.Mesh(loft.body, paint);
  g.add(this.shell);

  this.windows = new THREE.Mesh(loft.glass, glassMat);
  g.add(this.windows);

  // ---------------------------------------------------------- doors
  [-1, 1].forEach(function (side) {
    [-0.09 * L, 0.20 * L].forEach(function (pz) {
      var shut = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.46 * hS, 0.018), trim);
      shut.position.set(side * (halfW + 0.005), (0.60 * hS + BODY_LIFT), pz);
      g.add(shut);
    });
    [-0.02 * L, 0.26 * L].forEach(function (pz) {
      var handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.17), chrome);
      handle.position.set(side * (halfW + 0.018), (0.84 * hS + BODY_LIFT), pz);
      g.add(handle);
    });
    var strip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.055, L * 0.48), trim);
    strip.position.set(side * (halfW + 0.006), (0.56 * hS + BODY_LIFT), 0.05 * L);
    g.add(strip);
  });

  // ---------------------------------------------------------- panel lines
  var bonnetLine = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.7, 0.012, 0.02), trim);
  bonnetLine.position.set(0, (0.955 * hS + BODY_LIFT), -0.195 * L);
  g.add(bonnetLine);

  if (d.body === 'sedan') {
    var bootLine = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.72, 0.012, 0.02), trim);
    bootLine.position.set(0, (0.995 * hS + BODY_LIFT), 0.358 * L);
    g.add(bootLine);
  }

  // ---------------------------------------------------------- bumpers, grille
  var fb = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.97, 0.3 * hS, 0.3), trim);
  fb.position.set(0, (0.40 * hS + BODY_LIFT), frontZ + 0.06);
  g.add(fb);

  var lip = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.8, 0.1, 0.24), trim);
  lip.position.set(0, (0.28 * hS + BODY_LIFT), frontZ + 0.08);
  g.add(lip);

  var rb = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.97, 0.3 * hS, 0.3), trim);
  rb.position.set(0, (0.40 * hS + BODY_LIFT), rearZ - 0.06);
  g.add(rb);

  var grilleTop = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.56, 0.09, 0.12), trim);
  grilleTop.position.set(0, (0.78 * hS + BODY_LIFT), frontZ + 0.03);
  g.add(grilleTop);
  var bar = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.6, 0.04, 0.1), chrome);
  bar.position.set(0, (0.72 * hS + BODY_LIFT), frontZ + 0.01);
  g.add(bar);
  var grilleLow = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.46, 0.13, 0.12), trim);
  grilleLow.position.set(0, (0.55 * hS + BODY_LIFT), frontZ + 0.05);
  g.add(grilleLow);

  // ---------------------------------------------------------- lamps
  this.headlights = [];
  this.beams = [];
  [-1, 1].forEach(function (side) {
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.24, 0.14, 0.18), headMat);
    lamp.position.set(side * d.width * 0.31, (0.79 * hS + BODY_LIFT), frontZ + 0.07);
    g.add(lamp);
    self.headlights.push(lamp);

    var corner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.16), amberMat);
    corner.position.set(side * d.width * 0.44, (0.77 * hS + BODY_LIFT), frontZ + 0.13);
    g.add(corner);

    var beam = new THREE.SpotLight(0xfff0c4, 0.75, 28, Math.PI / 8, 0.6, 1.4);
    beam.position.set(side * d.width * 0.31, (0.79 * hS + BODY_LIFT), frontZ + 0.1);
    beam.target.position.set(side * d.width * 0.31, -0.5, frontZ - 20);
    g.add(beam);
    g.add(beam.target);
    self.beams.push(beam);
  });

  this.tailLights = [];
  [-1, 1].forEach(function (side) {
    var tail = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.2, 0.22, 0.16), tailMat.clone());
    tail.position.set(side * d.width * 0.36, (0.85 * hS + BODY_LIFT), rearZ - 0.04);
    g.add(tail);
    self.tailLights.push(tail);
  });

  this.reverseLamp = new THREE.Mesh(
    new THREE.BoxGeometry(d.width * 0.16, 0.07, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xf2f0e8, emissive: 0xffffff, emissiveIntensity: 0 })
  );
  this.reverseLamp.position.set(0, (0.62 * hS + BODY_LIFT), rearZ - 0.12);
  g.add(this.reverseLamp);

  var plate = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.3, 0.13, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf4f2eb, roughness: 0.65 }));
  plate.position.set(0, (0.5 * hS + BODY_LIFT), rearZ - 0.09);
  g.add(plate);

  var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 8), chrome);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(d.width * 0.28, (0.3 * hS + BODY_LIFT), rearZ - 0.08);
  g.add(exhaust);

  // ---------------------------------------------------------- mirrors
  [-1, 1].forEach(function (side) {
    var mz = d.body === 'van' ? -0.3 * L : -0.15 * L;
    var arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.07), trim);
    arm.position.set(side * (halfW + 0.04), (0.98 * hS + BODY_LIFT), mz);
    g.add(arm);
    var shell2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.2), paint);
    shell2.position.set(side * (halfW + 0.105), (0.98 * hS + BODY_LIFT), mz);
    g.add(shell2);
    var face = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.16), chrome);
    face.position.set(side * (halfW + 0.152), (0.98 * hS + BODY_LIFT), mz);
    g.add(face);
  });

  // ---------------------------------------------------------- wipers
  [-0.25, 0.2].forEach(function (x) {
    var wiper = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.5), trim);
    wiper.position.set(x * d.width, (0.985 * hS + BODY_LIFT), -0.19 * L);
    wiper.rotation.y = 0.25;
    g.add(wiper);
  });

  // ---------------------------------------------------------- wheels & arches
  var wheelR = d.wheelR;
  var axleF = -L * 0.305;
  var axleR = L * 0.30;
  var track = halfW - d.wheelInset;

  var tyreGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.22, 20);
  var discGeo = new THREE.CylinderGeometry(wheelR * 0.62, wheelR * 0.62, 0.225, 14);
  var spokeGeo = new THREE.BoxGeometry(wheelR * 1.05, 0.055, 0.055);

  this.wheels = {};
  this.steerPivots = {};

  var layout = { fl: [track, axleF, 1], fr: [-track, axleF, 1], rl: [track, axleR, 0], rr: [-track, axleR, 0] };

  Object.keys(layout).forEach(function (key) {
    var cfg = layout[key];
    var pivot = new THREE.Group();
    pivot.position.set(cfg[0], wheelR, cfg[1]);

    var wheel = new THREE.Group();

    var tyre = new THREE.Mesh(tyreGeo, rubber);
    tyre.rotation.z = Math.PI / 2;
    wheel.add(tyre);

    var disc = new THREE.Mesh(discGeo, rimMat);
    disc.rotation.z = Math.PI / 2;
    wheel.add(disc);

    for (var s = 0; s < 5; s++) {
      var spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.x = (Math.PI / 5) * s;
      wheel.add(spoke);
    }

    var cap = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.2, wheelR * 0.2, 0.24, 10), chrome);
    cap.rotation.z = Math.PI / 2;
    wheel.add(cap);

    pivot.add(wheel);
    g.add(pivot);

    self.wheels[key] = wheel;
    if (cfg[2]) self.steerPivots[key] = pivot;

  });

  // ---------------------------------------------------------- interior
  var dash = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.84, 0.15, 0.3), trim);
  dash.position.set(0, (0.98 * hS + BODY_LIFT), -0.12 * L);
  g.add(dash);

  var seatMat = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.92 });
  [-1, 1].forEach(function (side) {
    var base = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.3, 0.1, 0.44), seatMat);
    base.position.set(side * d.width * 0.2, (0.95 * hS + BODY_LIFT), -0.02 * L);
    g.add(base);
    var back = new THREE.Mesh(new THREE.BoxGeometry(d.width * 0.3, 0.44, 0.11), seatMat);
    back.position.set(side * d.width * 0.2, (1.15 * hS + BODY_LIFT), 0.03 * L);
    back.rotation.x = -0.16;
    g.add(back);
  });

  var steering = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 6, 16), trim);
  steering.position.set(d.width * 0.2, (1.11 * hS + BODY_LIFT), -0.09 * L);
  steering.rotation.x = 1.12;
  g.add(steering);

  // ---------------------------------------------------------- contact shadow
  this.shadowBlob = new THREE.Mesh(
    new THREE.PlaneGeometry(d.width * 1.4, L * 1.0),
    new THREE.MeshBasicMaterial({ color: 0x08130d, transparent: true, opacity: 0.36, depthWrite: false })
  );
  this.shadowBlob.rotation.x = -Math.PI / 2;
  this.shadowBlob.position.y = 0.02;
  g.add(this.shadowBlob);

  var blob = this.shadowBlob;
  g.traverse(function (o) {
    if (o.isMesh && o !== blob) { o.castShadow = true; o.receiveShadow = true; }
  });
};

/* ------------------------------------------------------------- behaviour */

Car.prototype.setHeadlights = function (on) {
  this.beams.forEach(function (b) { b.visible = !!on; });
  this.headlights.forEach(function (h) { h.material.emissiveIntensity = on ? 0.9 : 0.1; });
};

Car.prototype.setShadows = function (on) {
  var blob = this.shadowBlob;
  this.group.traverse(function (o) { if (o.isMesh && o !== blob) o.castShadow = !!on; });
};

Car.prototype.setPosition = function (x, z, heading) {
  this.position.set(x, 0, z);
  this.heading = heading || 0;
  this.speed = 0;
  this.steerAngle = 0;
  this._syncMesh();
};

Car.prototype.getForward = function () {
  return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
};

Car.prototype.update = function (dt, input, obstacles) {
  dt = Math.min(dt, 0.05);

  var targetSteer = Math.max(-1, Math.min(1, input.steer)) * this.maxSteer;
  var steerLerp = 1 - Math.pow(0.001, dt * this.steerSpeed);
  this.steerAngle += (targetSteer - this.steerAngle) * steerLerp;

  if (input.brake) {
    var bDir = this.speed > 0 ? -1 : (this.speed < 0 ? 1 : 0);
    this.speed += bDir * this.brakingPower * dt;
    if (Math.abs(this.speed) < 0.3) this.speed = 0;
  } else if (input.throttle !== 0) {
    this.speed += input.throttle * this.acceleration * dt;
  } else {
    var fDir = this.speed > 0 ? -1 : (this.speed < 0 ? 1 : 0);
    this.speed += fDir * this.friction * dt;
    if (Math.abs(this.speed) < 0.15) this.speed = 0;
  }

  var penalty = 1 - this.damage / 260;
  var capF = this.maxSpeed * penalty;
  var capR = this.reverseMaxSpeed * penalty;
  if (this.speed > capF) this.speed = capF;
  if (this.speed < -capR) this.speed = -capR;

  if (Math.abs(this.speed) > 0.05) {
    var speedFactor = Math.min(Math.abs(this.speed) / 6, 1);
    var dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steerAngle * this.turnRate * dt * dir * (0.4 + 0.6 * speedFactor);
  }

  var fx = -Math.sin(this.heading);
  var fz = -Math.cos(this.heading);
  var nx = this.position.x + fx * this.speed * dt;
  var nz = this.position.z + fz * this.speed * dt;

  var collided = false;
  if (obstacles) {
    for (var i = 0; i < obstacles.length; i++) {
      var r = this._resolve(nx, nz, obstacles[i]);
      if (r.hit) { collided = true; nx = r.x; nz = r.z; }
    }
  }

  this.position.x = nx;
  this.position.z = nz;

  var impact = 0;
  if (collided) {
    impact = Math.min(Math.abs(this.speed) / this.maxSpeed, 1);
    this.damage = Math.min(100, this.damage + impact * 6);
    this.speed *= 0.25;
  }

  this._syncMesh();
  this._updateLamps(input);

  return { collided: collided, impact: impact, speed: this.speed };
};

Car.prototype._resolve = function (x, z, obs) {
  var r = this.collisionRadius;

  if (obs.type === 'circle') {
    var dx = x - obs.x, dz = z - obs.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var min = r + obs.r;
    if (dist < min && dist > 0.0001) {
      var push = min - dist;
      return { hit: true, x: x + (dx / dist) * push, z: z + (dz / dist) * push };
    }
    return { hit: false, x: x, z: z };
  }

  if (obs.type === 'box') {
    var cx = Math.max(obs.minX, Math.min(x, obs.maxX));
    var cz = Math.max(obs.minZ, Math.min(z, obs.maxZ));
    var ddx = x - cx, ddz = z - cz;
    var dd = Math.sqrt(ddx * ddx + ddz * ddz);
    if (dd < r) {
      if (dd > 0.0001) {
        var p = r - dd;
        return { hit: true, x: x + (ddx / dd) * p, z: z + (ddz / dd) * p };
      }
      var a = x - obs.minX, b = obs.maxX - x, c = z - obs.minZ, e = obs.maxZ - z;
      var m = Math.min(a, b, c, e);
      if (m === a) return { hit: true, x: obs.minX - r, z: z };
      if (m === b) return { hit: true, x: obs.maxX + r, z: z };
      if (m === c) return { hit: true, x: x, z: obs.minZ - r };
      return { hit: true, x: x, z: obs.maxZ + r };
    }
    return { hit: false, x: x, z: z };
  }

  return { hit: false, x: x, z: z };
};

Car.prototype._syncMesh = function () {
  this.group.position.set(this.position.x, 0, this.position.z);
  this.group.rotation.y = this.heading;

  var spin = this.speed * 0.085;
  var wheels = this.wheels;
  Object.keys(wheels).forEach(function (k) { wheels[k].rotation.x -= spin; });

  var pivots = this.steerPivots;
  var angle = this.steerAngle;
  Object.keys(pivots).forEach(function (k) { pivots[k].rotation.y = angle; });
};

Car.prototype._updateLamps = function (input) {
  var braking = !!input.brake || (input.throttle < 0 && this.speed > 0);
  var v = braking ? 1.6 : 0.5;
  this.tailLights.forEach(function (t) { t.material.emissiveIntensity = v; });
  this.reverseLamp.material.emissiveIntensity = this.speed < -0.2 ? 1.2 : 0;
};

Object.defineProperty(Car.prototype, 'speedKmh', {
  get: function () { return Math.abs(this.speed) * 3.6; }
});

Object.defineProperty(Car.prototype, 'gear', {
  get: function () {
    if (this.speed < -0.2) return 'R';
    if (Math.abs(this.speed) < 0.2) return 'N';
    return 'D';
  }
});

Car.prototype.dispose = function () { this.scene.remove(this.group); };

window.Car = Car;
window.VEHICLE_DEFS = VEHICLE_DEFS;
window.BODY_PROFILES = BODY_PROFILES;
window.buildLoft = buildLoft;
