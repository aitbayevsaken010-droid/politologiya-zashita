(function () {
  'use strict';

  var IS_REMOTE = /[?&]remote/.test(location.search);
  var CH_NAME = 'polit-deck';
  var bc = ('BroadcastChannel' in window) ? new BroadcastChannel(CH_NAME) : null;

  /* --------------------------------------------------------------
     Подстановка имён спикеров: "спикер 3" -> имя из SPEAKERS
     -------------------------------------------------------------- */
  function names(s) {
    return s.replace(/[Сс]пикер\s*([1-5])/g, function (m, d) {
      var sp = SPEAKERS[parseInt(d, 10) - 1];
      return (sp && sp.name && !/^Спикер\s*\d$/.test(sp.name)) ? sp.name : m;
    });
  }

  /* --------------------------------------------------------------
     Достраиваем слайды-разделители глав
     -------------------------------------------------------------- */
  SLIDES.forEach(function (s) {
    if (s.kind !== 'chap') return;
    var c = CHAPTERS[s.ch];
    var sp = SPEAKERS[c.sp - 1];
    s.html =
      '<div class="wrap">' +
        '<div class="kicker" data-r>Блок ' + c.n + ' <span class="sp">/ ' + c.time + '</span></div>' +
        '<div class="big" data-r style="--i:1">' + c.title + '</div>' +
        '<p class="lede mt" data-r style="--i:3">' + c.sub + '</p>' +
        '<div class="meta" data-r style="--i:4">' +
          '<span class="pill a">' + sp.name + '</span>' +
          '<span class="pill">' + sp.topic + '</span>' +
          '<span class="pill">' + c.time + '</span>' +
        '</div>' +
      '</div>';
    s.notes = 'Разделитель блока. Слово переходит к спикеру: ' + sp.name + '. Тема: ' + sp.topic + '.';
  });

  /* --------------------------------------------------------------
     Рендер колоды
     -------------------------------------------------------------- */
  var deck = document.getElementById('deck');
  var cur = 0;
  var busy = false;

  if (!IS_REMOTE) {
    SLIDES.forEach(function (s, i) {
      var el = document.createElement('section');
      el.className = 'slide' + (s.kind ? ' ' + s.kind : '');
      el.setAttribute('data-i', i);
      el.innerHTML = names(s.html);
      deck.appendChild(el);
      s.el = el;
      var hemi = el.querySelector('[data-hemi]');
      if (hemi) buildHemi(hemi, el.querySelector('#legend'));
    });
    buildChrome();
    buildMenu();
    buildHelp();
    buildNotes();
    var start = parseInt((location.hash || '').replace('#', ''), 10);
    go(isNaN(start) ? 0 : clamp(start), 1, true);
  } else {
    buildRemote();
  }

  function clamp(i) { return Math.max(0, Math.min(SLIDES.length - 1, i)); }

  /* --------------------------------------------------------------
     Переход между слайдами
     -------------------------------------------------------------- */
  function go(i, dir, instant) {
    i = clamp(i);
    if (busy && !instant) return;
    var prev = SLIDES[cur].el;
    var next = SLIDES[i].el;
    if (prev === next && !instant) return;

    if (prev && prev !== next) {
      busy = true;
      prev.style.setProperty('--dy', (dir > 0 ? 44 : -44) + 'px');
      prev.classList.remove('slide-in');
      prev.classList.add('slide-out');
      setTimeout(function () {
        prev.classList.remove('on', 'slide-out');
        prev.scrollTop = 0;
        busy = false;
      }, 320);
    }
    next.style.setProperty('--dy', (dir > 0 ? 44 : -44) + 'px');
    next.classList.remove('slide-out');
    next.classList.add('on', 'slide-in');
    next.scrollTop = 0;
    countUp(next);

    cur = i;
    history.replaceState(null, '', '#' + i);
    paint();
    broadcast();
  }

  function next() { go(cur + 1, 1); }
  function prev() { go(cur - 1, -1); }

  /* --------------------------------------------------------------
     Полукруг парламента: 145 мест, заполняется по партиям слева направо
     -------------------------------------------------------------- */
  function buildHemi(svg, legend) {
    var rows = [110, 150, 190, 230, 270], counts = [17, 23, 29, 35, 41];
    var cx = 300, cy = 305, seats = [];
    rows.forEach(function (r, ri) {
      for (var k = 0; k < counts[ri]; k++) {
        var a = Math.PI - Math.PI * (k + 0.5) / counts[ri];
        seats.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a), a: a });
      }
    });
    seats.sort(function (p, q) { return q.a - p.a; });
    var idx = 0, html = '', lg = '';
    SEATS.forEach(function (p) {
      for (var j = 0; j < p.n && idx < seats.length; j++, idx++) {
        var st = seats[idx];
        html += '<circle cx="' + st.x.toFixed(1) + '" cy="' + st.y.toFixed(1) + '" r="9" fill="' + p.c +
          '" style="transition-delay:' + (idx * 7 + 250) + 'ms"/>';
      }
      lg += '<span><i style="background:' + p.c + '"></i>' + p.name + ' · ' + p.n + '</span>';
    });
    html += '<text x="300" y="296" text-anchor="middle" font-family="Unbounded,system-ui" font-weight="800" font-size="44" fill="#14161A">145</text>' +
      '<text x="300" y="320" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" letter-spacing="2" fill="#5F646C">МАНДАТОВ</text>';
    svg.innerHTML = html;
    if (legend) legend.innerHTML = lg;
  }

  /* --------------------------------------------------------------
     Анимация чисел
     -------------------------------------------------------------- */
  function countUp(root) {
    var els = root.querySelectorAll('[data-count]');
    Array.prototype.forEach.call(els, function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
      var suffix = el.querySelector('small');
      var sfx = suffix ? suffix.outerHTML : '';
      var t0 = null, dur = 1100;
      function fmt(v) {
        var s = dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toString();
        if (!dec) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return s;
      }
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.innerHTML = fmt(target * e) + sfx;
        if (p < 1) requestAnimationFrame(step);
      }
      el.innerHTML = fmt(0) + sfx;
      setTimeout(function () { requestAnimationFrame(step); }, 260);
    });
  }

  /* --------------------------------------------------------------
     Хром: прогресс, HUD, точки, кнопки
     -------------------------------------------------------------- */
  function buildChrome() {
    var hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML =
      '<div class="lbl"><b id="hudCh"></b> <span id="hudSp"></span></div>' +
      '<div class="r">' +
        '<button class="btn" id="bNotes">текст</button>' +
        '<button class="btn" id="bMenu">экраны</button>' +
        '<button class="btn" id="bHelp">?</button>' +
      '</div>';
    document.body.appendChild(hud);

    var dots = document.createElement('div');
    dots.id = 'dots';
    SLIDES.forEach(function (s, i) {
      var d = document.createElement('i');
      d.addEventListener('click', function () { go(i, i > cur ? 1 : -1); });
      dots.appendChild(d);
    });
    document.body.appendChild(dots);

    var nav = document.createElement('div');
    nav.id = 'nav';
    nav.innerHTML = '<button class="btn" id="bPrev">&#8592;</button><button class="btn" id="bNext">&#8594;</button>';
    document.body.appendChild(nav);

    document.getElementById('bPrev').onclick = prev;
    document.getElementById('bNext').onclick = next;
    document.getElementById('bMenu').onclick = function () { toggle('menu'); };
    document.getElementById('bHelp').onclick = function () { toggle('help'); };
    document.getElementById('bNotes').onclick = function () { toggle('notes'); };
  }

  function paint() {
    var s = SLIDES[cur];
    var c = CHAPTERS[s.ch];
    var sp = SPEAKERS[c.sp - 1];
    document.querySelector('#top i').style.width = ((cur) / (SLIDES.length - 1) * 100) + '%';
    var hc = document.getElementById('hudCh');
    if (hc) {
      hc.textContent = c.n + ' · ' + c.title;
      document.getElementById('hudSp').textContent = '— ' + sp.name;
    }
    var ds = document.querySelectorAll('#dots i');
    Array.prototype.forEach.call(ds, function (d, i) {
      d.className = i === cur ? 'cur' : (i < cur ? 'past' : '');
    });
    var mis = document.querySelectorAll('.mi');
    Array.prototype.forEach.call(mis, function (m) {
      m.classList.toggle('cur', parseInt(m.getAttribute('data-i'), 10) === cur);
    });
    var nt = document.getElementById('notesBody');
    if (nt) nt.textContent = names(SLIDES[cur].notes || '');
    var nth = document.getElementById('notesHead');
    if (nth) nth.textContent = (s.n !== null && s.n !== undefined ? 'Экран ' + pad(s.n) + ' · ' : '') + s.title;
    var ntm = document.getElementById('notesTime');
    if (ntm) { ntm.textContent = s.time ? '~ ' + s.time + ' сек · ' + sp.name : sp.name; }

    // ambient drift
    var b1 = document.querySelector('#amb .b1');
    var b2 = document.querySelector('#amb .b2');
    var k = cur / Math.max(1, SLIDES.length - 1);
    b1.style.transform = 'translate3d(' + (k * 34) + 'vw,' + (k * 14) + 'vh,0)';
    b2.style.transform = 'translate3d(' + (-k * 26) + 'vw,' + (-k * 12) + 'vh,0)';
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* --------------------------------------------------------------
     Оверлеи
     -------------------------------------------------------------- */
  function toggle(id) {
    var el = document.getElementById(id);
    var was = el.classList.contains('on');
    ['menu', 'help', 'notes'].forEach(function (x) {
      document.getElementById(x).classList.remove('on');
    });
    if (!was) el.classList.add('on');
  }
  function closeAll() {
    ['menu', 'help', 'notes'].forEach(function (x) {
      document.getElementById(x).classList.remove('on');
    });
  }

  function buildMenu() {
    var m = document.getElementById('menu');
    var h = '<h3 class="ovh">Все экраны</h3><p class="ovs">Кликните, чтобы перейти. Esc — закрыть.</p>';
    var lastCh = -1, opened = false;
    SLIDES.forEach(function (s, i) {
      if (s.ch !== lastCh) {
        lastCh = s.ch;
        var c = CHAPTERS[s.ch];
        var sp = SPEAKERS[c.sp - 1];
        h += (opened ? '</div>' : '') +
          '<div class="mgroup">' + c.n + ' · ' + c.title + ' — ' + sp.name + ' · ' + c.time + '</div><div class="mgrid">';
        opened = true;
      }
      h += '<button class="mi" data-i="' + i + '"><span class="n">' +
        (s.n !== null && s.n !== undefined ? 'экран ' + pad(s.n) : (s.kind === 'chap' ? 'блок' : '—')) +
        '</span><span class="h">' + s.title + '</span></button>';
    });
    h += '</div>';
    m.innerHTML = h;
    m.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.mi') : null;
      if (b) { var i = parseInt(b.getAttribute('data-i'), 10); closeAll(); go(i, i > cur ? 1 : -1); }
      else if (e.target === m) closeAll();
    });
  }

  function buildHelp() {
    document.getElementById('help').innerHTML =
      '<div class="ovbox"><h3 class="ovh">Управление</h3>' +
      '<p class="ovs">Esc — закрыть это окно.</p><table>' +
      '<tr><td><span class="key">→</span> <span class="key">Space</span></td><td>следующий экран</td></tr>' +
      '<tr><td><span class="key">←</span></td><td>предыдущий экран</td></tr>' +
      '<tr><td><span class="key">Home</span> <span class="key">End</span></td><td>первый / последний экран</td></tr>' +
      '<tr><td><span class="key">M</span></td><td>список всех экранов</td></tr>' +
      '<tr><td><span class="key">N</span></td><td>текст спикера для текущего экрана</td></tr>' +
      '<tr><td><span class="key">F</span></td><td>полноэкранный режим</td></tr>' +
      '<tr><td><span class="key">R</span></td><td>открыть пульт в новом окне</td></tr>' +
      '<tr><td>свайп</td><td>листание на телефоне и планшете</td></tr>' +
      '</table>' +
      '<p class="ovs" style="margin-top:24px">Сценарии всех пяти спикеров одной страницей для печати: ' +
      '<a href="script.html" target="_blank">script.html</a></p>' +
      '<p class="ovs" style="margin-top:24px">Пульт: откройте <span class="mono">?remote=1</span> во втором окне ' +
      'того же браузера — экраны синхронизируются. Презентацию держите на проекторе, пульт на втором мониторе или ноутбуке.</p></div>';
    document.getElementById('help').addEventListener('click', function (e) {
      if (e.target.id === 'help') closeAll();
    });
  }

  function buildNotes() {
    document.getElementById('notes').innerHTML =
      '<div class="ovbox"><h3 class="ovh" id="notesHead"></h3>' +
      '<p class="ovs">Текст спикера. N или Esc — закрыть. Все сценарии целиком: <a href="script.html" target="_blank">script.html</a></p>' +
      '<span class="ntime" id="notesTime"></span>' +
      '<div class="ntext" id="notesBody"></div></div>';
    document.getElementById('notes').addEventListener('click', function (e) {
      if (e.target.id === 'notes') closeAll();
    });
  }

  /* --------------------------------------------------------------
     Клавиатура и свайпы
     -------------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'Escape') { closeAll(); return; }
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0, -1);
    else if (k === 'End') go(SLIDES.length - 1, 1);
    else if (k === 'm' || k === 'M' || k === 'ь') toggle('menu');
    else if (k === 'n' || k === 'N' || k === 'т') toggle('notes');
    else if (k === '?' || k === '/') toggle('help');
    else if (k === 'f' || k === 'F' || k === 'а') fullscreen();
    else if (k === 'r' || k === 'R' || k === 'к') window.open('?remote=1' + location.hash, '_blank');
  });

  function fullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) document.exitFullscreen();
  }

  var tx = 0, ty = 0;
  document.addEventListener('touchstart', function (e) {
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { dx < 0 ? next() : prev(); }
  }, { passive: true });

  /* --------------------------------------------------------------
     Синхронизация с пультом
     -------------------------------------------------------------- */
  function broadcast() {
    if (bc) bc.postMessage({ type: 'state', i: cur });
    try { localStorage.setItem('polit-deck-i', String(cur)); } catch (err) {}
  }
  if (bc) {
    bc.onmessage = function (e) {
      var d = e.data || {};
      if (IS_REMOTE) {
        if (d.type === 'state') renderRemote(d.i);
      } else {
        if (d.type === 'cmd') {
          if (d.a === 'next') next();
          else if (d.a === 'prev') prev();
          else if (d.a === 'go') go(d.i, d.i > cur ? 1 : -1);
        } else if (d.type === 'hello') broadcast();
      }
    };
  }

  /* --------------------------------------------------------------
     Пульт
     -------------------------------------------------------------- */
  function buildRemote() {
    document.body.classList.add('is-remote');
    document.title = 'Пульт — политология';
    deck.innerHTML =
      '<div class="rm">' +
        (bc ? '' : '<div class="warnbox">Браузер не поддерживает синхронизацию между окнами. ' +
          'Обновите браузер или листайте с клавиатуры на самой презентации.</div>') +
        '<div class="warnbox">Пульт работает во втором окне <b>того же браузера и того же устройства</b>. ' +
          'Откройте презентацию на проекторе, а этот пульт — на втором мониторе.</div>' +
        '<div class="now"><div class="n" id="rN">—</div><div class="h" id="rT">Ожидание презентации…</div></div>' +
        '<div class="nx"><div class="n">Далее</div><div id="rNx">—</div></div>' +
        '<div class="pad">' +
          '<button class="btn" id="rPrev">← Назад</button>' +
          '<button class="btn" id="rNext">Вперёд →</button>' +
          '<button class="btn wide" id="rSync">Синхронизировать</button>' +
        '</div>' +
        '<div class="notes"><h4>Текст спикера</h4><div id="rNotes">—</div></div>' +
      '</div>';
    document.getElementById('rPrev').onclick = function () { cmd('prev'); };
    document.getElementById('rNext').onclick = function () { cmd('next'); };
    document.getElementById('rSync').onclick = function () { if (bc) bc.postMessage({ type: 'hello' }); };
    if (bc) bc.postMessage({ type: 'hello' });
    var saved = 0;
    try { saved = parseInt(localStorage.getItem('polit-deck-i') || '0', 10) || 0; } catch (err) {}
    renderRemote(saved);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); cmd('next'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); cmd('prev'); }
    });
  }
  function cmd(a) { if (bc) bc.postMessage({ type: 'cmd', a: a }); }
  function renderRemote(i) {
    i = clamp(i);
    var s = SLIDES[i], c = CHAPTERS[s.ch], sp = SPEAKERS[c.sp - 1];
    var nx = SLIDES[Math.min(SLIDES.length - 1, i + 1)];
    document.getElementById('rN').textContent =
      (s.n !== null && s.n !== undefined ? 'ЭКРАН ' + pad(s.n) + ' · ' : '') + c.n + ' ' + c.title + ' · ' + sp.name;
    document.getElementById('rT').textContent = s.title + (s.time ? ' · ~' + s.time + ' сек' : '');
    document.getElementById('rNx').textContent = (nx === s ? 'конец' : nx.title);
    document.getElementById('rNotes').textContent = names(s.notes || '—');
  }

})();
