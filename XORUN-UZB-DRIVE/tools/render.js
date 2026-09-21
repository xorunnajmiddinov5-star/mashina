/* ==========================================================================
   tools/render.js
   An offline renderer used to LOOK at the game without a browser.

   It provides a Three.js-compatible stub whose geometries generate real
   triangles, walks the scene graph, transforms and projects everything,
   then rasterises it with a z-buffer and flat Lambert shading into a PNG.

   Back-face culling matches MeshStandardMaterial's default FrontSide, so a
   winding mistake shows up here exactly as it would in the browser.
   ========================================================================== */

const zlib = require('zlib');

/* ----------------------------------------------------------- vector math */
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};

function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
    o[r * 4 + c] = s;
  }
  return o;
}
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function translation(x, y, z) { const m = identity(); m[3] = x; m[7] = y; m[11] = z; return m; }
function scaling(x, y, z) { const m = identity(); m[0] = x; m[5] = y; m[10] = z; return m; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); const m = identity(); m[5] = c; m[6] = -s; m[9] = s; m[10] = c; return m; }
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); const m = identity(); m[0] = c; m[2] = s; m[8] = -s; m[10] = c; return m; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); const m = identity(); m[0] = c; m[1] = -s; m[4] = s; m[5] = c; return m; }
function apply(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]
  ];
}

/* ------------------------------------------------------ geometry builders */
function quad(out, a, b, c, d) { tri(out, a, b, c); tri(out, a, c, d); }
function tri(out, a, b, c) { out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }

function boxTris(w = 1, h = 1, d = 1) {
  const x = w / 2, y = h / 2, z = d / 2, o = [];
  const p = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  quad(o, p[4], p[5], p[6], p[7]); // +z
  quad(o, p[1], p[0], p[3], p[2]); // -z
  quad(o, p[5], p[1], p[2], p[6]); // +x
  quad(o, p[0], p[4], p[7], p[3]); // -x
  quad(o, p[3], p[7], p[6], p[2]); // +y
  quad(o, p[0], p[1], p[5], p[4]); // -y
  return o;
}
function planeTris(w = 1, h = 1) {
  const x = w / 2, y = h / 2, o = [];
  quad(o, [-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]);
  return o;
}
function circleTris(r = 1, seg = 16) {
  const o = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
    tri(o, [0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], [Math.cos(b) * r, Math.sin(b) * r, 0]);
  }
  return o;
}
function ringTris(ri = 0.5, ro = 1, seg = 16) {
  const o = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
    quad(o,
      [Math.cos(a) * ri, Math.sin(a) * ri, 0], [Math.cos(a) * ro, Math.sin(a) * ro, 0],
      [Math.cos(b) * ro, Math.sin(b) * ro, 0], [Math.cos(b) * ri, Math.sin(b) * ri, 0]);
  }
  return o;
}
function cylinderTris(rt = 1, rb = 1, h = 1, seg = 12) {
  const o = [], y = h / 2;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
    const ta = [Math.cos(a) * rt, y, Math.sin(a) * rt], tb = [Math.cos(b) * rt, y, Math.sin(b) * rt];
    const ba = [Math.cos(a) * rb, -y, Math.sin(a) * rb], bb = [Math.cos(b) * rb, -y, Math.sin(b) * rb];
    if (rt > 0 && rb > 0) quad(o, ba, bb, tb, ta);
    else if (rt === 0) tri(o, ba, bb, [0, y, 0]);
    else tri(o, [0, -y, 0], tb, ta);
    if (rt > 0) tri(o, [0, y, 0], ta, tb);
    if (rb > 0) tri(o, [0, -y, 0], bb, ba);
  }
  return o;
}
function sphereTris(r = 1, ws = 10, hs = 8) {
  const o = [];
  for (let i = 0; i < hs; i++) {
    const p0 = (i / hs) * Math.PI, p1 = ((i + 1) / hs) * Math.PI;
    for (let j = 0; j < ws; j++) {
      const t0 = (j / ws) * Math.PI * 2, t1 = ((j + 1) / ws) * Math.PI * 2;
      const P = (p, t) => [r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)];
      quad(o, P(p0, t0), P(p1, t0), P(p1, t1), P(p0, t1));
    }
  }
  return o;
}
function torusTris(r = 1, tube = 0.3, rad = 6, tub = 12) {
  const o = [];
  const P = (u, v) => {
    const cu = Math.cos(u), su = Math.sin(u);
    return [(r + tube * Math.cos(v)) * cu, (r + tube * Math.cos(v)) * su, tube * Math.sin(v)];
  };
  for (let i = 0; i < tub; i++) {
    const u0 = (i / tub) * Math.PI * 2, u1 = ((i + 1) / tub) * Math.PI * 2;
    for (let j = 0; j < rad; j++) {
      const v0 = (j / rad) * Math.PI * 2, v1 = ((j + 1) / rad) * Math.PI * 2;
      quad(o, P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1));
    }
  }
  return o;
}

