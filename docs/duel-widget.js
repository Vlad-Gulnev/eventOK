(function() {
  'use strict';

  var params = new URLSearchParams(location.search);
  var teamId = params.get('team');
  var token = params.get('token');
  if (!teamId || !token) return;

  var overlay = null;
  var team = null;
  var shownQuestionFor = null;
  var shownResultFor = null;
  var myAnswer = null;
  var submitted = false;
  
  // Берем имя из localStorage (чтобы сохранялось между сессиями)
  var localPlayerName = localStorage.getItem('blitz_player_name') || '';
  var isJoining = false;

  fetch('/api/teams/by-token?token=' + encodeURIComponent(token))
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(t) { team = t; })
    .catch(function() {});

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'blitzWidgetOverlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0',
      'background:rgba(10,22,40,0.97)',
      'backdrop-filter:blur(10px)',
      'z-index:99999', 'display:none',
      'overflow-y:auto', 'color:#fff', 'font-family:inherit'
    ].join(';');
    document.body.appendChild(overlay);

    var s = document.createElement('style');
    s.id = 'dwStyles';
    s.textContent =
      '.dw-opt{display:block;padding:14px 16px;margin:8px 0;border:2px solid rgba(255,255,255,0.15);border-radius:10px;cursor:pointer;background:rgba(255,255,255,0.04);color:#fff;font-size:16px;transition:all 0.15s;}' +
      '.dw-opt:hover{background:rgba(255,255,255,0.1);}' +
      '.dw-opt.checked{background:rgba(21,127,196,0.3);border-color:#157fc4;}' +
      '.dw-opt input{margin-right:10px;transform:scale(1.2);}' +
      '.dw-timer-warning{color:#ff6b6b !important;animation:dwBlink 0.8s infinite;}' +
      '@keyframes dwBlink{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(s);
  }

  function hide() { if (overlay) overlay.style.display = 'none'; }
  function show() { if (overlay) overlay.style.display = 'block'; }

  function resetState() {
    shownQuestionFor = null;
    shownResultFor = null;
    myAnswer = null;
    submitted = false;
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function renderPreparation() {
    overlay.innerHTML =
      '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
        '<div style="font-size:64px;margin-bottom:16px;">⏳</div>' +
        '<h2 style="font-size:26px;margin:0 0 16px;">Подготовка</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:24px;">Введите ваше имя и нажмите «Готов». Ждем остальных участников.</p>' +
        '<input type="text" id="prepPlayerName" placeholder="Ваше имя" value="' + esc(localPlayerName) + '" style="width:100%;padding:16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;font-size:18px;margin-bottom:16px;text-align:center;">' +
        '<button onclick="window.__dwReady()" style="width:100%;padding:18px;font-size:18px;font-weight:700;background:#2e7d32;color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit;">Я готов!</button>' +
      '</div>';
  }

  window.__dwReady = function() {
    var name = document.getElementById('prepPlayerName').value.trim();
    if (!name) { alert('Введите имя!'); return; }
    localPlayerName = name;
    localStorage.setItem('blitz_player_name', name);

    fetch('/api/blitz/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: teamId, playerName: name })
    }).then(function(r) { return r.json(); }).then(function(res) {
      if (res.error) { alert(res.error); return; }
      renderWaitingRoom();
    });
  };

  function renderWaitingRoom() {
    overlay.innerHTML =
      '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
        '<div style="font-size:64px;margin-bottom:16px;">✅</div>' +
        '<h2 style="font-size:26px;margin:0 0 16px;">Вы в игре, ' + esc(localPlayerName) + '!</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:24px;">Ждем, пока ведущий запустит вопрос...</p>' +
        '<button onclick="window.__dwChangeName()" style="background:none;border:none;color:rgba(255,255,255,0.4);text-decoration:underline;cursor:pointer;">Сменить имя</button>' +
      '</div>';
  }

  window.__dwChangeName = function() {
    localPlayerName = '';
    localStorage.removeItem('blitz_player_name');
    renderPreparation();
  };

  function renderQuestion(blitz, q, timeLeftSec) {
    var optionsHtml = q.options.map(function(opt, j) {
      var inputType = q.multiple ? 'checkbox' : 'radio';
      var checked = myAnswer && myAnswer.indexOf(j) !== -1;
      var cls = 'dw-opt' + (checked ? ' checked' : '');
      var disabled = submitted ? ' disabled' : '';
      return '<label class="' + cls + '">' +
        '<input type="' + inputType + '" name="dwAnswer" value="' + j + '" ' + (checked ? 'checked' : '') + disabled + ' onchange="window.__dwPick(' + j + ', this)"> ' + esc(opt) +
      '</label>';
    }).join('');

    var timerWarning = timeLeftSec <= 10 ? ' dw-timer-warning' : '';

    overlay.innerHTML =
      '<div style="max-width:700px;margin:0 auto;padding:24px;">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.5);text-transform:uppercase;">⚡ Блиц</div>' +
          '<div style="font-size:24px;font-weight:800;margin-top:10px;">' + esc(team.name) + ' · ' + esc(localPlayerName) + '</div>' +
        '</div>' +

        '<div class="dw-timer' + timerWarning + '" id="dwTimer" style="text-align:center;font-size:56px;font-weight:900;font-variant-numeric:tabular-nums;margin:16px 0;letter-spacing:3px;">' + pad(Math.floor(timeLeftSec/60)) + ':' + pad(timeLeftSec % 60) + '</div>' +

        '<div style="background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px;margin-bottom:14px;">' +
          '<h2 style="font-size:17px;color:#7cc5f0;margin:0 0 10px;">' + esc(q.title) + '</h2>' +
          '<div style="font-size:18px;font-weight:700;margin:10px 0 16px;">' + esc(q.text) + '</div>' +
          '<div id="dwOptions">' + optionsHtml + '</div>' +
          '<div style="margin-top:12px;">' +
            '<button id="dwSubmitBtn" onclick="window.__dwSubmit()" style="width:100%;padding:16px;font-size:17px;font-weight:700;background:#157fc4;color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit;" ' + (submitted ? 'disabled' : '') + '>' + (submitted ? '✓ Ответ отправлен' : 'Отправить ответ') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  window.__dwPick = function(val, el) {
    if (submitted) return;
    var multiple = el.type === 'checkbox';
    if (multiple) {
      if (!myAnswer) myAnswer = [];
      var i = myAnswer.indexOf(val);
      if (i === -1) myAnswer.push(val); else myAnswer.splice(i, 1);
    } else {
      myAnswer = [val];
    }
    document.querySelectorAll('.dw-opt').forEach(function(l) { l.classList.remove('checked'); });
    document.querySelectorAll('.dw-opt input:checked').forEach(function(inp) {
      inp.closest('.dw-opt').classList.add('checked');
    });
  };

  window.__dwSubmit = function() {
    if (submitted) return;
    if (!myAnswer || myAnswer.length === 0) { alert('Выберите ответ'); return; }

    submitted = true;
    var btn = document.getElementById('dwSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Отправка…';

    fetch('/api/blitz/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: teamId, playerName: localPlayerName, answer: myAnswer })
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.error) {
          overlay.innerHTML =
            '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
              '<div style="font-size:64px;margin-bottom:16px;">❌</div>' +
              '<h2 style="font-size:26px;margin:0 0 16px;">' + esc(res.error) + '</h2>' +
              '<p style="color:rgba(255,255,255,0.7);">Вы больше не можете отвечать в этом раунде.</p>' +
            '</div>';
        } else {
          overlay.innerHTML =
            '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
              '<div style="font-size:64px;margin-bottom:16px;">🏆</div>' +
              '<h2 style="font-size:26px;margin:0 0 16px;">Верно!</h2>' +
              '<p style="color:rgba(255,255,255,0.7);">Ваш ответ принят. Ждем остальных.</p>' +
            '</div>';
        }
      })
      .catch(function() {
        submitted = false;
        btn.disabled = false;
        btn.textContent = 'Отправить ответ';
      });
  };

  function renderFinished() {
    overlay.innerHTML =
      '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
        '<div style="font-size:80px;margin-bottom:16px;">⏱</div>' +
        '<h2 style="font-size:28px;margin:0 0 16px;">Раунд завершен!</h2>' +
        '<p style="color:rgba(255,255,255,0.7);">Ждем, пока ведущий скроет окно или запустит следующий вопрос.</p>' +
      '</div>';
  }

  function poll() {
    if (!team) return;
    fetch('/api/blitz/active')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Если ведущий нажал "Скрыть окна" (active = null)
        if (!data.blitz) { 
          hide(); 
          resetState(); 
          return; 
        }
        
        var blitz = data.blitz;

        show();

        if (blitz.status === 'preparation') {
          if (shownQuestionFor === 'prep') return;
          shownQuestionFor = 'prep';
          
          // АВТОМАТИЧЕСКАЯ РЕГИСТРАЦИЯ, если имя уже сохранено
          if (localPlayerName) {
            if (isJoining) return;
            isJoining = true;
            fetch('/api/blitz/join', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ teamId: teamId, playerName: localPlayerName })
            }).then(function(r) { return r.json(); }).then(function(res) {
              isJoining = false;
              renderWaitingRoom();
            }).catch(function() { isJoining = false; renderPreparation(); });
          } else {
            renderPreparation();
          }
          return;
        }

        if (blitz.status === 'finished') {
          if (shownResultFor === 'finished') return;
          shownResultFor = 'finished';
          shownQuestionFor = null;
          renderFinished();
          return;
        }

        if (blitz.status === 'running') {
          if (shownQuestionFor !== blitz.questionId) {
            shownQuestionFor = blitz.questionId;
            myAnswer = null;
            submitted = false;
          }

          var q = data.question;
          if (!q) { hide(); return; }

          var existingTimer = document.getElementById('dwTimer');
          var hasOptions = overlay.querySelector('input[name="dwAnswer"]');
          
          if (overlay.innerHTML.indexOf('Вы больше не можете') !== -1 || overlay.innerHTML.indexOf('Ваш ответ принят') !== -1) {
            return;
          }

          if (existingTimer && hasOptions) {
            existingTimer.textContent = pad(Math.floor(data.timeLeftSec/60)) + ':' + pad(data.timeLeftSec % 60);
            existingTimer.classList.toggle('dw-timer-warning', data.timeLeftSec <= 10);
          } else {
            renderQuestion(blitz, q, data.timeLeftSec);
          }
        }
      })
      .catch(function() {});
  }

  function init() {
    createOverlay();
    var waitTeam = setInterval(function() {
      if (team) { clearInterval(waitTeam); poll(); setInterval(poll, 1000); }
    }, 500);
    setTimeout(function() { clearInterval(waitTeam); }, 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();