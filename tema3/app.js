(function () {
  'use strict';

  /* ==============================================================
     Один 3D-мир, одна камера (модель impress.js).
     Каждый экран — плита 1280×720 со статичным положением в мире.
     Анимируются только два элемента: #cam (масштаб + перспектива)
     и #world (обратный поворот и сдвиг). Камера = инверсия трансформа
     целевой плиты. Ось X — время (слева направо), ось Y — глубина
     разбора (узел остановки наверху, экраны спускаются вниз),
     ось Z — акцент (узлы ближе, детали чуть глубже).
     ============================================================== */
  var W = 1280, H = 720, PERSPECTIVE = 1000, MAXS = 3;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAM_MS = RM ? 0 : 900, RESIZE_MS = RM ? 0 : 400;
  var deck = document.getElementById('deck');
  var cam = document.getElementById('cam');
  var world = document.getElementById('world');
  var cur = 0, overview = false, camScale = 1, settleTimer = null;

  /* -------- узлы остановок: римская цифра, заголовок, монеты -------- */
  SLIDES.forEach(function (s) {
    if (s.kind !== 'chap') return;
    var p = PARTS[s.part];
    s.html =
      '<div class="wrap">' +
        '<div class="roman">' + p.rn + '</div>' +
        '<div class="eyebrow" data-r><span class="rn ' + p.cls + '">' + p.rn + '</span><span>Остановка · ' + p.yrs + '</span></div>' +
        '<div class="big" data-r style="--i:1">' + p.title.replace(/(\S+)$/, '<em>$1</em>') + '</div>' +
        '<div class="sub" data-r style="--i:2">' + p.sub + '</div>' +
        '<div class="coins" data-r style="--i:3">' + PARTS.map(function (q, i) {
          return '<div class="coin' + (i === s.part ? ' cur' : (i < s.part ? ' done' : '')) + '"><i>' + q.rn + '</i><span>' + q.title + '</span></div>';
        }).join('') + '</div>' +
      '</div>';
    s.notes = 'Разделитель. Пауза на секунду, смена выступающего, следующий экран.';
  });

  /* -------- раскладка: хребет времени и пять колонн -------- */
  var HUB_X0 = 2400, HUB_GAP = 2400, ROW = 950, HUB_SCALE = 1;
  function layout() {
    var k = {};
    SLIDES.forEach(function (s) {
      if (s.kind === 'cover') { s.pos = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sc: HUB_SCALE }; return; }
      if (s.kind === 'end') { s.pos = { x: HUB_X0 + HUB_GAP * PARTS.length, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sc: HUB_SCALE }; return; }
      var hubX = HUB_X0 + HUB_GAP * s.part;
      if (s.kind === 'chap') { k[s.part] = 0; s.pos = { x: hubX, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sc: HUB_SCALE }; return; }
      var j = (k[s.part] = (k[s.part] || 0) + 1);
      s.pos = { x: hubX + 300, y: ROW * j, z: -150 * (j - 1), rx: 0, ry: -6, rz: 0, sc: 1 };
    });
  }
  layout();

  function place(el, p) {
    el.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,' + p.z + 'px) rotateX(' + (p.rx || 0) + 'deg) rotateY(' + (p.ry || 0) + 'deg) rotateZ(' + (p.rz || 0) + 'deg) scale(' + (p.sc || 1) + ')';
  }

  /* -------- мебель мира: хребет времени, фон эпохи, большие даты -------- */
  var YEARS = ['IV в. до н. э.', '1513', '1651 · 1762', '1848 · 1919', 'X век'];
  var SPINE_W = HUB_X0 + HUB_GAP * PARTS.length + 2600;
  var FUR = { minX: -1300, maxX: SPINE_W - 1300, minY: -1000, maxY: 3700 };   // концы хребта, верх дат, низ фона эпохи
  (function furniture() {
    var spine = document.createElement('div');
    spine.className = 'fur spine';
    spine.style.width = SPINE_W + 'px';
    spine.style.marginLeft = (-SPINE_W / 2) + 'px';
    place(spine, { x: (FUR.minX + FUR.maxX) / 2, y: -540, z: -500 });
    world.appendChild(spine);
    PARTS.forEach(function (p, i) {
      var hubX = HUB_X0 + HUB_GAP * i;
      var era = document.createElement('div');
      era.className = 'fur era';
      era.style.setProperty('--c', p.c);
      era.innerHTML = '<b>' + p.rn + '</b><span>' + p.title + '</span>';
      place(era, { x: hubX + 300, y: 1900, z: -700 });
      world.appendChild(era);
      var yr = document.createElement('div');
      yr.className = 'fur year';
      yr.innerHTML = '<span>' + YEARS[i] + '</span>';
      place(yr, { x: hubX, y: -900, z: -300 });
      world.appendChild(yr);
    });
  })();

  /* -------- рендер плит -------- */
  SLIDES.forEach(function (s, i) {
    var el = document.createElement('section');
    el.className = 'step' + (s.kind ? ' ' + s.kind : '');
    el.setAttribute('data-i', i);
    el.innerHTML = s.html;
    place(el, s.pos);
    world.appendChild(el);
    s.el = el;
    el.addEventListener('click', function (e) {
      if (overview) { e.stopPropagation(); exitOverview(i); return; }
      var f = e.target.closest ? e.target.closest('.tab') : null;
      if (f) f.classList.toggle('is-flipped');
    });
  });
  buildChrome();
  buildHelp();
  buildNotes();

  /* -------- отсечение: далёкие плиты и фон чужих эпох не рисуются вовсе.
     Видимыми держим текущую плиту, две назад и три вперёд (следующая
     цель уже отрисована к моменту перелёта), плюс мебель соседних частей. */
  var eras = Array.prototype.slice.call(world.querySelectorAll('.fur.era'));
  var years = Array.prototype.slice.call(world.querySelectorAll('.fur.year'));
  function cull() {
    var all = overview;
    SLIDES.forEach(function (s, i) {
      var near = i >= cur - 2 && i <= cur + 3;
      s.el.style.visibility = (all || near) ? '' : 'hidden';
    });
    var part = SLIDES[cur].part;
    eras.forEach(function (e, i) { e.style.visibility = (all || Math.abs(i - part) <= 1) ? '' : 'hidden'; });
    years.forEach(function (e, i) { e.style.visibility = (all || Math.abs(i - part) <= 1) ? '' : 'hidden'; });
  }

  function winScale() { return Math.min(Math.min(window.innerWidth / W, window.innerHeight / H), MAXS); }
  function clamp(i) { return Math.max(0, Math.min(SLIDES.length - 1, i)); }

  /* -------- камера: перспектива масштабируется вместе с зумом;
     при приближении сначала поворот и сдвиг, потом масштаб; при
     отдалении — наоборот (эффект операторской тележки) -------- */
  var LITE = false, judged = false;
  function fly(p, ms, extraScale) {
    if (LITE && ms) ms = Math.min(ms, 700);
    var target = winScale() * (extraScale || 1) / p.sc;
    var half = 0;
    if (!judged && ms) judgeFrames(ms);
    cam.style.willChange = 'transform';
    world.style.willChange = 'transform';
    cam.style.transition = ms ? 'transform ' + ms + 'ms var(--e-cam)' : 'none';
    world.style.transition = ms ? 'transform ' + ms + 'ms var(--e-cam)' : 'none';
    cam.style.transform = 'perspective(' + (PERSPECTIVE / target) + 'px) scale(' + target + ')';
    world.style.transform = 'rotateZ(' + (-(p.rz || 0)) + 'deg) rotateY(' + (-(p.ry || 0)) + 'deg) rotateX(' + (-(p.rx || 0)) + 'deg) translate3d(' + (-p.x) + 'px,' + (-p.y) + 'px,' + (-p.z) + 'px)';
    camScale = target;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      cam.style.willChange = '';
      world.style.willChange = '';
      history.replaceState(null, '', '#' + cur);
      cull();
    }, ms + half + 20);
  }

  /* -------- лёгкий режим: решаем по кадрам первого же перелёта -------- */
  function setLite() {
    LITE = true;
    document.body.classList.add('lite');
    document.documentElement.style.setProperty('--t-cam', '700ms');
  }
  function judgeFrames(ms) {
    judged = true;
    var last = 0, n = 0, slow = 0;
    function tick(t) {
      if (last) { n++; if (t - last > 28) slow++; }
      last = t;
      if (n < Math.max(12, ms / 16)) { requestAnimationFrame(tick); return; }
      if (slow > n * 0.3) setLite();
    }
    requestAnimationFrame(tick);
  }
  if (/lite/.test(location.search)) { judged = true; setLite(); }

  function go(i, ms) {
    i = clamp(i);
    if (overview) { exitOverview(i); return; }
    var s = SLIDES[i], prev = SLIDES[cur];
    if (prev === s && s.el.classList.contains('on')) return;
    if (prev !== s) prev.el.classList.remove('on');
    Array.prototype.forEach.call(s.el.querySelectorAll('.tab.is-flipped'), function (f) { f.classList.remove('is-flipped'); });
    // сброс появления: спрятать без перехода, затем показать с задержками
    s.el.style.visibility = '';
    if (prev !== s) reveal(prev, false);
    s.el.classList.remove('on');
    reveal(s, false);
    void s.el.offsetWidth;
    s.el.classList.add('on');
    cur = i;
    var dur = ms === undefined ? CAM_MS : ms;
    fly(s.pos, dur);
    reveal(s, true, dur);
    paint();
  }

  /* -------- каскад появления: класс .in по таймеру на каждый элемент -------- */
  function reveal(s, on, dur) {
    (s.timers || []).forEach(clearTimeout);
    s.timers = [];
    var items = s.el.querySelectorAll('[data-r]');
    if (!on) { Array.prototype.forEach.call(items, function (el) { el.classList.remove('in'); }); return; }
    var base = LITE ? Math.round((dur || 0) * 0.7) : Math.round((dur || 0) * 0.6), step = LITE ? 0 : 55;
    Array.prototype.forEach.call(items, function (el, k) {
      var idx = parseInt(el.style.getPropertyValue('--i') || k, 10) || 0;
      s.timers.push(setTimeout(function () { el.classList.add('in'); }, base + idx * step));
    });
  }
  function next() { if (overview) { exitOverview(); return; } go(cur + 1); }
  function prev() { if (overview) { exitOverview(); return; } go(cur - 1); }

  /* -------- карта: камера отлетает, виден весь путь; клик — перелёт -------- */
  var bounds = (function () {
    var xs = [FUR.minX, FUR.maxX], ys = [FUR.minY, FUR.maxY];
    SLIDES.forEach(function (s) { xs.push(s.pos.x - W * s.pos.sc / 2, s.pos.x + W * s.pos.sc / 2); ys.push(s.pos.y - H * s.pos.sc / 2, s.pos.y + H * s.pos.sc / 2); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  })();
  function enterOverview() {
    overview = true;
    document.body.classList.add('ov');
    cull();
    var fit = Math.min(W / bounds.w, H / bounds.h) * 0.9;
    fly({ x: bounds.cx, y: bounds.cy, z: 0, rx: 0, ry: 0, rz: 0, sc: 1 }, CAM_MS, fit);
    paint();
  }
  function exitOverview(target) {
    overview = false;
    document.body.classList.remove('ov');
    if (target !== undefined && target !== cur) { go(target); return; }
    fly(SLIDES[cur].pos, CAM_MS);
    paint();
  }
  function toggleOverview() { overview ? exitOverview() : enterOverview(); }
  window.addEventListener('resize', function () { overview ? enterOverview() : fly(SLIDES[cur].pos, RESIZE_MS); });

  /* -------- параллакс фоновых пластин и свет за курсором (вне 3D-мира) -------- */
  var shards = document.querySelectorAll('.shard'), spot = document.getElementById('spot');
  var mmRaf = 0, mx = 0, my = 0;
  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (mmRaf) return;
    mmRaf = requestAnimationFrame(function () {
      mmRaf = 0;
      var x = mx / window.innerWidth - .5, y = my / window.innerHeight - .5;
      Array.prototype.forEach.call(shards, function (sh) {
        var d = parseFloat(sh.getAttribute('data-depth') || '1');
        sh.style.setProperty('--px', (-x * 22 * d) + 'px');
        sh.style.setProperty('--py', (-y * 16 * d) + 'px');
      });
      spot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    });
  });

  /* -------- хром: рельса времени с маркером, стрелки -------- */
  function buildChrome() {
    var hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = '<div class="lbl"><b id="hudCh"></b></div>' +
      '<div class="r"><button class="btn" id="bOv">карта</button><button class="btn" id="bHelp">?</button></div>';
    document.body.appendChild(hud);

    var rail = document.createElement('div');
    rail.id = 'rail';
    rail.innerHTML = '<div class="line">' + PARTS.map(function (p, i) {
      return '<i style="--p:' + (i / (PARTS.length - 1)) + '"><span>' + p.yrs + '</span></i>';
    }).join('') + '<b id="marker"></b></div>';
    document.body.appendChild(rail);

    var nav = document.createElement('div');
    nav.id = 'nav';
    nav.innerHTML = '<button class="btn" id="bPrev">&#8592;</button><button class="btn" id="bNext">&#8594;</button>';
    document.body.appendChild(nav);

    document.getElementById('bPrev').onclick = prev;
    document.getElementById('bNext').onclick = next;
    document.getElementById('bOv').onclick = toggleOverview;
    document.getElementById('bHelp').onclick = function () { toggle('help'); };
  }
  function moveMarker(era) {
    var m = document.getElementById('marker');
    if (!m) return;
    var a = m.getBoundingClientRect();
    m.style.left = 'calc(' + era + ' / ' + (PARTS.length - 1) + ' * 100%)';
    var b = m.getBoundingClientRect();
    if (m.animate && a.width) m.animate([{ transform: 'translate(calc(-50% + ' + (a.left - b.left) + 'px),-50%)' }, { transform: 'translate(-50%,-50%)' }], { duration: CAM_MS, easing: 'cubic-bezier(.65,0,.35,1)' });
  }
  function paint() {
    var s = SLIDES[cur], p = PARTS[s.part];
    document.querySelector('#top i').style.transform = 'scaleX(' + (cur / (SLIDES.length - 1)) + ')';
    var hc = document.getElementById('hudCh');
    if (hc) hc.textContent = overview ? 'Карта пути' : (s.kind === 'cover' ? 'Тема 3' : p.rn + ' · ' + p.title);
    document.body.classList.toggle('on-cover', s.kind === 'cover' && !overview);
    moveMarker(s.part);
    var nt = document.getElementById('notesBody'); if (nt) nt.textContent = s.notes || '';
    var nth = document.getElementById('notesHead'); if (nth) nth.textContent = (s.n !== null && s.n !== undefined ? 'Экран ' + pad(s.n) + ' · ' : '') + s.title;
    var ntm = document.getElementById('notesTime'); if (ntm) ntm.textContent = s.time ? '~ ' + s.time + ' сек' : 'без текста';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toggle(id) { var el = document.getElementById(id), was = el.classList.contains('on'); closeAll(); if (!was) el.classList.add('on'); }
  function closeAll() { ['help', 'notes'].forEach(function (x) { document.getElementById(x).classList.remove('on'); }); }
  function buildHelp() {
    document.getElementById('help').innerHTML =
      '<div class="ovbox"><h3 class="ovh">Управление</h3><p class="ovs">Esc — закрыть это окно.</p><table>' +
      '<tr><td><span class="key">→</span> <span class="key">Space</span></td><td>следующий экран — камера перелетает к нему</td></tr>' +
      '<tr><td><span class="key">←</span></td><td>предыдущий экран</td></tr>' +
      '<tr><td><span class="key">Home</span> <span class="key">End</span></td><td>первый / последний экран</td></tr>' +
      '<tr><td><span class="key">M</span></td><td>карта: камера отлетает и показывает весь путь; клик по любой плите — перелёт к ней</td></tr>' +
      '<tr><td><span class="key">N</span></td><td>текст для текущего экрана — работает, если открыть адрес с <span class="key">?notes</span></td></tr>' +
      '<tr><td><span class="key">F</span></td><td>полноэкранный режим</td></tr>' +
      '<tr><td>мышь</td><td>таблички мыслителей переворачиваются при наведении или клике</td></tr>' +
      '<tr><td>свайп</td><td>листание на телефоне и планшете</td></tr>' +
      '</table><p class="ovs" style="margin-top:24px">Все тексты одной страницей для печати: <a href="script.html" target="_blank">script.html</a></p></div>';
    document.getElementById('help').addEventListener('click', function (e) { if (e.target.id === 'help') closeAll(); });
  }
  function buildNotes() {
    document.getElementById('notes').innerHTML =
      '<div class="ovbox"><h3 class="ovh" id="notesHead"></h3>' +
      '<p class="ovs">Текст для этого экрана. N или Esc — закрыть. Все тексты: <a href="script.html" target="_blank">script.html</a></p>' +
      '<span class="ntime" id="notesTime"></span><div class="ntext" id="notesBody"></div></div>';
    document.getElementById('notes').addEventListener('click', function (e) { if (e.target.id === 'notes') closeAll(); });
  }

  /* -------- клавиатура и свайпы -------- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'Escape') { if (overview) exitOverview(); closeAll(); return; }
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(SLIDES.length - 1);
    else if (k === 'm' || k === 'M' || k === 'ь') toggleOverview();
    else if ((k === 'n' || k === 'N' || k === 'т') && /notes/.test(location.search)) toggle('notes');
    else if (k === '?' || k === '/') toggle('help');
    else if (k === 'f' || k === 'F' || k === 'а') fullscreen();
  });
  function fullscreen() {
    if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  }
  var tx = 0, ty = 0;
  document.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { dx < 0 ? next() : prev(); }
  }, { passive: true });

  /* -------- старт -------- */
  var start = parseInt((location.hash || '').replace('#', ''), 10);
  cur = isNaN(start) ? 0 : clamp(start);
  go(cur, 0);
  cull();
})();