/* --------------------------------------------------------- THREE stub */
function Geo(tris) { this.tris = tris; this.attributes = { position: makeAttr(tris) }; }
Geo.prototype.computeVertexNormals = function () {};
function makeAttr(arr) {
  return {
    array: arr,
    count: arr.length / 3,
    needsUpdate: false,
    getX: i => arr[i * 3], getY: i => arr[i * 3 + 1], getZ: i => arr[i * 3 + 2],
    setX: (i, v) => { arr[i * 3] = v; }, setY: (i, v) => { arr[i * 3 + 1] = v; }, setZ: (i, v) => { arr[i * 3 + 2] = v; }
  };
}

function Vector3(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
Vector3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
Vector3.prototype.copy = function (v) { return this.set(v.x, v.y, v.z); };
Vector3.prototype.clone = function () { return new Vector3(this.x, this.y, this.z); };
Vector3.prototype.lerp = function (v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; };

function Object3D() {
  this.children = [];
  this.position = new Vector3();
  this.rotation = { x: 0, y: 0, z: 0 };
  this.scale = new Vector3(1, 1, 1);
  this.visible = true;
  this.isMesh = false;
  this.castShadow = false;
  this.receiveShadow = false;
}
Object3D.prototype.add = function () { for (const a of arguments) if (a) this.children.push(a); };
Object3D.prototype.remove = function (o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); };
Object3D.prototype.traverse = function (cb) { cb(this); this.children.forEach(c => c.traverse && c.traverse(cb)); };
Object3D.prototype.updateMatrixWorld = function () {};
Object3D.prototype.clone = function () {
  const c = new (this.constructor)(this.geometry, this.material);
  c.position = this.position.clone();
  c.rotation = Object.assign({}, this.rotation);
  c.isMesh = this.isMesh;
  c.geometry = this.geometry; c.material = this.material;
  return c;
};

function Mesh(geometry, material) {
  Object3D.call(this);
  this.geometry = geometry; this.material = material; this.isMesh = true;
}
Mesh.prototype = Object.create(Object3D.prototype);
Mesh.prototype.constructor = Mesh;

function Material(p) { Object.assign(this, p || {}); }
Material.prototype.clone = function () { return new Material(this); };

function BufferGeometry() { this.tris = []; this.attributes = {}; }
BufferGeometry.prototype.setAttribute = function (name, attr) {
  this.attributes[name] = attr;
  if (name === 'position') this.tris = Array.from(attr.array);
};
BufferGeometry.prototype.computeVertexNormals = function () {};

function BufferAttribute(array) { return makeAttr(Array.from(array)); }

