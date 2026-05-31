/* ===================================================================
   פריצת דרך · קן דן ירדן — לוגיקת האתר
   =================================================================== */
(function () {
  'use strict';

  var navLinks  = document.querySelectorAll('.nav-link');
  var pages     = document.querySelectorAll('.page');
  var sidebar   = document.getElementById('sidebar');
  var overlay   = document.getElementById('overlay');
  var toggle    = document.getElementById('menuToggle');
  var content   = document.getElementById('content');

  /* ---------- ניווט ראשי בין טאבים ---------- */
  function showPage(id) {
    pages.forEach(function (p) { p.classList.toggle('active', p.id === id); });
    navLinks.forEach(function (l) { l.classList.toggle('active', l.dataset.target === id); });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMenu();
    runReveal();
    if (id === 'home') startCounters();
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(link.dataset.target);
    });
  });

  /* כל כפתור עם data-goto מנווט לעמוד */
  document.querySelectorAll('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () { showPage(btn.dataset.goto); });
  });

  /* ---------- טאבי משנה ---------- */
  document.querySelectorAll('.subtabs').forEach(function (group) {
    var tabs = group.querySelectorAll('.subtab');
    var section = group.closest('.page');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        section.querySelectorAll('.subpanel').forEach(function (panel) {
          panel.classList.toggle('active', panel.id === tab.dataset.sub);
        });
        runReveal();
      });
    });
  });

  /* ---------- תפריט נייד ---------- */
  function openMenu()  { sidebar.classList.add('open'); overlay.classList.add('show'); toggle.classList.add('open'); }
  function closeMenu() { sidebar.classList.remove('open'); overlay.classList.remove('show'); toggle.classList.remove('open'); }
  if (toggle) {
    toggle.addEventListener('click', function () {
      sidebar.classList.contains('open') ? closeMenu() : openMenu();
    });
  }
  if (overlay) overlay.addEventListener('click', closeMenu);

  /* ---------- אנימציית חשיפה בגלילה ---------- */
  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); observer.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
  }
  function runReveal() {
    var items = document.querySelectorAll('.page.active .reveal:not(.in)');
    if (observer) {
      items.forEach(function (el) { observer.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ---------- מונים ---------- */
  var countersDone = false;
  function startCounters() {
    if (countersDone) return;
    countersDone = true;
    document.querySelectorAll('.num[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var decimals = (target % 1 !== 0) ? 1 : 0;
      var start = null, dur = 1600;
      function step(ts) {
        if (!start) start = ts;
        var prog = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - prog, 3);
        var val = (target * eased).toFixed(decimals);
        el.textContent = prefix + val + suffix;
        if (prog < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- חלקיקי רקע ב-HERO ---------- */
  var pc = document.getElementById('particles');
  if (pc) {
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('span');
      var size = 4 + Math.floor(i % 5) * 4;          /* 4–20px, דטרמיניסטי */
      s.style.width = s.style.height = size + 'px';
      s.style.insetInlineStart = ((i * 37) % 100) + '%';
      s.style.animationDuration = (10 + (i % 8) * 2) + 's';
      s.style.animationDelay = '-' + (i % 10) + 's';
      pc.appendChild(s);
    }
  }

  /* ---------- טופס ---------- */
  var form = document.getElementById('ctaForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var msg = document.getElementById('formMsg');
      if (msg) msg.hidden = false;
      form.querySelectorAll('input,textarea').forEach(function (f) { f.value = ''; });
    });
  }

  /* ---------- אתחול ---------- */
  var initial = (location.hash || '#home').replace('#', '');
  if (document.getElementById(initial)) {
    showPage(initial);
  } else {
    runReveal();
    startCounters();
  }
})();
