/* ==========================================================================
   parking.js
   Parking is valid only when the car is INSIDE the painted bay and NOT badly
   angled — plus a short settle so rolling through doesn't count. Both
   nose-in and reverse-in are accepted.
   ========================================================================== */

function ParkingChecker(zone) {
  this.zone = zone;
  this.requiredStillSpeed = 0.7;
  this.holdTimeRequired = 0.7;
  this._holdTimer = 0;
  this.completed = false;
  this.bestAccuracy = 0;
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

ParkingChecker.prototype.reset = function () {
  this._holdTimer = 0;
  this.completed = false;
  this.bestAccuracy = 0;
};

ParkingChecker.prototype.update = function (car, dt) {
  var z = this.zone;
  var dx = car.position.x - z.center.x;
  var dz = car.position.z - z.center.z;

  var insideBoundary =
    Math.abs(dx) <= (z.width / 2 - 0.1) &&
    Math.abs(dz) <= (z.depth / 2 - 0.1);

  var distance = Math.sqrt(dx * dx + dz * dz);

  var diffA = Math.abs(normAngle(car.heading - z.targetHeading));
  var diffB = Math.abs(normAngle(car.heading - z.targetHeading - Math.PI));
  var angleError = Math.min(diffA, diffB);
  var angleOk = angleError <= z.headingTolerance;

  var stationary = Math.abs(car.speed) <= this.requiredStillSpeed;
  var allGood = insideBoundary && angleOk && stationary;

  // how neatly it is parked: centering + squareness, 0..1
  var centerScore = 1 - Math.min(1, distance / (z.depth / 2));
  var angleScore = 1 - Math.min(1, angleError / z.headingTolerance);
  var accuracy = Math.max(0, Math.min(1, centerScore * 0.55 + angleScore * 0.45));
  if (allGood) this.bestAccuracy = Math.max(this.bestAccuracy, accuracy);

  var justCompleted = false;
  if (!this.completed) {
    if (allGood) {
      this._holdTimer += dt;
      if (this._holdTimer >= this.holdTimeRequired) {
        this.completed = true;
        justCompleted = true;
      }
    } else {
      this._holdTimer = Math.max(0, this._holdTimer - dt * 2);
    }
  }

  return {
    insideBoundary: insideBoundary,
    distance: distance,
    angleError: angleError,
    angleOk: angleOk,
    stationary: stationary,
    accuracy: accuracy,
    readyProgress: Math.max(0, Math.min(1, this._holdTimer / this.holdTimeRequired)),
    justCompleted: justCompleted
  };
};

/** Short Uzbek prompt describing exactly what the check still wants. */
ParkingChecker.prototype.statusMessage = function (state, distanceToZone) {
  if (this.completed) return 'Parking bajarildi!';
  if (!state.insideBoundary) {
    if (distanceToZone > 40) return 'To\u2018g\u2018riga yuring \u2014 parking oldinda';
    if (distanceToZone > 12) return 'Parkingga yaqinlashyapsiz';
    return 'Sariq chiziq ichiga kiring';
  }
  if (!state.angleOk) return 'Mashinani to\u2018g\u2018rilang';
  if (!state.stationary) return 'To\u2018liq to\u2018xtang';
  return 'Ushlab turing\u2026 ' + Math.round(state.readyProgress * 100) + '%';
};

window.ParkingChecker = ParkingChecker;