const THREE = {
  REVISION: '128',
  Vector3, Object3D, Group: Object3D, Scene: Object3D, Mesh,
  BufferGeometry, BufferAttribute, Float32BufferAttribute: BufferAttribute,
  BoxGeometry: function (w, h, d) { return new Geo(boxTris(w, h, d)); },
  PlaneGeometry: function (w, h) { return new Geo(planeTris(w, h)); },
  CircleGeometry: function (r, s) { return new Geo(circleTris(r, s)); },
  RingGeometry: function (ri, ro, s) { return new Geo(ringTris(ri, ro, s)); },
  CylinderGeometry: function (rt, rb, h, s) { return new Geo(cylinderTris(rt, rb, h, s)); },
  ConeGeometry: function (r, h, s) { return new Geo(cylinderTris(0, r, h, s)); },
  SphereGeometry: function (r, w, h) { return new Geo(sphereTris(r, w, h)); },
  TorusGeometry: function (r, t, rad, tub) { return new Geo(torusTris(r, t, rad, tub)); },
  MeshStandardMaterial: Material, MeshBasicMaterial: Material, MeshPhongMaterial: Material,
  SpotLight: function () { const o = new Object3D(); o.target = new Object3D(); o.isLight = true; return o; },
  PointLight: function () { const o = new Object3D(); o.isLight = true; return o; },
  DirectionalLight: function () {
    const o = new Object3D(); o.isLight = true; o.target = new Object3D();
    o.shadow = { mapSize: {}, camera: {}, bias: 0 };
    return o;
  },
  HemisphereLight: function () { const o = new Object3D(); o.isLight = true; return o; },
  AmbientLight: function () { const o = new Object3D(); o.isLight = true; return o; },
  Color: function (c) { this.value = c; },
  Fog: function (c, n, f) { this.color = c; this.near = n; this.far = f; },
  DoubleSide: 2, FrontSide: 0, BackSide: 1,
  PCFSoftShadowMap: 1, sRGBEncoding: 3001,
  MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Clock: function () { this.getDelta = () => 1 / 60; },
  PerspectiveCamera: function (fov, aspect, near, far) {
    const o = new Object3D();
    o.fov = fov; o.aspect = aspect; o.near = near; o.far = far;
    o.lookAt = function (v) { o._target = [v.x, v.y, v.z]; };
    o.updateProjectionMatrix = function () {};
    return o;
  },
  WebGLRenderer: function () {
    return { shadowMap: {}, setPixelRatio() {}, setSize() {}, render() {} };
  }
};

/* ------------------------------------------------------------ rasteriser */
function collect(node, parent, out) {
  if (!node.visible) return;
  const m = matMul(parent, matMul(
    translation(node.position.x, node.position.y, node.position.z),
    matMul(matMul(rotX(node.rotation.x), rotY(node.rotation.y)), matMul(rotZ(node.rotation.z),
      scaling(node.scale.x, node.scale.y, node.scale.z)))
  ));
  if (node.isMesh && node.geometry && node.geometry.tris && node.geometry.tris.length) {
    const t = node.geometry.tris;
    for (let i = 0; i < t.length; i += 9) {
      out.push({
        a: apply(m, [t[i], t[i + 1], t[i + 2]]),
        b: apply(m, [t[i + 3], t[i + 4], t[i + 5]]),
        c: apply(m, [t[i + 6], t[i + 7], t[i + 8]]),
        mat: node.material || {}
      });
    }
  }
  node.children.forEach(ch => collect(ch, m, out));
}

function hexToRGB(h) {
  if (h === undefined || h === null) h = 0xcccccc;
  return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
}

