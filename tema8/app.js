(function () {
  'use strict';

  /* Один экран за раз, без анимаций. Кнопка снизу открывает справа
     блок с текстом текущего экрана; схемы (fig) рисуются из данных. */
  var stage = document.getElementById('stage');
  var panel = document.getElementById('panel');
  var logo = document.getElementById('logo');
  var parts = document.getElementById('parts');
  var num = document.getElementById('num');
  var no = document.getElementById('no');
  var index = document.getElementById('index');
  var cur = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clamp(i) { return Math.max(0, Math.min(SLIDES.length - 1, i)); }

  function fig(f) {
    if (!f) return '';
    if (f.type === 'tl') return '<ol class="tl">' + f.items.map(function (x) {
      return '<li><span class="y">' + x[0] + '</span><span class="d">' + x[1] + '</span></li>';
    }).join('') + '</ol>';
    if (f.type === 'grid') return '<div class="grid">' + f.items.map(function (x) {
      return '<div><span class="l">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>';
    }).join('') + '</div>';
    if (f.type === 'cmp') return '<table class="cmp"><tr><th></th><th>' + f.head[0] + '</th><th class="a">' + f.head[1] + '</th></tr>' +
      f.rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td class="a">' + r[2] + '</td></tr>'; }).join('') + '</table>';
    if (f.type === 'steps') return '<ol class="steps">' + f.items.map(function (x, i) {
      return '<li><b>' + (i + 1) + '</b>' + x + '</li>';
    }).join('') + '</ol>';
    return '';
  }

  function render() {
    var s = SLIDES[cur], p = PARTS[s.part];
    var big = s.kind === 'cover' || s.kind === 'end';
    var h = '<div class="col">';
    h += '<p class="kick">' + (s.kick || (p.rn + ' · ' + p.title)) + '</p>';
    h += '<h1>' + s.title + '</h1>';
    if (s.sub) h += '<p class="sub">' + s.sub + '</p>';
    if (s.fig && s.lines && s.lines.length === 1) h += '<p class="lead">' + s.lines[0] + '</p>';
    else if (s.lines && s.lines.length) h += '<ul class="lines">' + s.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>';
    if (s.fig) h += '<div class="fig">' + fig(s.fig) + '</div>';
    h += '</div>';
    stage.className = big ? 'cover' : '';
    stage.innerHTML = h;
    num.textContent = s.kind === 'cover' ? '08' : (s.kind === 'end' ? '' : pad(s.n));

    var t = '<p class="t">' + (s.n !== null && s.n !== undefined ? pad(s.n) + ' · ' : '') + s.title.replace(/<[^>]+>/g, '') + '</p>';
    t += (s.text || []).map(function (x) { return '<p>' + x + '</p>'; }).join('');
    if (s.src && s.src.length) t += '<div class="src">' + s.src.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>';
    panel.innerHTML = t;
    panel.scrollTop = 0;

    parts.innerHTML = PARTS.map(function (q, i) {
      return '<span' + (i === s.part ? ' class="cur"' : '') + '><b>' + q.rn + '</b><em>' + q.title + '</em></span>';
    }).join('');
    no.innerHTML = '<b>' + pad(cur + 1) + '</b> / ' + pad(SLIDES.length);
    Array.prototype.forEach.call(index.querySelectorAll('li'), function (li, i) { li.classList.toggle('cur', i === cur); });
    history.replaceState(null, '', '#' + cur);
  }

  function go(i) { var j = clamp(i); if (j === cur) return; cur = j; render(); }
  function toggle(open) {
    var on = open === undefined ? !document.body.classList.contains('open') : open;
    document.body.classList.toggle('open', on);
    logo.querySelector('i').textContent = on ? '×' : '+';
    logo.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function toggleIndex(open) {
    var on = open === undefined ? !document.body.classList.contains('idx') : open;
    document.body.classList.toggle('idx', on);
  }

  index.innerHTML = '<h2>Все слайды</h2><ol>' + SLIDES.map(function (s, i) {
    return '<li><button data-i="' + i + '"><em>' + pad(i + 1) + '</em><span>' + s.title.replace(/<[^>]+>/g, '') + '</span></button></li>';
  }).join('') + '</ol>';
  index.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-i]') : null;
    if (b) { toggleIndex(false); go(parseInt(b.getAttribute('data-i'), 10)); }
  });

  logo.addEventListener('click', function () { toggle(); });
  document.getElementById('prev').addEventListener('click', function () { go(cur - 1); });
  document.getElementById('next').addEventListener('click', function () { go(cur + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'Escape') { toggleIndex(false); toggle(false); return; }
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(SLIDES.length - 1);
    else if (k === 'Enter' || k === 't' || k === 'T' || k === 'е' || k === 'Е') { e.preventDefault(); toggle(); }
    else if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') toggleIndex();
    else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') {
      if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  var tx = 0, ty = 0;
  document.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  var start = parseInt((location.hash || '').replace('#', ''), 10);
  cur = isNaN(start) ? 0 : clamp(start);
  render();
})();
