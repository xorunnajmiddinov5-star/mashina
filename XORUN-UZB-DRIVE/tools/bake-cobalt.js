/* tools/bake-cobalt.js  —  builds assets/cars/cobalt-model.js
   Authors the Chevrolet Cobalt mesh ONCE, offline (node tools/bake-cobalt.js).
   The game does not construct the car at runtime: it loads the baked mesh.
   Own work, no third-party asset, so there is no licence to comply with.
   Car faces -Z, origin on the ground between the axles, units = metres.   */
'use strict';
const fs = require('fs'), path = require('path');

/* ------------------------------------------------------------- maths */
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function pchip(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), h = [], d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n-1; i++) { h[i] = xs[i+1]-xs[i]; d[i] = (ys[i+1]-ys[i])/h[i]; }
  m[0] = d[0]; m[n-1] = d[n-2];
  for (let i = 1; i < n-1; i++) {
    if (d[i-1]*d[i] <= 0) m[i] = 0;
    else { const w1 = 2*h[i]+h[i-1], w2 = h[i]+2*h[i-1]; m[i] = (w1+w2)/(w1/d[i-1]+w2/d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n-1]) return ys[n-1];
    let i = 0; while (x > xs[i+1]) i++;
    const t = (x-xs[i])/h[i], t2 = t*t, t3 = t2*t;
    return (2*t3-3*t2+1)*ys[i] + (t3-2*t2+t)*h[i]*m[i] + (-2*t3+3*t2)*ys[i+1] + (t3-t2)*h[i]*m[i+1];
  };
}
function cr(p0, p1, p2, p3, t) {
  const t2 = t*t, t3 = t2*t;
  return [0, 1].map(k => 0.5*((2*p1[k]) + (-p0[k]+p2[k])*t + (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2 + (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3));
}
function place(pl, p) {               // local -> world: rotZ, rotX, rotY, translate
  let [x, y, z] = p;
  if (pl.rz) { const c = Math.cos(pl.rz), s = Math.sin(pl.rz); [x, y] = [x*c-y*s, x*s+y*c]; }
  if (pl.rx) { const c = Math.cos(pl.rx), s = Math.sin(pl.rx); [y, z] = [y*c-z*s, y*s+z*c]; }
  if (pl.ry) { const c = Math.cos(pl.ry), s = Math.sin(pl.ry); [x, z] = [x*c+z*s, -x*s+z*c]; }
  return [x+pl.p[0], y+pl.p[1], z+pl.p[2]];
}
function rrect(w, h, r, seg = 3) {
  const pts = [], cx = w/2-r, cy = h/2-r;
  [[cx, cy, 0], [-cx, cy, 90], [-cx, -cy, 180], [cx, -cy, 270]].forEach(([ox, oy, a0]) => {
    for (let k = 0; k <= seg; k++) { const a = (a0+90*k/seg)*Math.PI/180; pts.push([ox+r*Math.cos(a), oy+r*Math.sin(a)]); }
  });
  return pts;
}
const ngon = (r, n, sx = 1, sy = 1) => Array.from({ length: n }, (_, i) => [r*sx*Math.cos(i*2*Math.PI/n), r*sy*Math.sin(i*2*Math.PI/n)]);

/* -------------------------------------------------------------- parts */
class Part {
  constructor(name, mat) { this.name = name; this.mat = mat; this.pos = []; this.idx = []; this.map = new Map(); }
  v(key, p) { let i = this.map.get(key); if (i === undefined) { i = this.pos.length/3; this.pos.push(p[0], p[1], p[2]); this.map.set(key, i); } return i; }
  raw(p) { const i = this.pos.length/3; this.pos.push(p[0], p[1], p[2]); return i; }
  tri(a, b, c, flip) { if (flip) this.idx.push(a, c, b); else this.idx.push(a, b, c); }
  /* flat triangle with its own vertices, wound so the normal faces away from ref */
  ftri(a, b, c, ref) {
    const n = cross(sub(b, a), sub(c, a)), cen = [(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3];
    const flip = dot(n, sub(cen, ref)) < 0;
    const i = this.raw(a), j = this.raw(b), k = this.raw(c);
    this.tri(i, j, k, flip);
  }
  fquad(a, b, c, d, out) { // quad, normal toward `out` direction
    const n = cross(sub(b, a), sub(c, a)), flip = dot(n, out) < 0;
    const i = this.raw(a), j = this.raw(b), k = this.raw(c), l = this.raw(d);
    this.tri(i, j, k, flip); this.tri(i, k, l, flip);
  }
  prism(poly, depth, pl) {
    const top = poly.map(p => place(pl, [p[0], p[1], depth/2])), bot = poly.map(p => place(pl, [p[0], p[1], -depth/2]));
    const all = top.concat(bot), ref = [0, 1, 2].map(k => all.reduce((s, q) => s+q[k], 0)/all.length), n = poly.length;
    for (let i = 1; i < n-1; i++) { this.ftri(top[0], top[i], top[i+1], ref); this.ftri(bot[0], bot[i], bot[i+1], ref); }
    for (let i = 0; i < n; i++) { const j = (i+1) % n; this.ftri(top[i], top[j], bot[j], ref); this.ftri(top[i], bot[j], bot[i], ref); }
  }
  ellipsoid(c, rx, ry, rz, ns = 10, nl = 7) {
    const g = [];
    for (let a = 0; a <= nl; a++) { const th = Math.PI*a/nl, row = []; for (let b = 0; b < ns; b++) { const ph = 2*Math.PI*b/ns; row.push(this.raw([c[0]+rx*Math.sin(th)*Math.cos(ph), c[1]+ry*Math.cos(th), c[2]+rz*Math.sin(th)*Math.sin(ph)])); } g.push(row); }
    for (let a = 0; a < nl; a++) for (let b = 0; b < ns; b++) {
      const b2 = (b+1) % ns, A = g[a][b], B = g[a][b2], C = g[a+1][b2], D = g[a+1][b];
      [[A, B, C], [A, C, D]].forEach(t => { const p = t.map(i => [this.pos[i*3], this.pos[i*3+1], this.pos[i*3+2]]); const nn = cross(sub(p[1], p[0]), sub(p[2], p[0])); const cen = [0, 1, 2].map(k => (p[0][k]+p[1][k]+p[2][k])/3-c[k]); this.tri(t[0], t[1], t[2], dot(nn, cen) < 0); });
    }
  }
  /* revolve profile [[r, x]...] around the X axis */
  lathe(profile, seg, xc) {
    const g = profile.map(([r, x]) => Array.from({ length: seg }, (_, k) => { const a = 2*Math.PI*k/seg; return this.raw([x, r*Math.cos(a), r*Math.sin(a)]); }));
    for (let i = 0; i < profile.length-1; i++) for (let k = 0; k < seg; k++) {
      const k2 = (k+1) % seg, A = g[i][k], B = g[i][k2], C = g[i+1][k2], D = g[i+1][k];
      [[A, B, C], [A, C, D]].forEach(t => {
        const p = t.map(q => [this.pos[q*3], this.pos[q*3+1], this.pos[q*3+2]]), nn = cross(sub(p[1], p[0]), sub(p[2], p[0]));
        const cen = [(p[0][0]+p[1][0]+p[2][0])/3-xc, (p[0][1]+p[1][1]+p[2][1])/3, (p[0][2]+p[1][2]+p[2][2])/3];
        if (Math.hypot(nn[0], nn[1], nn[2]) > 1e-12) this.tri(t[0], t[1], t[2], dot(nn, cen) < 0);
      });
    }
  }
}

/* ----------------------------------------------------- body definition */
const L2 = 2.24, WY = 0.317, WZ = 1.31, RA = 0.375, TRACK = 0.74;   // half length, wheel radius, axle |z|, arch radius, track/2
const hwF = pchip([[-2.24,.56],[-2.22,.68],[-2.17,.78],[-2.05,.84],[-1.85,.862],[-1.4,.872],[1.4,.872],[1.85,.862],[2.05,.842],[2.17,.78],[2.22,.68],[2.24,.56]]);
const ybF = pchip([[-2.24,.27],[-2.2,.24],[-2.1,.21],[-1.9,.2],[1.9,.2],[2.1,.22],[2.2,.26],[2.24,.31]]);
const beltF = pchip([[-2.24,.64],[-2.2,.69],[-2.05,.77],[-1.7,.86],[-1.2,.925],[-0.95,.95],[-0.5,.98],[0.5,.985],[1.2,.98],[1.6,.97],[1.9,.955],[2.15,.93],[2.24,.84]]);
const topF = pchip([[-2.24,.71],[-2.21,.77],[-2.12,.83],[-1.9,.895],[-1.5,.95],[-1.1,.985],[-0.95,1.0],[-0.80,1.09],[-0.6,1.25],[-0.40,1.37],[-0.22,1.44],[0.0,1.465],[0.35,1.475],[0.8,1.445],[1.15,1.35],[1.4,1.2],[1.6,1.05],[1.75,1.01],[2.0,1.0],[2.15,.985],[2.22,.92],[2.24,.82]]);
const rfF = pchip([[-2.24,.78],[-1.5,.86],[-1.0,.84],[-0.85,.83],[-0.5,.8],[-0.2,.8],[0.4,.8],[1.0,.8],[1.4,.8],[1.7,.83],[1.9,.85],[2.24,.78]]);
function archTop(z) { let best = 0; [-WZ, WZ].forEach(c => { const d = Math.abs(z-c); if (d <= RA) best = Math.max(best, WY+Math.sqrt(RA*RA-d*d)); }); return best; }

const SEGN = [2, 2, 2, 2, 2, 1, 4, 4, 2, 2, 2];   // samples per control segment (right half)
function ctrl(z) {
  const hw = hwF(z), yb = Math.max(ybF(z), archTop(z)), belt = Math.max(beltF(z), yb+0.3), top = Math.max(topF(z), belt+0.02), rhw = hw*rfF(z);
  const ymid = yb+0.5*(belt-yb);
  return [[0, yb], [hw*.70, yb], [hw*.93, yb+.025], [hw*.995, yb+.12], [hw*1.0, ymid], [hw*.99, belt-.02], [hw*.97, belt],
    [(hw*.97+rhw)/2, (belt+top)/2], [rhw, top-.025], [rhw*.86, top-.012], [rhw*.5, top-.004], [0, top]];
}
function ringAt(z) {
  const P = ctrl(z), pts = [], seg = [], sub_ = [];
  for (let s = 0; s < P.length-1; s++) for (let k = 0; k < SEGN[s]; k++) {
    pts.push(cr(P[Math.max(0, s-1)], P[s], P[s+1], P[Math.min(P.length-1, s+2)], k/SEGN[s])); seg.push(s); sub_.push(k);
  }
  pts.push(P[P.length-1]); seg.push(10); sub_.push(2);
  return { pts, seg, sub: sub_, P };
}
/* full ring (right half up, then left half down) as [x,y] list + quad metadata */
function fullRing(z) {
  const r = ringAt(z), N = r.pts.length, ring = r.pts.map(p => p.slice());
  for (let m = 1; m <= N-2; m++) ring.push([-r.pts[N-1-m][0], r.pts[N-1-m][1]]);
  const qseg = [], qsub = [];
  for (let j = 0; j < ring.length; j++) { const b = j <= N-2 ? j : 2*N-3-j; qseg.push(r.seg[b]); qsub.push(r.sub[b]); }
  return { ring, qseg, qsub, N, P: r.P };
}

/* stations */
let zs = []; for (let z = -L2; z <= L2+1e-9; z += 0.09) zs.push(+z.toFixed(4));
[-1.0, 1.0].forEach(sg => { [0, .13, .25, .33, .368, .375, .378, .42].forEach(d => { zs.push(+(sg*WZ+d).toFixed(4)); zs.push(+(sg*WZ-d).toFixed(4)); }); });
[-2.235, -2.225, -2.21, -2.19, -2.16, 2.235, 2.225, 2.21, 2.19, 2.16].forEach(z => zs.push(z));
zs = Array.from(new Set(zs)).sort((a, b) => a-b);
const ST = zs.map(z => Object.assign({ z }, fullRing(z))), M = ST[0].ring.length, N = ST[0].N;

const inWZ = (z, y, tol) => [-WZ, WZ].some(c => Math.hypot(z-c, y-WY) < RA+tol);
const between = (z, a, b) => z >= a && z <= b;
const zone = z => ({ ws: between(z, -0.93, -0.24), rw: between(z, 1.04, 1.74), sideGlass: between(z, -0.62, 0.27) || between(z, 0.36, 1.22), bpillar: between(z, 0.27, 0.36) });

const body = new Part('body', 'paint'), glass = new Part('glass', 'glass'), trim = new Part('trim', 'trim'),
      chrome = new Part('chrome', 'chrome'), gold = new Part('gold', 'gold'), head = new Part('headlamp', 'headlamp'),
      tail = new Part('taillamp', 'taillamp'), rev = new Part('reverse', 'reverse'), amber = new Part('amber', 'amber'),
      plate = new Part('plate', 'plate'), inter = new Part('interior', 'interior');

/* ---- loft skin ---- */
{
  const P3 = (s, j) => [ST[s].ring[j][0], ST[s].ring[j][1], ST[s].z];
  const nt = cross(sub(P3(20, 5), P3(20, 4)), sub(P3(21, 5), P3(20, 4)));   // right-flank test quad
  const flip = nt[0] < 0;
  for (let s = 0; s < ST.length-1; s++) {
    const zm = (ST[s].z+ST[s+1].z)/2, zn = zone(zm);
    for (let j = 0; j < M; j++) {
      const k = (j+1) % M, sg = ST[s].qseg[j], sb = ST[s].qsub[j];
      const ia = [s, j], ib = [s, k], ic = [s+1, k], id = [s+1, j];
      let part = body;
      const ym = (ST[s].ring[j][1]+ST[s].ring[k][1])/2;
      if (sg <= 1) part = trim;                                    // underbody
      else if (sg <= 4 && inWZ(zm, ym, 0.045)) part = trim;        // wheel-arch liner
      else if ((sg === 6 || sg === 7) && ST[s].P[8][1]-ST[s].P[6][1] > 0.16) {
        const isFrame = (sg === 6 && sb === 0) || (sg === 7 && sb === 3);
        if (zn.bpillar) part = trim; else if (zn.sideGlass && !isFrame) part = glass;
      } else if ((sg === 9 || sg === 10) && (zn.ws || zn.rw)) part = glass;
      [ia, ib, ic, id].forEach(q => part.v(q[0]*1000+q[1], P3(q[0], q[1])));
      const A = part.v(s*1000+j, P3(s, j)), B = part.v(s*1000+k, P3(s, k)), C = part.v((s+1)*1000+k, P3(s+1, k)), D = part.v((s+1)*1000+j, P3(s+1, j));
      part.tri(A, B, C, flip); part.tri(A, C, D, flip);
    }
  }
  [[0, -1], [ST.length-1, 1]].forEach(([s, dir]) => {
    const st = ST[s], c = [0, st.ring.reduce((t, p) => t+p[1], 0)/M, st.z], ci = body.raw(c);
    const idxs = st.ring.map((p, j) => body.v('c'+s+'_'+j, [p[0], p[1], st.z]));
    for (let j = 0; j < M; j++) { const k = (j+1) % M; const n = cross(sub([st.ring[j][0], st.ring[j][1], st.z], c), sub([st.ring[k][0], st.ring[k][1], st.z], c)); body.tri(ci, idxs[j], idxs[k], n[2]*dir < 0); }
  });
}

/* ---- wheel-well walls + undertray (closes the see-through gap) ---- */
[-1, 1].forEach(sx => [-WZ, WZ].forEach(zc => {
  const x = sx*0.60, poly = [];
  for (let a = 0; a <= 12; a++) { const th = Math.PI*a/12; poly.push([zc+RA*Math.cos(th), WY+RA*Math.sin(th)]); }
  poly.push([zc-RA, 0.2], [zc+RA, 0.2]);
  const c = [x, 0.5, zc];
  for (let i = 1; i < poly.length-1; i++) trim.ftri([x, poly[0][1], poly[0][0]], [x, poly[i][1], poly[i][0]], [x, poly[i+1][1], poly[i+1][0]], [x+(-sx), 0.5, zc]);
}));
trim.prism([[-0.62, -2.05], [0.62, -2.05], [0.62, 2.05], [-0.62, 2.05]].map(p => p), 0.02, { p: [0, 0.205, 0], rx: Math.PI/2 });

/* ---- ribbons on the skin: door lines, hood / boot lines ---- */
function ribbon(part, z, jA, jB, w, off, both) {
  const r = fullRing(z), R = r.ring;
  [1, -1].forEach(sd => {
    if (!both && sd < 0) return;
    for (let j = jA; j < jB; j++) {
      const q = (i) => { const a = R[Math.max(i-1, 0)], b = R[Math.min(i+1, N-1)], t = [b[0]-a[0], b[1]-a[1]], l = Math.hypot(t[0], t[1]); return { x: R[i][0], y: R[i][1], nx: t[1]/l, ny: -t[0]/l }; };
      const p0 = q(j), p1 = q(j+1);
      const pt = (p, zz) => [sd*(p.x+p.nx*off), p.y+p.ny*off, zz];
      part.fquad(pt(p0, z-w/2), pt(p1, z-w/2), pt(p1, z+w/2), pt(p0, z+w/2), [sd*p0.nx, p0.ny, 0]);
    }
  });
}
[-0.68, 0.32, 1.22].forEach(z => ribbon(trim, z, 6, 11, 0.012, 0.004, true));            // door shut lines (flank up to belt)
function topLine(z, w) { const r = fullRing(z), R = r.ring; for (let j = 19; j < 25; j++) { const a = R[j], b = R[j+1]; trim.fquad([a[0], a[1]+0.004, z-w/2], [b[0], b[1]+0.004, z-w/2], [b[0], b[1]+0.004, z+w/2], [a[0], a[1]+0.004, z+w/2], [0, 1, 0]); const a2 = [-a[0], a[1]], b2 = [-b[0], b[1]]; trim.fquad([a2[0], a2[1]+0.004, z-w/2], [b2[0], b2[1]+0.004, z-w/2], [b2[0], b2[1]+0.004, z+w/2], [a2[0], a2[1]+0.004, z+w/2], [0, 1, 0]); } }
console.log('ring samples', M, 'half', N);

/* ---- front fascia (–Z) ---- */
const FZ = -L2-0.004;
[[-1], [1]].forEach(([sx]) => {
  // headlamp: swept-back lens + dark bezel behind (outer end sweeps rearwards)
  const mx = poly => poly.map(p => [p[0]*sx, p[1]]);
  const pl = { p: [sx*0.53, 0.735, -2.145], ry: -sx*0.50 };
  const lens = [[-0.24, -0.045], [0.22, -0.075], [0.26, -0.01], [0.22, 0.062], [-0.23, 0.072], [-0.27, 0.02]];
  head.prism(mx(lens), 0.10, pl);
  trim.prism(mx(lens.map(p => [p[0]*1.07, p[1]*1.15])), 0.09, { p: [pl.p[0], pl.p[1], pl.p[2]+0.012], ry: pl.ry });
  amber.prism([[-0.05, -0.02], [0.05, -0.02], [0.05, 0.02], [-0.05, 0.02]], 0.02, { p: [sx*0.78, 0.69, -2.02], ry: -sx*0.9 });
  // fog lamp
  chrome.prism(ngon(0.055, 12), 0.03, { p: [sx*0.55, 0.36, FZ-0.006] });
  head.prism(ngon(0.042, 12), 0.034, { p: [sx*0.55, 0.36, FZ-0.008] });
  // side vents
  trim.prism([[-0.16, -0.06], [0.16, -0.05], [0.14, 0.06], [-0.14, 0.06]], 0.03, { p: [sx*0.30+sx*0.05, 0.35, FZ-0.002] });
  // rear lamp (outer end sweeps forwards)
  const tl = [[-0.22, -0.095], [0.19, -0.125], [0.235, -0.02], [0.19, 0.085], [-0.21, 0.085]];
  tail.prism(mx(tl), 0.09, { p: [sx*0.58, 0.80, 2.13], ry: sx*0.50 });
  trim.prism(mx(tl.map(p => [p[0]*1.06, p[1]*1.12])), 0.07, { p: [sx*0.58, 0.80, 2.115], ry: sx*0.50 });
  rev.prism([[-0.05, -0.03], [0.05, -0.03], [0.05, 0.03], [-0.05, 0.03]], 0.03, { p: [sx*0.36, 0.58, 2.245] });
  // exhaust
  if (sx > 0) chrome.prism(ngon(0.036, 10), 0.14, { p: [0.50, 0.30, 2.20] });
});
// grille: black mesh + chrome frame + gold bowtie
trim.prism([[-0.44, -0.05], [0.44, -0.05], [0.42, 0.055], [-0.42, 0.055]], 0.03, { p: [0, 0.655, FZ-0.004] });
chrome.prism([[-0.46, -0.014], [0.46, -0.014], [0.46, 0.014], [-0.46, 0.014]], 0.034, { p: [0, 0.715, FZ-0.006] });
chrome.prism([[-0.44, -0.012], [0.44, -0.012], [0.44, 0.012], [-0.44, 0.012]], 0.034, { p: [0, 0.595, FZ-0.006] });
gold.prism([[-0.075, 0.0], [-0.045, 0.028], [0.045, 0.028], [0.075, 0.0], [0.045, -0.028], [-0.045, -0.028]], 0.02, { p: [0, 0.655, FZ-0.02] });
// plates (Uzbek format 520 x 112)
plate.prism(rrect(0.52, 0.112, 0.01, 1), 0.012, { p: [0, 0.46, FZ-0.006] });
plate.prism(rrect(0.52, 0.112, 0.01, 1), 0.012, { p: [0, 0.60, L2+0.006] });
trim.prism([[-0.30, -0.075], [0.30, -0.075], [0.30, 0.075], [-0.30, 0.075]], 0.01, { p: [0, 0.60, L2+0.002] });

/* ---- door handles, mirrors ---- */
[-1, 1].forEach(sx => {
  [0.05, 0.68].forEach(z => chrome.prism(rrect(0.16, 0.03, 0.012, 2), 0.03, { p: [sx*0.882, 0.885, z] , ry: Math.PI/2 }));
  body.ellipsoid([sx*0.99, 1.04, -0.60], 0.07, 0.055, 0.11, 10, 6);
  chrome.prism(rrect(0.085, 0.095, 0.02, 2), 0.01, { p: [sx*0.955, 1.04, -0.53], ry: sx*(Math.PI/2)+ sx*0.25 });
  trim.prism([[-0.03, -0.012], [0.09, -0.012], [0.09, 0.012], [-0.03, 0.012]], 0.03, { p: [sx*0.87, 1.0, -0.62], ry: sx > 0 ? 0 : Math.PI });
});
topLine(-0.97, 0.012); topLine(1.735, 0.012);

/* ---- interior seen through the glass ---- */
[-1, 1].forEach(sx => {
  inter.prism(rrect(0.42, 0.10, 0.03, 2), 0.46, { p: [sx*0.36, 0.60, 0.20], rx: 0 });
  inter.prism(rrect(0.40, 0.56, 0.05, 2), 0.11, { p: [sx*0.36, 0.90, 0.45], rx: -0.18 });
});
inter.prism(rrect(1.3, 0.10, 0.03, 2), 0.42, { p: [0, 0.60, 1.05] });
inter.prism(rrect(1.3, 0.50, 0.05, 2), 0.10, { p: [0, 0.92, 1.28], rx: -0.25 });
inter.prism([[-0.66, -0.07], [0.66, -0.07], [0.62, 0.08], [-0.62, 0.08]], 0.32, { p: [0, 0.93, -0.74], rx: 0.12 });
inter.prism(ngon(0.18, 12), 0.03, { p: [-0.36, 1.05, -0.50], rx: 1.15 });

/* ------------------------------------------------------------ wheel */
const tire = new Part('w_tire', 'rubber'), rim = new Part('w_rim', 'alloy'), disc = new Part('w_disc', 'disc'), hub = new Part('w_hub', 'chrome');
tire.lathe([[0.196, -0.0975], [0.235, -0.1005], [0.275, -0.098], [0.303, -0.088], [0.3155, -0.062], [0.317, -0.03], [0.317, 0.03], [0.3155, 0.062], [0.303, 0.088], [0.275, 0.098], [0.235, 0.1005], [0.196, 0.0975]], 22, 0);
rim.lathe([[0.204, 0.0885], [0.199, 0.096], [0.191, 0.093], [0.178, 0.066], [0.172, 0.03]], 22, 0.05);
disc.lathe([[0.172, 0.03], [0.045, 0.03]], 22, 0);
disc.lathe([[0.13, -0.012], [0.13, 0.012], [0.05, 0.012]], 22, 0);
for (let s = 0; s < 5; s++) {
  const phi = s*2*Math.PI/5, poly = [[-0.030, 0.042], [0.030, 0.042], [0.017, 0.180], [-0.017, 0.180]];
  const pts = (x) => poly.map(([t, r]) => [x, r*Math.cos(phi)-t*Math.sin(phi), r*Math.sin(phi)+t*Math.cos(phi)]);
  const a = pts(0.030), b = pts(0.074), ref = [0.05, 0, 0];
  for (let i = 1; i < 3; i++) { rim.ftri(b[0], b[i], b[i+1], [0.2, 0, 0]); rim.ftri(a[0], a[i], a[i+1], [-0.2, 0, 0]); }
  for (let i = 0; i < 4; i++) { const j = (i+1) % 4; const c = [0.05, (a[i][1]+a[j][1])/2*0.0+0, 0]; const mid = [0.05, (a[i][1]+a[j][1]+b[i][1]+b[j][1])/4, (a[i][2]+a[j][2]+b[i][2]+b[j][2])/4]; const cent = [0.05, (a[0][1]+a[2][1])/2, (a[0][2]+a[2][2])/2]; rim.ftri(a[i], a[j], b[j], cent); rim.ftri(a[i], b[j], b[i], cent); }
}
hub.lathe([[0, 0.088], [0.04, 0.086], [0.052, 0.07], [0.052, 0.03]], 14, 0.05);
for (let s = 0; s < 5; s++) { const phi = s*2*Math.PI/5; hub.ellipsoid([0.087, 0.03*Math.cos(phi), 0.03*Math.sin(phi)], 0.008, 0.008, 0.008, 5, 3); }

/* ------------------------------------------------------------- output */
const bodyParts = [body, glass, trim, chrome, gold, head, tail, rev, amber, plate, inter], wheelParts = [tire, rim, disc, hub];
function enc(part) {
  const P = new Int16Array(part.pos.length); part.pos.forEach((v, i) => { P[i] = Math.round(v*1000); });
  const I = new Uint16Array(part.idx);
  if (part.pos.length/3 > 65535) throw new Error(part.name + ' too many vertices');
  return { n: part.name, m: part.mat, p: Buffer.from(P.buffer).toString('base64'), i: Buffer.from(I.buffer).toString('base64'), tris: I.length/3 };
}
const out = { v: 1, meta: { wheelR: WY, axleZ: WZ, trackX: TRACK, length: 2*L2, width: 2*0.872 }, parts: bodyParts.map(enc), wheel: wheelParts.map(enc) };
let tris = 0; out.parts.forEach(p => { tris += p.tris; console.log(p.n.padEnd(10), p.tris); }); out.wheel.forEach(p => console.log(p.n.padEnd(10), p.tris));
console.log('body tris', tris, 'wheel tris each', out.wheel.reduce((t, p) => t+p.tris, 0));
const dir = path.join(__dirname, '..', 'assets', 'cars'); fs.mkdirSync(dir, { recursive: true });
const js = '/* Baked Chevrolet Cobalt mesh — generated by tools/bake-cobalt.js (own work, no third-party licence). */\nwindow.COBALT_MODEL = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(dir, 'cobalt-model.js'), js);
console.log('wrote assets/cars/cobalt-model.js', (js.length/1024).toFixed(0), 'KB');
