/* ==========================================================================
   ui.js
   The DOM layer. Loaded before the game modules and wires every button the
   moment it runs, so the menu can never be dead — even if the 3D engine is
   still loading. It talks to the engine only through window.Game.

   Coins and unlocked vehicles persist in localStorage when available.
   ========================================================================== */

var UI = (function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };

  var screens = {
    menu: el('screen-menu'),
    garage: el('screen-garage'),
    map: el('screen-map'),
    settings: el('screen-settings')
  };

  var hud = el('hud');
  var touchControls = el('touch-controls');
  var resultModal = el('result-modal');
  var errorBanner = el('error-banner');
  var debugPanel = el('debug-panel');

  var STORAGE_KEY = 'xorun-uzb-drive-save';
  var save = { coins: 0, xp: 0, best: null, unlocked: ['cobalt'], selected: 'cobalt' };

  var engineReady = false;
  var playQueued = false;
  var currentScreen = 'menu';

  // ------------------------------------------------------------- storage
  function loadSave() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          save.coins = parsed.coins || 0;
          save.xp = parsed.xp || 0;
          save.best = parsed.best || null;
          save.unlocked = Array.isArray(parsed.unlocked) && parsed.unlocked.length ? parsed.unlocked : ['cobalt'];
          save.selected = parsed.selected || 'cobalt';
        }
      }
    } catch (e) { /* private mode or file:// — play without saving */ }
    if (save.unlocked.indexOf('cobalt') === -1) save.unlocked.push('cobalt');
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  function isUnlocked(key) {
    var defs = window.VEHICLE_DEFS;
    if (defs && defs[key] && defs[key].unlocked) return true;
    return save.unlocked.indexOf(key) !== -1;
  }

  loadSave();

  // ------------------------------------------------------------- screens
  function showScreen(name) {
    currentScreen = name;
    Object.keys(screens).forEach(function (k) { screens[k].classList.add('hidden'); });
    hud.classList.add('hidden');
    touchControls.classList.add('hidden');
    if (screens[name]) screens[name].classList.remove('hidden');

    if (window.Game && window.Game.setView) {
      window.Game.setView(name === 'garage' ? 'garage' : 'menu');
    }
  }

  function showGameUI() {
    currentScreen = 'game';
    Object.keys(screens).forEach(function (k) { screens[k].classList.add('hidden'); });
    hud.classList.remove('hidden');
    var s = getSettings();
    var isTouch = s.forceTouch || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) touchControls.classList.remove('hidden');
    else touchControls.classList.add('hidden');
  }

  // ------------------------------------------------------------- engine state
  function setEngineStatus(text) {
    var node = el('engine-status');
    if (node) node.textContent = text;
  }

  function setEngineReady(info) {
    engineReady = true;
    var btn = el('btn-play');
    btn.classList.remove('menu-btn-loading');
    btn.textContent = 'PLAY';
    setEngineStatus(info || 'Tayyor \u2014 PLAY bosing');
    renderGarage();
    if (playQueued) { playQueued = false; startGame(); }
  }

  function showError(message) {
    el('error-message').textContent = message;
    errorBanner.classList.remove('hidden');
    setEngineStatus('3D dvigatel yuklanmadi');
    var btn = el('btn-play');
    btn.classList.add('menu-btn-loading');
  }

  // ------------------------------------------------------------- actions
  function startGame() {
    if (!engineReady || !window.Game) {
      playQueued = true;
      setEngineStatus('Dvigatel yuklanmoqda\u2026 PLAY navbatga qo\u2018yildi');
      return;
    }
    try {
      showGameUI();
      window.Game.start(save.selected, getSettings());
    } catch (err) {
      console.error('[XORUN] start failed:', err);
      showError('O\u2018yinni boshlashda xatolik: ' + err.message);
      showScreen('menu');
    }
  }

  // ------------------------------------------------------------- garage
  function renderGarage() {
    var list = el('garage-list');
    var defs = window.VEHICLE_DEFS;
    list.innerHTML = '';

    if (!defs) {
      var note = document.createElement('div');
      note.className = 'map-card';
      note.textContent = '3D dvigatel yuklangach garaj ochiladi.';
      list.appendChild(note);
      return;
    }

    var header = document.createElement('div');
    header.className = 'garage-wallet';
    header.innerHTML = '<span>\ud83c\udfc5 LEVEL ' + levelOf(save.xp) + '</span>' +
      '<span>🪙 ' + save.coins + '</span><span>⭐ ' + save.xp + ' XP</span>';
    list.appendChild(header);

    Object.keys(defs).forEach(function (key) {
      var def = defs[key];
      var unlocked = isUnlocked(key);
      var selected = save.selected === key;

      var card = document.createElement('div');
      card.className = 'garage-card' + (unlocked ? '' : ' garage-card-locked') + (selected ? ' garage-card-selected' : '');

      // a plain colour strip — the actual vehicle is shown as a rotating 3D
      // model behind this panel, never as a CSS drawing
      var swatch = document.createElement('div');
      swatch.className = 'garage-swatch';
      swatch.style.background = '#' + def.color.toString(16).padStart(6, '0');
      card.appendChild(swatch);

      var info = document.createElement('div');
      info.className = 'garage-info';

      var name = document.createElement('div');
      name.className = 'garage-name';
      name.textContent = def.name;
      info.appendChild(name);

      var specs = document.createElement('div');
      specs.className = 'garage-specs';
      specs.textContent = Math.round(def.maxSpeed * 3.6) + ' km/s \u00b7 ' +
        (def.body === 'van' ? 'yukchi' : def.body === 'hatch' ? 'xetchbek' : 'sedan') +
        ' \u00b7 ' + def.length.toFixed(2) + ' m';
      info.appendChild(specs);

      var status = document.createElement('div');
      status.className = 'garage-status' + (unlocked ? '' : ' locked');
      status.textContent = unlocked ? (selected ? 'TANLANGAN' : 'OCHIQ') : '🔒 QULFLANGAN \u00b7 ' + def.price + ' 🪙';
      info.appendChild(status);

      card.appendChild(info);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'garage-btn';

      if (unlocked) {
        btn.textContent = selected ? 'Tanlangan' : 'Tanlash';
        btn.disabled = selected;
        btn.addEventListener('click', function () {
          save.selected = key;
          persist();
          renderGarage();
          if (window.Game && window.Game.previewVehicle) window.Game.previewVehicle(key);
        });
      } else if (save.coins >= def.price) {
        btn.textContent = 'Ochish';
        btn.classList.add('garage-btn-unlock');
        btn.addEventListener('click', function () {
          save.coins -= def.price;
          save.unlocked.push(key);
          save.selected = key;
          persist();
          renderGarage();
          if (window.Game && window.Game.previewVehicle) window.Game.previewVehicle(key);
        });
      } else {
        btn.textContent = 'Tanga yetarli emas';
        btn.disabled = true;
      }

      card.appendChild(btn);

      // clicking the card previews the car in 3D behind the panel
      card.addEventListener('click', function (e) {
        if (e.target === btn) return;
        if (window.Game && window.Game.previewVehicle) window.Game.previewVehicle(key);
      });

      list.appendChild(card);
    });
  }

  // ------------------------------------------------------------- HUD
  function formatTime(seconds) {
    var m = String(Math.floor(seconds / 60)).padStart(2, '0');
    var s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return m + ':' + s;
  }

  // ------------------------------------------------------------- level / XP
  var XP_PER_LEVEL = 200;

  function levelOf(xp) { return 1 + Math.floor((xp || 0) / XP_PER_LEVEL); }
  function xpIntoLevel(xp) { return (xp || 0) % XP_PER_LEVEL; }

  function refreshProgress() {
    var lvl = levelOf(save.xp);
    var into = xpIntoLevel(save.xp);
    var node;
    if ((node = el('hud-level'))) node.textContent = lvl;
    if ((node = el('hud-xp'))) node.textContent = into + '/' + XP_PER_LEVEL;
    if ((node = el('hud-xp-fill'))) node.style.width = Math.round(into / XP_PER_LEVEL * 100) + '%';
    if ((node = el('hud-coins'))) node.textContent = save.coins;
  }

  /** Mukofot berish: tanga + XP, LEVEL avtomatik oshadi. */
  function addReward(coins, xp, label) {
    var before = levelOf(save.xp);
    save.coins += coins || 0;
    save.xp += xp || 0;
    persist();
    refreshProgress();
    renderGarage();

    var msg = (label ? label + ' \u00b7 ' : '') +
      (coins ? '+' + coins + ' \ud83e\ude99' : '') +
      (xp ? '  +' + xp + ' XP' : '');
    toast(msg);

    var after = levelOf(save.xp);
    if (after > before) setTimeout(function () { toast('LEVEL UP \u2014 LEVEL ' + after, 'level'); }, 700);
  }

  // ------------------------------------------------------------- toast
  var toastWrap = null;
  function toast(text, kind) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.id = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (kind === 'level' ? ' toast-level' : '');
    t.textContent = text;
    toastWrap.appendChild(t);
    setTimeout(function () { t.classList.add('toast-out'); }, 1800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }

  function updateHUD(d) {
    el('hud-speed').textContent = Math.round(d.speedKmh);
    el('hud-gear').textContent = d.gear;
    el('hud-time').textContent = formatTime(d.time);
    el('hud-damage-fill').style.width = Math.min(100, d.damage) + '%';
    refreshProgress();
  }

  /** MISSION paneli. */
  function setMission(title, text, progress, distance, timeLeft) {
    el('hud-objective-title').textContent = title;
    el('hud-objective-text').textContent = text;
    el('hud-objective-fill').style.width = Math.round((progress || 0) * 100) + '%';
    var timer = el('hud-mission-timer');
    if (timer) {
      if (typeof timeLeft === 'number') {
        timer.classList.remove('hidden');
        timer.textContent = '\u23f1 ' + Math.ceil(timeLeft) + 's';
      } else {
        timer.classList.add('hidden');
      }
    }
    if (typeof distance === 'number') el('hud-distance').textContent = Math.round(distance) + ' m';
  }

  function setObjective(text, progress, distance) {
    el('hud-objective-text').textContent = text;
    el('hud-objective-fill').style.width = Math.round((progress || 0) * 100) + '%';
    if (typeof distance === 'number') {
      el('hud-distance').textContent = Math.round(distance) + ' m';
    }
  }

  function setArrow(angleDeg, visible) {
    var arrow = el('hud-arrow');
    if (!visible) { arrow.style.opacity = '0'; return; }
    arrow.style.opacity = '1';
    arrow.style.transform = 'rotate(' + angleDeg + 'deg)';
  }

  function showResult(r) {
    save.coins += r.coins;
    save.xp += r.xp;
    if (save.best === null || r.time < save.best) save.best = r.time;
    persist();

    el('result-coins').textContent = r.coins;
    el('result-xp').textContent = r.xp;
    el('result-time').textContent = formatTime(r.time);
    el('result-score').textContent = r.score;
    el('result-damage').textContent = Math.round(r.damage) + '%';
    el('result-accuracy').textContent = Math.round(r.accuracy * 100) + '%';
    resultModal.classList.remove('hidden');
  }

  function hideResult() { resultModal.classList.add('hidden'); }

  var flashEl = null;
  function flashCollision(strength) {
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.id = 'collision-flash';
      document.body.appendChild(flashEl);
    }
    flashEl.style.transition = 'none';
    flashEl.style.opacity = String(Math.min(1, 0.35 + (strength || 0.5)));
    requestAnimationFrame(function () {
      flashEl.style.transition = 'opacity 0.4s ease';
      flashEl.style.opacity = '0';
    });
  }

  function setDebug(lines) {
    if (!getSettings().debug) {
      debugPanel.classList.add('hidden');
      return;
    }
    debugPanel.classList.remove('hidden');
    debugPanel.textContent = lines.join('\n');
  }

  // ------------------------------------------------------------- settings
  function getSettings() {
    return {
      steerSensitivity: parseFloat(el('setting-steer').value),
      cameraSmoothing: parseFloat(el('setting-camera').value),
      forceTouch: el('setting-force-touch').checked,
      headlights: el('setting-headlights').checked,
      shadows: el('setting-shadows').checked,
      debug: el('setting-debug').checked
    };
  }

  // ------------------------------------------------------------- wiring
  el('btn-play').addEventListener('click', startGame);
  el('btn-garage').addEventListener('click', function () { renderGarage(); showScreen('garage'); });
  el('btn-map').addEventListener('click', function () { showScreen('map'); });
  el('btn-settings').addEventListener('click', function () { showScreen('settings'); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
    btn.addEventListener('click', function () { showScreen(btn.getAttribute('data-back')); });
  });

  el('btn-reset').addEventListener('click', function () { if (window.Game) window.Game.reset(); });
  el('btn-exit').addEventListener('click', function () {
    hideResult();
    if (window.Game) window.Game.stop();
    showScreen('menu');
  });

  el('btn-result-retry').addEventListener('click', function () { hideResult(); startGame(); });
  el('btn-result-menu').addEventListener('click', function () {
    hideResult();
    if (window.Game) window.Game.stop();
    showScreen('menu');
  });

  ['setting-steer', 'setting-camera', 'setting-headlights', 'setting-shadows', 'setting-debug', 'setting-force-touch']
    .forEach(function (id) {
      el(id).addEventListener('change', function () {
        if (window.Game && window.Game.applySettings) window.Game.applySettings(getSettings());
        if (currentScreen === 'game') showGameUI();
      });
    });

  // keyboard shortcut: Enter or P starts driving from the menu
  window.addEventListener('keydown', function (e) {
    if (currentScreen === 'menu' && (e.code === 'Enter' || e.code === 'KeyP')) startGame();
    if (currentScreen === 'game' && e.code === 'Escape') {
      if (window.Game) window.Game.stop();
      showScreen('menu');
    }
  });

  showScreen('menu');

  return {
    showScreen: showScreen,
    showGameUI: showGameUI,
    renderGarage: renderGarage,
    updateHUD: updateHUD,
    setObjective: setObjective,
    setMission: setMission,
    addReward: addReward,
    toast: toast,
    setArrow: setArrow,
    showResult: showResult,
    hideResult: hideResult,
    setEngineReady: setEngineReady,
    setEngineStatus: setEngineStatus,
    showError: showError,
    flashCollision: flashCollision,
    setDebug: setDebug,
    getSettings: getSettings,
    isUnlocked: isUnlocked,
    get save() { return save; },
    get selectedVehicle() { return save.selected; },
    get currentScreen() { return currentScreen; }
  };
})();

window.UI = UI;
