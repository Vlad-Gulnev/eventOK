(function() {
  'use strict';

  var params = new URLSearchParams(location.search);
  var teamId = params.get('team');
  var token = params.get('token');
  if (!teamId || !token) return;

  var overlay = null;
  var team = null;
  var localPlayerName = localStorage.getItem('blitz_player_name') || '';
  var shownState = null;

  fetch('/api/teams/by-token?token=' + encodeURIComponent(token))
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(t) { team = t; })
    .catch(function() {});

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'videoWidgetOverlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0',
      'background:rgba(10,22,40,0.97)',
      'backdrop-filter:blur(10px)',
      'z-index:99999', 'display:none',
      'overflow-y:auto', 'color:#fff', 'font-family:inherit'
    ].join(';');
    document.body.appendChild(overlay);
  }

  function hide() { if (overlay) overlay.style.display = 'none'; }
  function show() { if (overlay) overlay.style.display = 'block'; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function renderVideoStage() {
    overlay.innerHTML = 
      '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
        '<div style="font-size:64px;margin-bottom:16px;">📺</div>' +
        '<h2 style="font-size:26px;margin:0 0 16px;">Внимание на экран!</h2>' +
        '<p style="color:rgba(255,255,255,0.7);">Ведущий запустил видео. Внимательно смотрите.</p>' +
      '</div>';
    show();
  }

  function renderQuestionStage(endTime) {
    var timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    var timeStr = pad(Math.floor(timeLeft / 60)) + ':' + pad(timeLeft % 60);
    
    overlay.innerHTML =
      '<div style="max-width:600px;margin:0 auto;padding:24px;">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.5);text-transform:uppercase;">🎬 Финальный вопрос</div>' +
          '<div style="font-size:24px;font-weight:800;margin-top:10px;">' + esc(team.name) + '</div>' +
        '</div>' +
        '<div id="vTimer" style="text-align:center;font-size:56px;font-weight:900;font-variant-numeric:tabular-nums;margin:16px 0;letter-spacing:3px;color:#ff6b6b;">' + timeStr + '</div>' +
        '<div style="background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px;margin-bottom:14px;">' +
          '<p style="font-size:17px;margin:0 0 16px;color:#7cc5f0;font-weight:700;">Опишите маркеры, которые указывали на подготовку нападения в видео.</p>' +
          '<input type="text" id="vName" placeholder="Ваше имя" value="' + esc(localPlayerName) + '" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;font-size:16px;margin-bottom:12px;">' +
          '<textarea id="vText" placeholder="Ваш ответ..." style="width:100%;height:100px;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;font-size:16px;margin-bottom:12px;resize:none;"></textarea>' +
          '<button id="vSubmit" onclick="window.__vSubmit()" style="width:100%;padding:16px;font-size:17px;font-weight:700;background:#157fc4;color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit;">Отправить ответ</button>' +
        '</div>' +
      '</div>';
    show();
  }

  window.__vSubmit = function() {
    var name = document.getElementById('vName').value.trim();
    var text = document.getElementById('vText').value.trim();
    if (!name) { alert('Введите имя!'); return; }
    if (!text) { alert('Введите ответ!'); return; }

    localPlayerName = name;
    localStorage.setItem('blitz_player_name', name);

    var btn = document.getElementById('vSubmit');
    btn.disabled = true;
    btn.textContent = 'Отправка...';

    fetch('/api/video/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: teamId, playerName: name, text: text })
    }).then(function(r) { return r.json(); }).then(function(res) {
      if (res.error) { alert(res.error); btn.disabled = false; btn.textContent = 'Отправить ответ'; }
      else {
        overlay.innerHTML = 
          '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
            '<div style="font-size:64px;margin-bottom:16px;">✅</div>' +
            '<h2 style="font-size:26px;margin:0 0 16px;">Ответ принят!</h2>' +
            '<p style="color:rgba(255,255,255,0.7);">Ждем остальных.</p>' +
          '</div>';
      }
    });
  };

  function poll() {
    if (!team) return;
    fetch('/api/video/active')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.active) { hide(); return; }

        if (data.phase === 'video1' || data.phase === 'video2') {
          if (shownState !== data.phase) {
            shownState = data.phase;
            renderVideoStage();
          }
        } else if (data.phase === 'questions') {
          if (shownState !== 'questions') {
            shownState = 'questions';
            renderQuestionStage(data.endTime);
          }
          // Обновляем таймер
          var tLeft = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
          var el = document.getElementById('vTimer');
          if (el) el.textContent = pad(Math.floor(tLeft / 60)) + ':' + pad(tLeft % 60);
        } else if (data.phase === 'finished') {
          if (shownState !== 'finished') {
            shownState = 'finished';
            overlay.innerHTML = 
              '<div style="max-width:500px;margin:0 auto;padding:40px 24px;text-align:center;">' +
                '<div style="font-size:64px;margin-bottom:16px;">⏱</div>' +
                '<h2 style="font-size:26px;margin:0 0 16px;">Время вышло!</h2>' +
                '<p style="color:rgba(255,255,255,0.7);">Жюри оценивает ответы.</p>' +
              '</div>';
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