// Виджет таймера — подключается одной строкой <script src="timer-widget.js"></script>
(function() {
  'use strict';

  var widgetEl = null;
  var expiredPlayed = false;
  var lastActive = false;

  function createWidget() {
    widgetEl = document.createElement('div');
    widgetEl.id = 'globalTimerWidget';
    widgetEl.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'z-index:9999',
      'display:none',
      'align-items:center',
      'gap:8px',
      'padding:8px 14px',
      'border-radius:12px',
      'font-family:inherit',
      'font-size:16px',
      'font-weight:700',
      'color:#fff',
      'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
      'transition:background 0.3s, transform 0.2s',
      'pointer-events:none',
      'letter-spacing:0.5px'
    ].join(';');
    document.body.appendChild(widgetEl);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Звук гудка камаза
  var audioCtx = null;
  function playTruckHorn() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var now = audioCtx.currentTime;
      var dur = 2.0;

      var o1 = audioCtx.createOscillator(); var g1 = audioCtx.createGain();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(95, now);
      o1.frequency.linearRampToValueAtTime(105, now + 0.1);
      o1.frequency.linearRampToValueAtTime(98, now + dur);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.linearRampToValueAtTime(0.4, now + 0.05);
      g1.gain.setValueAtTime(0.4, now + dur - 0.2);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o1.connect(g1); g1.connect(audioCtx.destination);
      o1.start(now); o1.stop(now + dur);

      var o2 = audioCtx.createOscillator(); var g2 = audioCtx.createGain();
      o2.type = 'sawtooth';
      o2.frequency.setValueAtTime(142, now);
      o2.frequency.linearRampToValueAtTime(158, now + 0.1);
      o2.frequency.linearRampToValueAtTime(147, now + dur);
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.3, now + 0.05);
      g2.gain.setValueAtTime(0.3, now + dur - 0.2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.start(now); o2.stop(now + dur);

      if (navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 600]);
    } catch (e) {}
  }

  function update() {
    fetch('/api/timer/state')
      .then(function(r) { return r.json(); })
      .then(function(t) {
        if (!widgetEl) return;

        // Не активен
        if (!t.active && !t.expired) {
          widgetEl.style.display = 'none';
          expiredPlayed = false;
          lastActive = false;
          return;
        }

        // Активен
        widgetEl.style.display = 'inline-flex';

        if (t.expired) {
          widgetEl.style.background = 'linear-gradient(90deg, #c8102e, #b58b2a)';
          widgetEl.innerHTML = '🚛 ВРЕМЯ ВЫШЛО';
          widgetEl.style.transform = 'scale(1.05)';

          if (!expiredPlayed) {
            expiredPlayed = true;
            playTruckHorn();
          }
          return;
        }

        var mm = pad(t.minutesLeft);
        var ss = pad(t.secondsLeft);
        widgetEl.innerHTML = '⏱ ' + mm + ':' + ss;
        widgetEl.style.transform = 'scale(1)';

        // Цвет по остатку
        if (t.minutesLeft < 2) {
          widgetEl.style.background = 'linear-gradient(90deg, #b58b2a, #d4a017)';
        } else {
          widgetEl.style.background = 'linear-gradient(90deg, #157fc4, #0f5d92)';
        }
      })
      .catch(function() {
        // Нет сервера — просто скрыть
        if (widgetEl) widgetEl.style.display = 'none';
      });
  }

  // Инициализация после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createWidget();
      update();
      setInterval(update, 1000);
    });
  } else {
    createWidget();
    update();
    setInterval(update, 1000);
  }
})();