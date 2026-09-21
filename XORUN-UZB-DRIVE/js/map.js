/* ==========================================================================
   map.js
   "KICHIK ITTIFOQ — TOSHKENT VILOYATI"

   An Uzbek mahalla built entirely from Three.js geometry. This is NOT a
   geographic reconstruction of Kichik Ittifoq — it is a game environment
   inspired by it.

   Route: START (z = -70) -> mahalla street -> chorraha (z = -10) ->
   uylar, do'konlar -> parking (z = +88) -> FINISH.
   Heading PI = facing +Z = the direction of travel.

   Returns { group, obstacles, parkingZone, spawnPoint, decor }.
   ========================================================================== */

function buildKichikIttifoqMap(scene, options) {
  options = options || {};
  var shadows = options.shadows !== false;

  var obstacles = [];
  var parkedCars = [];
  var group = new THREE.Group();
  group.name = 'kichik-ittifoq';

  var M = {
    ground: new THREE.MeshStandardMaterial({ color: 0x7e8a5e, roughness: 1 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x9a8a63, roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x35393c, roughness: 0.96 }),
    asphaltWorn: new THREE.MeshStandardMaterial({ color: 0x3d4145, roughness: 0.98 }),
    lineWhite: new THREE.MeshBasicMaterial({ color: 0xe9e6dc }),
    lineYellow: new THREE.MeshBasicMaterial({ color: 0xe3b23c }),
    curb: new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.9 }),
    walk: new THREE.MeshStandardMaterial({ color: 0xb2a893, roughness: 0.95 }),
    wallSand: new THREE.MeshStandardMaterial({ color: 0xd6b489, roughness: 0.9 }),
    wallSand2: new THREE.MeshStandardMaterial({ color: 0xc19a6b, roughness: 0.9 }),
    wallWhite: new THREE.MeshStandardMaterial({ color: 0xe5ded0, roughness: 0.9 }),
    wallBrick: new THREE.MeshStandardMaterial({ color: 0xa9603f, roughness: 0.95 }),
    roofBlue: new THREE.MeshStandardMaterial({ color: 0x2a6f8f, roughness: 0.55, metalness: 0.2 }),
    roofGreen: new THREE.MeshStandardMaterial({ color: 0x3f6b4a, roughness: 0.6 }),
    roofRed: new THREE.MeshStandardMaterial({ color: 0x8c3b2b, roughness: 0.6 }),
    gate: new THREE.MeshStandardMaterial({ color: 0x1f8f8c, roughness: 0.45, metalness: 0.35 }),
    gateBlue: new THREE.MeshStandardMaterial({ color: 0x27577f, roughness: 0.45, metalness: 0.35 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4433, roughness: 1 }),
    leaf1: new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x5d8a44, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x4a4f54, roughness: 0.55, metalness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.95 }),
    lampGlass: new THREE.MeshStandardMaterial({ color: 0xfff4cc, emissive: 0xffeaa0, emissiveIntensity: 0.9 }),
    wire: new THREE.MeshBasicMaterial({ color: 0x1c1c1c }),
    glassWin: new THREE.MeshStandardMaterial({ color: 0x86b8cc, roughness: 0.15, metalness: 0.45 }),
    shopWall: new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.85 }),
    awning: new THREE.MeshStandardMaterial({ color: 0x1f8f8c, roughness: 0.7 }),
    awning2: new THREE.MeshStandardMaterial({ color: 0xc23b34, roughness: 0.7 }),
    signWhite: new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.5, side: THREE.DoubleSide }),
    signRed: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, side: THREE.DoubleSide }),
    signBlue: new THREE.MeshStandardMaterial({ color: 0x1f5fa8, roughness: 0.5, side: THREE.DoubleSide }),
    zone: new THREE.MeshBasicMaterial({ color: 0x2fd0b8, transparent: true, opacity: 0.28 })
  };

  function boxObs(cx, cz, w, d) {
    obstacles.push({ type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  function circleObs(cx, cz, r) {
    obstacles.push({ type: 'circle', x: cx, z: cz, r: r });
  }
  function mesh(geo, mat, x, y, z, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  }
  function flat(w, d, mat, x, z, y) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y || 0.012, z);
    m.receiveShadow = false;
    group.add(m);
    return m;
  }

  // ======================================================== GROUND
  var GROUND = 280;
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = shadows;
  group.add(ground);

  // dusty verges either side of the street
  flat(9, 240, M.dirt, 12, 0, 0.008);
  flat(9, 240, M.dirt, -12, 0, 0.008);

  // ======================================================== ROADS
  var ROAD_LEN = 230;
  var road = new THREE.Mesh(new THREE.PlaneGeometry(9, ROAD_LEN), M.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = shadows;
  group.add(road);

  var cross = new THREE.Mesh(new THREE.PlaneGeometry(70, 9), M.asphaltWorn);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.011, -10);
  cross.receiveShadow = shadows;
  group.add(cross);

  // centre dashes along the main street
  for (var dz = -105; dz <= 105; dz += 6) {
    if (dz > -16 && dz < -4) continue; // keep the junction clear
    flat(0.16, 2.4, M.lineWhite, 0, dz, 0.02);
  }
  // dashes on the cross street
  for (var dx = -33; dx <= 33; dx += 6) {
    if (dx > -7 && dx < 7) continue;
    flat(2.4, 0.16, M.lineWhite, dx, -10, 0.02);
  }
  // solid edge lines
  flat(0.12, ROAD_LEN, M.lineWhite, 4.2, 0, 0.02);
  flat(0.12, ROAD_LEN, M.lineWhite, -4.2, 0, 0.02);

  // zebra crossing just before the junction
  for (var zi = 0; zi < 7; zi++) {
    flat(0.55, 4.6, M.lineWhite, -3.6 + zi * 1.2, -17.5, 0.021);
  }
  // stop line
  flat(4.2, 0.35, M.lineWhite, 2.2, -15.6, 0.021);

  // kerbs + pavements along the street
  function pavement(x, z, w, d) {
    var walk = mesh(new THREE.BoxGeometry(w, 0.14, d), M.walk, x, 0.07, z);
    walk.receiveShadow = shadows;
    var kerbX = x + (x > 0 ? -w / 2 : w / 2);
    var kerb = mesh(new THREE.BoxGeometry(0.22, 0.2, d), M.curb, kerbX, 0.1, z);
    kerb.receiveShadow = shadows;
  }
  pavement(5.6, 0, 2.0, ROAD_LEN);
  pavement(-5.6, 0, 2.0, ROAD_LEN);

  // ======================================================== BUILDING BLOCKS
  /** A mahalla house: flat-ish roofed block with a pitched metal roof. */
  function house(cx, cz, w, h, d, wallMat, roofMat, rotY) {
    rotY = rotY || 0;
    var g = new THREE.Group();

    var body = mesh(new THREE.BoxGeometry(w, h, d), wallMat, 0, h / 2, 0, g);
    body.castShadow = shadows;
    body.receiveShadow = shadows;

    // plinth
    mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), M.concrete, 0, 0.15, 0, g);

    var roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.76, h * 0.5, 4), roofMat, 0, h + h * 0.25 + 0.04, 0, g);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = shadows;

    // ayvon (porch) posts and canopy on the street side
    var canopy = mesh(new THREE.BoxGeometry(w * 0.8, 0.1, 1.4), roofMat, 0, h * 0.78, d / 2 + 0.7, g);
    canopy.castShadow = shadows;
    [-1, 1].forEach(function (s) {
      mesh(new THREE.CylinderGeometry(0.07, 0.07, h * 0.78, 6), M.concrete,
        s * w * 0.33, h * 0.39, d / 2 + 1.25, g);
    });

    // door and windows
    mesh(new THREE.BoxGeometry(0.9, 1.9, 0.08), M.trunk, 0, 0.95, d / 2 + 0.05, g);
    [-1, 1].forEach(function (s) {
      var win = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), M.glassWin, s * w * 0.3, h * 0.6, d / 2 + 0.04, g);
      var frame = mesh(new THREE.BoxGeometry(1.0, 1.0, 0.03), M.wallWhite, s * w * 0.3, h * 0.6, d / 2 + 0.02, g);
      var side = mesh(new THREE.BoxGeometry(0.06, 0.8, 0.8), M.glassWin, s * (w / 2 + 0.03), h * 0.6, 0, g);
    });

    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    group.add(g);

    var rot90 = Math.abs(Math.round(rotY / (Math.PI / 2)) % 2) === 1;
    boxObs(cx, cz, rot90 ? d + 0.5 : w + 0.5, rot90 ? w + 0.5 : d + 0.5);
  }

  /**
   * Street-facing compound wall with a metal gate.
   * IMPORTANT: rotY = PI/2 makes the wall run ALONG the street (Z axis).
   * Building it across the street would block the route.
   */
  function compoundWall(cx, cz, length, rotY, gateWidth, gateMat) {
    gateWidth = gateWidth || 3.0;
    var wallH = 1.7, wallT = 0.26;
    var segLen = (length - gateWidth) / 2;

    var pivot = new THREE.Group();
    pivot.position.set(cx, 0, cz);
    pivot.rotation.y = rotY;
    group.add(pivot);

    [-1, 1].forEach(function (side) {
      var localX = side * (gateWidth / 2 + segLen / 2);
      var w = mesh(new THREE.BoxGeometry(segLen, wallH, wallT), M.wallSand, localX, wallH / 2, 0, pivot);
      w.castShadow = shadows;
      w.receiveShadow = shadows;
      // coping along the top
      mesh(new THREE.BoxGeometry(segLen, 0.1, wallT + 0.12), M.wallWhite, localX, wallH + 0.05, 0, pivot);

      var wx = cx + Math.cos(rotY) * localX;
      var wz = cz - Math.sin(rotY) * localX;
      var cos = Math.abs(Math.cos(rotY)), sin = Math.abs(Math.sin(rotY));
      boxObs(wx, wz, segLen * cos + wallT * sin, segLen * sin + wallT * cos);
    });

    // gate: two leaves + posts (the opening itself stays drivable)
    [-1, 1].forEach(function (s) {
      var leaf = mesh(new THREE.BoxGeometry(gateWidth * 0.46, wallH * 0.95, 0.07),
        gateMat || M.gate, s * gateWidth * 0.24, wallH * 0.48, 0, pivot);
      leaf.castShadow = shadows;
      for (var b = 0; b < 3; b++) {
        mesh(new THREE.BoxGeometry(gateWidth * 0.4, 0.06, 0.09), M.metal,
          s * gateWidth * 0.24, wallH * (0.25 + b * 0.25), 0, pivot);
      }
    });
    [-1, 1].forEach(function (s) {
      mesh(new THREE.BoxGeometry(0.22, wallH + 0.25, 0.3), M.wallWhite,
        s * (gateWidth / 2), (wallH + 0.25) / 2, 0, pivot);
    });
  }

  function tree(cx, cz, scale) {
    scale = scale || 1;
    var g = new THREE.Group();
    var trunk = mesh(new THREE.CylinderGeometry(0.12 * scale, 0.19 * scale, 1.7 * scale, 7), M.trunk, 0, 0.85 * scale, 0, g);
    trunk.castShadow = shadows;
    // whitewashed base, exactly like the trees along a mahalla street
    mesh(new THREE.CylinderGeometry(0.2 * scale, 0.21 * scale, 0.5 * scale, 7), M.wallWhite, 0, 0.25 * scale, 0, g);

    var crown = [
      [0, 2.5, 0, 1.05],
      [0.45, 2.15, 0.25, 0.7],
      [-0.4, 2.2, -0.3, 0.72],
      [0.1, 3.0, -0.2, 0.62]
    ];
    crown.forEach(function (c, i) {
      var leaf = mesh(new THREE.SphereGeometry(c[3] * scale, 8, 6),
        i % 2 ? M.leaf2 : M.leaf1, c[0] * scale, c[1] * scale, c[2] * scale, g);
      leaf.castShadow = shadows;
    });

    g.position.set(cx, 0, cz);
    g.rotation.y = Math.random() * Math.PI;
    group.add(g);
    circleObs(cx, cz, 0.45 * scale);
  }

  function streetLight(cx, cz, flip) {
    var dir = flip ? -1 : 1;
    var g = new THREE.Group();
    var pole = mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.0, 8), M.metal, 0, 2.0, 0, g);
    pole.castShadow = shadows;
    mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), M.concrete, 0, 0.15, 0, g);
    var arm = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), M.metal, dir * 0.45, 3.95, 0, g);
    var head = mesh(new THREE.BoxGeometry(0.42, 0.14, 0.24), M.metal, dir * 0.85, 3.86, 0, g);
    mesh(new THREE.BoxGeometry(0.34, 0.06, 0.18), M.lampGlass, dir * 0.85, 3.77, 0, g);
    g.position.set(cx, 0, cz);
    group.add(g);
    circleObs(cx, cz, 0.22);
  }

  /** Concrete power pole; wires are drawn between consecutive poles. */
  function powerPole(cx, cz) {
    var g = new THREE.Group();
    var pole = mesh(new THREE.BoxGeometry(0.22, 7.0, 0.22), M.concrete, 0, 3.5, 0, g);
    pole.castShadow = shadows;
    mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), M.metal, 0, 6.5, 0, g);
    mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), M.metal, 0, 6.0, 0, g);
    [-0.7, 0.7].forEach(function (x) {
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 6), M.glassWin, x, 6.62, 0, g);
    });
    g.position.set(cx, 0, cz);
    group.add(g);
    circleObs(cx, cz, 0.28);
  }

  function wireBetween(x, z1, z2, y) {
    var len = Math.abs(z2 - z1);
    var w = mesh(new THREE.BoxGeometry(0.04, 0.04, len), M.wire, x, y, (z1 + z2) / 2);
    return w;
  }

  function shop(cx, cz, w, d, rotY, awningMat, signMat) {
    rotY = rotY || 0;
    var g = new THREE.Group();
    var h = 3.0;

    var body = mesh(new THREE.BoxGeometry(w, h, d), M.shopWall, 0, h / 2, 0, g);
    body.castShadow = shadows;
    body.receiveShadow = shadows;

    // parapet
    mesh(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), M.wallWhite, 0, h + 0.15, 0, g);

    // sign board over the storefront
    var board = mesh(new THREE.BoxGeometry(w * 0.86, 0.6, 0.12), signMat || M.awning, 0, h * 0.85, d / 2 + 0.1, g);

    // awning
    var awn = mesh(new THREE.BoxGeometry(w * 0.95, 0.1, 1.3), awningMat || M.awning, 0, h * 0.66, d / 2 + 0.65, g);
    awn.castShadow = shadows;
    [-1, 1].forEach(function (s) {
      mesh(new THREE.CylinderGeometry(0.05, 0.05, h * 0.66, 6), M.metal, s * w * 0.4, h * 0.33, d / 2 + 1.2, g);
    });

    // glazed front + door
    mesh(new THREE.BoxGeometry(w * 0.62, h * 0.45, 0.06), M.glassWin, -w * 0.12, h * 0.34, d / 2 + 0.05, g);
    mesh(new THREE.BoxGeometry(0.95, h * 0.55, 0.06), M.gateBlue, w * 0.3, h * 0.29, d / 2 + 0.05, g);

    // crates outside
    mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), M.trunk, -w * 0.35, 0.22, d / 2 + 0.9, g);

    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    group.add(g);

    var rot90 = Math.abs(Math.round(rotY / (Math.PI / 2)) % 2) === 1;
    boxObs(cx, cz, rot90 ? d + 0.4 : w + 0.4, rot90 ? w + 0.4 : d + 0.4);
  }

  function roadSign(cx, cz, kind) {
    var g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), M.metal, 0, 1.15, 0, g);

    if (kind === 'parking') {
      mesh(new THREE.PlaneGeometry(0.8, 0.8), M.signBlue, 0, 2.3, 0, g);
      mesh(new THREE.PlaneGeometry(0.15, 0.46), M.signWhite, -0.09, 2.3, 0.02, g);
      mesh(new THREE.PlaneGeometry(0.3, 0.15), M.signWhite, 0.02, 2.47, 0.02, g);
      mesh(new THREE.PlaneGeometry(0.28, 0.14), M.signWhite, 0.01, 2.28, 0.02, g);
    } else if (kind === 'speed') {
      mesh(new THREE.CircleGeometry(0.4, 20), M.signWhite, 0, 2.3, 0, g);
      var ring = mesh(new THREE.RingGeometry(0.3, 0.4, 20), M.signRed, 0, 2.3, 0.015, g);
    } else {
      // triangular junction warning
      var tri = mesh(new THREE.CircleGeometry(0.42, 3), M.signWhite, 0, 2.3, 0, g);
      var triEdge = mesh(new THREE.RingGeometry(0.34, 0.42, 3), M.signRed, 0, 2.3, 0.015, g);
    }

    g.position.set(cx, 0, cz);
    group.add(g);
    circleObs(cx, cz, 0.15);
  }

  /**
   * A neighbour's car parked at the kerb. These use the SAME lofted 3D model
   * as the player's car, so the street is full of real Nexias, Damases and
   * Sparks rather than boxes. They are static: no physics, no headlights.
   */
  function parkedCar(cx, cz, rotY, vehicleKey) {
    var parked = new window.Car(scene, vehicleKey);
    parked.setHeadlights(false);
    parked.setShadows(shadows);
    parked.setPosition(cx, cz, rotY);
    parkedCars.push(parked);

    var def = parked.def;
    var rot90 = Math.abs(Math.round(rotY / (Math.PI / 2)) % 2) === 1;
    boxObs(cx, cz,
      rot90 ? def.length + 0.2 : def.width + 0.2,
      rot90 ? def.width + 0.2 : def.length + 0.2);
    return parked;
  }

  // ======================================================== THE MAHALLA
  var i, z;

  // East side: four compounds, each with a gate onto the street
  var eastRoofs = [M.roofBlue, M.roofGreen, M.roofRed, M.roofBlue];
  for (i = 0; i < 4; i++) {
    z = 16 + i * 16;
    house(12.5, z, 7, 3.0, 7.5, i % 2 ? M.wallSand : M.wallSand2, eastRoofs[i], -Math.PI / 2);
    compoundWall(7.8, z, 9.0, Math.PI / 2, 3.0, i % 2 ? M.gate : M.gateBlue);
    tree(9.6, z - 7.6);
  }

  // West side: three compounds — deliberately stopping short of the car park
  var westRoofs = [M.roofRed, M.roofBlue, M.roofGreen];
  for (i = 0; i < 3; i++) {
    z = 24 + i * 16;
    house(-12.5, z, 7, 3.0, 7.5, i % 2 ? M.wallSand2 : M.wallSand, westRoofs[i], Math.PI / 2);
    compoundWall(-7.8, z, 9.0, Math.PI / 2, 3.0, i % 2 ? M.gateBlue : M.gate);
    tree(-9.6, z - 8);
  }

  // Corner houses at the junction
  house(15, -4, 7.5, 3.4, 7.5, M.wallSand2, M.roofBlue, 0);
  house(-15, -17, 7.5, 3.4, 7.5, M.wallWhite, M.roofRed, 0);
  house(15, -34, 7, 3.0, 7, M.wallBrick, M.roofGreen, 0);

  // Local shops north of the junction
  shop(10.5, -24, 6.5, 5, -Math.PI / 2, M.awning, M.awning);
  shop(10.5, -33.5, 5.5, 5, -Math.PI / 2, M.awning2, M.awning2);
  shop(-10.5, -28, 6.5, 5, Math.PI / 2, M.awning, M.awning2);

  tree(-7.2, -20, 1.1);
  tree(7.2, -44, 0.95);
  tree(-7.2, -52, 1.05);
  tree(-12.5, 70);
  tree(-12.5, 62, 0.9);
  tree(13, 78, 1.1);
  tree(13, 90, 0.95);

  // Street lighting and power poles down the street, with wires strung between
  for (z = -84; z <= 100; z += 20) {
    streetLight(6.8, z, false);
    streetLight(-6.8, z + 10, true);
  }
  var polePositions = [];
  for (z = -90; z <= 100; z += 24) {
    powerPole(9.2, z);
    polePositions.push(z);
  }
  for (i = 0; i < polePositions.length - 1; i++) {
    wireBetween(8.9, polePositions[i], polePositions[i + 1], 6.45);
    wireBetween(9.5, polePositions[i], polePositions[i + 1], 6.45);
    wireBetween(9.2, polePositions[i], polePositions[i + 1], 5.95);
  }

  // Road signs
  roadSign(6.9, -20, 'junction');
  roadSign(-6.9, 26, 'speed');
  roadSign(6.9, 60, 'speed');

  // Neighbours' cars parked along the kerb
  parkedCar(3.9, 8, 0, 'nexia');
  parkedCar(3.9, 36, 0, 'gentra');
  parkedCar(-3.9, -46, Math.PI, 'spark');
  parkedCar(3.9, -54, 0, 'damas');
  parkedCar(-3.9, 60, Math.PI, 'malibu');
  parkedCar(-3.9, 14, Math.PI, 'nexia');

  // ======================================================== CAR PARK
  var bay = { x: -9.0, z: 88 };
  var baySize = { w: 4.8, d: 7.6 };

  var lot = new THREE.Mesh(new THREE.PlaneGeometry(15, 20), M.asphaltWorn);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(-10, 0.011, 88);
  lot.receiveShadow = shadows;
  group.add(lot);

  // the throat joining the lot to the street
  flat(7, 11, M.asphaltWorn, -3.5, 84, 0.011);

  // painted bays: white lines for the neighbours, yellow for the target
  function paintBay(cx, cz, w, d, mat) {
    flat(0.13, d, mat, cx - w / 2, cz, 0.022);
    flat(0.13, d, mat, cx + w / 2, cz, 0.022);
    flat(w, 0.13, mat, cx, cz + d / 2, 0.022);
  }
  paintBay(bay.x - baySize.w - 0.4, bay.z, baySize.w, baySize.d, M.lineWhite);
  paintBay(bay.x + baySize.w + 0.4, bay.z, baySize.w, baySize.d, M.lineWhite);
  paintBay(bay.x, bay.z, baySize.w, baySize.d, M.lineYellow);

  // soft highlight inside the target bay
  var zoneFill = flat(baySize.w - 0.2, baySize.d - 0.2, M.zone, bay.x, bay.z, 0.023);

  // a big painted P at the head of the bay
  flat(0.2, 1.0, M.lineYellow, bay.x - 0.35, bay.z + 2.6, 0.023);
  flat(0.55, 0.18, M.lineYellow, bay.x - 0.1, bay.z + 2.2, 0.023);
  flat(0.55, 0.18, M.lineYellow, bay.x - 0.1, bay.z + 2.95, 0.023);
  flat(0.18, 0.75, M.lineYellow, bay.x + 0.15, bay.z + 2.6, 0.023);

  roadSign(bay.x - baySize.w / 2 - 1.8, bay.z - 3.4, 'parking');

  // neighbours already parked in the lot
  parkedCar(bay.x - baySize.w - 0.4, bay.z, 0, 'gentra');
  parkedCar(bay.x + baySize.w + 0.4, bay.z, 0, 'spark');

  streetLight(bay.x - 7.5, bay.z + 5, false);
  tree(-16.5, 79);
  tree(-16.5, 97, 1.1);

  // low wall closing the far end of the lot
  compoundWall(-10, 97.6, 14, 0, 0.6);

  // ======================================================== START LINE
  flat(9, 0.7, M.lineWhite, 0, -76, 0.022);
  flat(1.2, 1.2, M.lineYellow, -3, -76, 0.023);
  flat(1.2, 1.2, M.lineYellow, 3, -76, 0.023);

  // ======================================================== BOUNDARY
  var B = 124;
  boxObs(0, -B, GROUND, 6);
  boxObs(0, B, GROUND, 6);
  boxObs(-B, 0, 6, GROUND);
  boxObs(B, 0, 6, GROUND);

  scene.add(group);

  return {
    group: group,
    obstacles: obstacles,
    parkedCars: parkedCars,
    parkingZone: {
      center: bay,
      width: baySize.w,
      depth: baySize.d,
      targetHeading: Math.PI,
      headingTolerance: 0.45,
      fill: zoneFill
    },
    spawnPoint: { x: 0, z: -70, heading: Math.PI },
    name: 'KICHIK ITTIFOQ — TOSHKENT VILOYATI'
  };
}

window.buildKichikIttifoqMap = buildKichikIttifoqMap;
