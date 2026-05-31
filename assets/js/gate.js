/* ===================================================================
   פריצת דרך · שער כניסה בסיסמה (gate)
   -------------------------------------------------------------------
   חוסם את הצפייה באתר עד הזנת סיסמה נכונה.
   ⚠️ הגנה בצד-לקוח בלבד — מתאימה לשלב ראשון (מניעת כניסה מזדמנת),
      אינה אבטחה ברמת שרת. לאבטחה אמיתית: Cloudflare Access / Netlify.
   -------------------------------------------------------------------
   רץ מוקדם ככל האפשר (לפני ציור התוכן) דרך הזרקת סגנון מסתיר.
   =================================================================== */
(function () {
  'use strict';

  /* === הגדרות === */
  var PASSWORD = 'derech';                 /* ← הסיסמה לכניסה לאתר */
  var SITE_TITLE = 'פריצת דרך';
  var SITE_SUB = 'קן דן ירדן · אתר מידע';
  var REMEMBER_KEY = 'pd_gate_ok_v1';
  var SESSION_OK = 'pd_gate_session';

  /* אם כבר אומת (נזכר/סשן) — לא חוסמים */
  function alreadyIn() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1' ||
             sessionStorage.getItem(SESSION_OK) === '1';
    } catch (e) { return false; }
  }
  if (alreadyIn()) return;

  /* הסתרת התוכן מיד (לפני שהדף מצויר) */
  var hideStyle = document.createElement('style');
  hideStyle.id = 'gateHide';
  hideStyle.textContent = 'body>*:not(#gate){filter:blur(0);} html.gated body{overflow:hidden}' +
    'html.gated body>.sidebar,html.gated body>.content,html.gated body>.menu-toggle,' +
    'html.gated body>.admin-fab,html.gated body>.overlay{visibility:hidden!important}';
  document.documentElement.classList.add('gated');
  (document.head || document.documentElement).appendChild(hideStyle);

  function build() {
    if (document.getElementById('gate')) return;
    var g = document.createElement('div');
    g.id = 'gate';
    g.innerHTML =
      '<div class="gate-bg"></div>' +
      '<div class="gate-card">' +
        '<img class="gate-logo" src="assets/img/logo.png" alt="פריצת דרך" />' +
        '<h1>' + SITE_TITLE + '</h1>' +
        '<p class="gate-sub">' + SITE_SUB + '</p>' +
        '<p class="gate-msg">הכניסה לאתר באמצעות סיסמה בלבד</p>' +
        '<form id="gateForm" autocomplete="off">' +
          '<input type="password" id="gatePass" placeholder="הזינו סיסמה" autocomplete="off" />' +
          '<label class="gate-remember"><input type="checkbox" id="gateRemember" checked /> זכור אותי במכשיר זה</label>' +
          '<div class="gate-err" id="gateErr"></div>' +
          '<button type="submit">כניסה</button>' +
        '</form>' +
        '<div class="gate-foot">אתר מידע · גישה מוגבלת</div>' +
      '</div>';
    document.body.appendChild(g);

    var form = document.getElementById('gateForm');
    var pass = document.getElementById('gatePass');
    var err  = document.getElementById('gateErr');
    pass.focus();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pass.value === PASSWORD) {
        try {
          if (document.getElementById('gateRemember').checked) localStorage.setItem(REMEMBER_KEY, '1');
          sessionStorage.setItem(SESSION_OK, '1');
        } catch (ex) {}
        g.classList.add('gate-out');
        document.documentElement.classList.remove('gated');
        setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 450);
      } else {
        err.textContent = 'סיסמה שגויה, נסו שוב';
        g.classList.add('gate-shake');
        pass.select();
        setTimeout(function () { g.classList.remove('gate-shake'); }, 500);
      }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
