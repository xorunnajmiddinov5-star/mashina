/* ==========================================================================
   three-fallback.js
   Runs immediately after the main Three.js script tag. If the primary CDN
   was unreachable, THREE is undefined here — we then try the mirrors in
   order and tell main.js when the library finally arrives.

   window.ThreeLoader.ready(cb) -> cb() once THREE exists (or never, if all
   sources fail, in which case onFail runs).
   ========================================================================== */

window.ThreeLoader = (function () {
  'use strict';

  var MIRRORS = [
    'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
    'https://unpkg.com/three@0.128.0/build/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'vendor/three.min.js'
  ];

  var readyCallbacks = [];
  var failCallbacks = [];
  var settled = false;

  function succeed() {
    if (settled) return;
    settled = true;
    readyCallbacks.forEach(function (cb) { cb(); });
    readyCallbacks = [];
  }

  function failAll(err) {
    if (settled) return;
    settled = true;
    failCallbacks.forEach(function (cb) { cb(err); });
    failCallbacks = [];
  }

  function tryMirror(i) {
    if (typeof window.THREE !== 'undefined') { succeed(); return; }
    if (i >= MIRRORS.length) {
      failAll(new Error('Three.js hech qaysi manbadan yuklanmadi'));
      return;
    }
    var s = document.createElement('script');
    s.src = MIRRORS[i];
    s.async = false;
    s.onload = function () {
      if (typeof window.THREE !== 'undefined') succeed();
      else tryMirror(i + 1);
    };
    s.onerror = function () { tryMirror(i + 1); };
    document.head.appendChild(s);
  }

  // The primary tag in index.html has already run by now.
  if (typeof window.THREE !== 'undefined') {
    settled = true;
  } else {
    // start mirrors on the next tick so the rest of the page keeps parsing
    setTimeout(function () { tryMirror(0); }, 0);
  }

  return {
    get loaded() { return typeof window.THREE !== 'undefined'; },
    ready: function (cb) {
      if (typeof window.THREE !== 'undefined') cb();
      else readyCallbacks.push(cb);
    },
    onFail: function (cb) {
      if (settled && typeof window.THREE === 'undefined') cb(new Error('Three.js yuklanmadi'));
      else failCallbacks.push(cb);
    }
  };
})();