function renderScene(scene, opts) {
  const W = opts.width || 900, H = opts.height || 560;
  const eye = opts.eye, target = opts.target, fov = (opts.fov || 55) * Math.PI / 180;
  const sky = hexToRGB(opts.background === undefined ? 0x9ccfdd : opts.background);
  const lightDir = V.norm(opts.light || [0.5, 0.85, 0.35]);
  const ambient = opts.ambient === undefined ? 0.38 : opts.ambient;
  const fogNear = opts.fogNear || 60, fogFar = opts.fogFar || 220;

  // view basis
  const fwd = V.norm(V.sub(target, eye));
  const right = V.norm(V.cross(fwd, [0, 1, 0]));
  const up = V.cross(right, fwd);

  const tris = [];
  collect(scene, identity(), tris);

  const color = new Float32Array(W * H * 3);
  const depth = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W * H; i++) {
    // simple vertical sky gradient
    const y = Math.floor(i / W) / H;
    color[i * 3] = sky[0] * (0.82 + 0.22 * y);
    color[i * 3 + 1] = sky[1] * (0.85 + 0.18 * y);
    color[i * 3 + 2] = sky[2] * (0.95 + 0.08 * y);
  }

  const f = 1 / Math.tan(fov / 2);
  const aspect = W / H;

  function toView(p) {
    const d = V.sub(p, eye);
    return [V.dot(d, right), V.dot(d, up), V.dot(d, fwd)];
  }
  function projectView(v) {
    return {
      x: (v[0] * f / aspect / v[2] * 0.5 + 0.5) * W,
      y: (1 - (v[1] * f / v[2] * 0.5 + 0.5)) * H,
      z: v[2]
    };
  }

  /** Sutherland-Hodgman clip of a view-space polygon against the near plane.
      Without this, any triangle with a vertex behind the camera would be
      dropped whole — which silently hides large ground and road quads. */
  function clipNear(poly, near) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a[2] >= near, bin = b[2] >= near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (near - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
      }
    }
    return out;
  }

  const opaque = [], transparent = [];
  for (const t of tris) (t.mat.transparent ? transparent : opaque).push(t);

  transparent.sort((p, q) => {
    const dz = t => V.dot(V.sub([(t.a[0] + t.b[0] + t.c[0]) / 3, (t.a[1] + t.b[1] + t.c[1]) / 3, (t.a[2] + t.b[2] + t.c[2]) / 3], eye), fwd);
    return dz(q) - dz(p);
  });

  let drawn = 0, culled = 0, clipped = 0;

  function shadeOf(t) {
    const n = V.norm(V.cross(V.sub(t.b, t.a), V.sub(t.c, t.a)));
    const twoSided = t.mat.side === 2 || t.mat.transparent;
    let lambert = V.dot(n, lightDir);
    if (twoSided) lambert = Math.abs(lambert);
    lambert = Math.max(0, lambert);

    const base = hexToRGB(t.mat.color);
    const unlit = t.mat.depthWrite === false;
    let shade = unlit ? 1 : ambient + lambert * 0.85;
    if (!unlit) shade += Math.max(0, n[1]) * 0.12;

    let r = base[0] * shade, g = base[1] * shade, b = base[2] * shade;
    if (t.mat.emissiveIntensity) {
      const e = Math.min(1.4, t.mat.emissiveIntensity);
      const em = hexToRGB(t.mat.emissive);
      r += em[0] * e * 0.7; g += em[1] * e * 0.7; b += em[2] * e * 0.7;
    }
    return { r, g, b, alpha: t.mat.transparent ? (t.mat.opacity === undefined ? 1 : t.mat.opacity) : 1 };
  }

  function fillTri(A, B, C, col, writeDepth) {
    const minX = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(A.x, B.x, C.x)));
    const minY = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(A.y, B.y, C.y)));
    if (maxX < minX || maxY < minY) return;

    const denom = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(denom) < 1e-9) return;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const w0 = ((B.y - C.y) * (cx - C.x) + (C.x - B.x) * (cy - C.y)) / denom;
        const w1 = ((C.y - A.y) * (cx - C.x) + (A.x - C.x) * (cy - C.y)) / denom;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.0005 || w1 < -0.0005 || w2 < -0.0005) continue;

        const zz = 1 / (w0 / A.z + w1 / B.z + w2 / C.z);
        const idx = py * W + px;
        if (zz >= depth[idx] || zz <= 0) continue;

        const fogT = Math.max(0, Math.min(1, (zz - fogNear) / (fogFar - fogNear)));
        let rr = col.r * (1 - fogT) + sky[0] * fogT;
        let gg = col.g * (1 - fogT) + sky[1] * fogT;
        let bb = col.b * (1 - fogT) + sky[2] * fogT;

        if (col.alpha < 1) {
          rr = color[idx * 3] * (1 - col.alpha) + rr * col.alpha;
          gg = color[idx * 3 + 1] * (1 - col.alpha) + gg * col.alpha;
          bb = color[idx * 3 + 2] * (1 - col.alpha) + bb * col.alpha;
        }

        color[idx * 3] = rr; color[idx * 3 + 1] = gg; color[idx * 3 + 2] = bb;
        if (writeDepth) depth[idx] = zz;
      }
    }
  }

  function drawTri(t, writeDepth) {
    const poly = clipNear([toView(t.a), toView(t.b), toView(t.c)], 0.08);
    if (poly.length < 3) return;
    if (poly.length > 3) clipped++;

    const pts = poly.map(projectView);

    const area = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y);
    const twoSided = t.mat.side === 2 || t.mat.transparent;
    if (area === 0) return;
    if (!twoSided && area > 0) { culled++; return; }
    drawn++;

    const col = shadeOf(t);
    for (let i = 1; i + 1 < pts.length; i++) fillTri(pts[0], pts[i], pts[i + 1], col, writeDepth);
  }

  opaque.forEach(t => drawTri(t, true));
  transparent.forEach(t => drawTri(t, false));

  return { color, width: W, height: H, stats: { triangles: tris.length, drawn, culled, clipped } };
}

/* ------------------------------------------------------------------ PNG */
function writePNG(file, img) {
  const { color, width: W, height: H } = img;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) {
        let v = color[i + k];
        v = v <= 0 ? 0 : Math.pow(v, 1 / 2.2); // gamma
        raw[o++] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  require('fs').writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]));
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

module.exports = { THREE, renderScene, writePNG, Object3D, Vector3 };
