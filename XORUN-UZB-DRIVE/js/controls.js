/* ==========================================================================
   controls.js
   Keyboard + touch input, normalized to { throttle, steer, brake }.
   steer +1 = left (A / ArrowLeft), steer -1 = right (D / ArrowRight).
   ========================================================================== */

function InputManager() {
  var self = this;

  this.keys = Object.create(null);
  this.touch = { forward: false, reverse: false, left: false, right: false, brake: false };
  this._resetRequested = false;
  this.enabled = false;
  this.lastKey = '';

  window.addEventListener('keydown', function (e) {
    self.keys[e.code] = true;
    self.lastKey = e.code;
    if (!self.enabled) return;
    if (e.code === 'KeyR') self._resetRequested = true;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
  window.addEventListener('blur', function () { self.releaseAll(); });

  this._bindTouch();
}

InputManager.prototype._bindTouch = function () {
  var self = this;
  function bind(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    var press = function (ev) { ev.preventDefault(); self.touch[key] = true; };
    var release = function (ev) { ev.preventDefault(); self.touch[key] = false; };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  }
  bind('touch-forward', 'forward');
  bind('touch-reverse', 'reverse');
  bind('touch-left', 'left');
  bind('touch-right', 'right');
  bind('touch-brake', 'brake');
};

InputManager.prototype.releaseAll = function () {
  this.keys = Object.create(null);
  this.touch = { forward: false, reverse: false, left: false, right: false, brake: false };
};

InputManager.prototype.consumeReset = function () {
  var r = this._resetRequested;
  this._resetRequested = false;
  return r;
};

InputManager.prototype.requestReset = function () { this._resetRequested = true; };

InputManager.prototype.getDrivingInput = function () {
  var k = this.keys, t = this.touch;
  var throttle = 0, steer = 0;

  if (k['KeyW'] || k['ArrowUp'] || t.forward) throttle += 1;
  if (k['KeyS'] || k['ArrowDown'] || t.reverse) throttle -= 1;
  if (k['KeyA'] || k['ArrowLeft'] || t.left) steer += 1;
  if (k['KeyD'] || k['ArrowRight'] || t.right) steer -= 1;

  var brake = !!(k['Space'] || t.brake);

  if (throttle > 1) throttle = 1;
  if (throttle < -1) throttle = -1;
  if (steer > 1) steer = 1;
  if (steer < -1) steer = -1;

  return { throttle: throttle, steer: steer, brake: brake };
};

window.InputManager = InputManager;
