/* ===================================================================
   פריצת דרך · מנוע אדמין לעריכת האתר
   -------------------------------------------------------------------
   • עריכת טקסט inline (contentEditable)
   • עיצוב טקסט: מודגש/נטוי/קו תחתי, צבע, גודל, יישור
   • החלפת תמונות ורקעים (נשמר כ-dataURL)
   • עריכת ערכת הצבעים של האתר
   • שמירה אוטומטית ל-localStorage + ייצוא/ייבוא קובץ + איפוס
   • השינויים מוחלים על כל טעינה (גם למבקר רגיל באותו דפדפן)

   הערה: ההגנה בסיסמה היא שכבת נוחות בצד-לקוח בלבד, לא אבטחה אמיתית.
   =================================================================== */
(function () {
  'use strict';

  /* תופס שגיאות גלוי — מציג כל שגיאת ריצה על המסך */
  window.addEventListener('error', function(ev){
    try{
      var box = document.getElementById('pdErr');
      if(!box){
        box = document.createElement('div'); box.id='pdErr';
        box.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#b4452e;color:#fff;font:13px/1.5 monospace;padding:10px 14px;direction:ltr;white-space:pre-wrap;max-height:40vh;overflow:auto;box-shadow:0 -4px 20px rgba(0,0,0,.4)';
        document.body.appendChild(box);
      }
      box.textContent = '⚠ JS ERROR: ' + ev.message + '\n@ ' + (ev.filename||'').split('/').pop() + ':' + ev.lineno + ':' + ev.colno;
    }catch(e){}
  });

  var STORE_KEY  = 'pd_admin_overrides_v1';
  var THEME_KEY  = 'pd_admin_theme_v1';
  var BLOCKS_KEY = 'pd_admin_blocks_v1';
  var PASS_KEY   = 'pd_admin_pass_v1';
  var DEFAULT_PASS = 'derech2050';          /* ניתן לשינוי בסרגל האדמין */

  /* תמונת placeholder לבלוק תמונה חדש */
  var IMG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='360'%3E%3Crect width='600' height='360' fill='%23eaf1f5'/%3E%3Cg fill='none' stroke='%231f87b0' stroke-width='3' opacity='.55'%3E%3Crect x='30' y='30' width='540' height='300' rx='12'/%3E%3Ccircle cx='160' cy='150' r='40'/%3E%3Cpath d='M60 300 L230 170 L330 250 L430 160 L540 270'/%3E%3C/g%3E%3Ctext x='300' y='335' text-anchor='middle' font-family='Arial' font-size='20' fill='%237c8e9a'%3E%D7%9C%D7%97%D7%A6%D7%95 %D7%9C%D7%94%D7%A2%D7%9C%D7%90%D7%AA %D7%AA%D7%9E%D7%95%D7%A0%D7%94%3C/text%3E%3C/svg%3E";

  /* בוררים לאלמנטים הניתנים לעריכת טקסט */
  var TEXT_SELECTORS = [
    '.hero-title', '.hero-sub', '.eyebrow',
    '.lead h3', '.lead p',
    '.section-kicker',
    '.pillar h5', '.pillar p', '.pillar-num',
    '.mini h5', '.mini p',
    '.stat label',
    '.nav-card b', '.nav-card span',
    '.page-head h2', '.page-head p',
    '.subtab',
    '.subpanel > h3', '.subpanel > p',
    '.split-text h3', '.split-text p',
    '.ticks li',
    '.callout',
    '.layer b', '.layer p',
    '.corridor .node',
    '.spec b', '.spec span',
    '.tl-item b', '.tl-item p',
    '.rm b', '.rm p', '.rm-year',
    '.bar span',
    '.cta-form h4', '.field label',
    '.site-footer p', '.site-footer small',
    '.brand-text h1', '.brand-text p',
    '.nav-label', '.hero-scroll',
    '.sidebar-footer p', '.sidebar-footer small'
  ];

  /* תמונות הניתנות להחלפה (img) ורקעי split-visual */
  var IMG_SELECTORS = ['.brand-logo img'];
  var BG_SELECTORS  = ['.split-visual'];

  /* אלמנטים קיימים שאחריהם ניתן להוסיף תוכן (מפריד ＋) */
  var INSERT_AFTER_SELECTORS = [
    '.lead', '.section-kicker',
    '.cards-3', '.stats-band', '.nav-cards',
    '.split', '.callout', '.corridor', '.layers',
    '.specs', '.timeline', '.roadmap', '.bar-chart',
    '.imec-map', '.photo-band',
    '.subpanel > h3', '.subpanel > p',
    '.pillar', '.mini', '.spec', '.rm', '.tl-item', '.layer'
  ];

  /* אלמנטים קיימים הניתנים להזזה (גרירה חופשית במצב אדמין) */
  var MOVE_SELECTORS = [
    '.stats-band', '.stat',
    '.pillar', '.mini', '.spec', '.rm',
    '.lead', '.callout',
    '.cards-3', '.nav-cards', '.nav-card',
    '.corridor', '.layer', '.layers',
    '.timeline', '.tl-item', '.roadmap',
    '.bar-chart', '.specs',
    '.split', '.split-text', '.split-visual',
    '.hero-title', '.hero-sub', '.hero-actions',
    '.section-kicker',
    '.imec-map', '.photo-band',
    '.subpanel > h3', '.subpanel > p'
  ];

  var THEME_VARS = [
    { var: '--olive',     label: 'ירוק דן (ראשי)' },
    { var: '--olive-deep',label: 'ירוק כהה' },
    { var: '--sea',       label: 'תכלת ים' },
    { var: '--sea-deep',  label: 'ים כהה' },
    { var: '--sand',      label: 'חום בקעה' },
    { var: '--sand-deep', label: 'חום כהה' },
    { var: '--ink',       label: 'צבע טקסט' },
    { var: '--paper',     label: 'רקע' }
  ];

  var overrides = load(STORE_KEY) || {};   /* { key: {html|text|src|bg|style} } */
  var theme     = load(THEME_KEY) || {};
  var blocks    = load(BLOCKS_KEY) || {};  /* { pageId: [ {id,type,html,img,caption} ] } */
  var adminOn   = false;
  var dirty     = false;

  /* ---------- עזרי אחסון ---------- */
  function load(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
  function save(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
  function getPass(){ return localStorage.getItem(PASS_KEY) || DEFAULT_PASS; }

  /* ---------- מפתח יציב לכל אלמנט (נתיב nth-child) ---------- */
  function keyOf(el){
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body){
      var p = node.parentNode;
      if (!p) break;
      var idx = Array.prototype.indexOf.call(p.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      if (p.id){ parts.unshift('#' + p.id); break; }
      node = p;
    }
    return parts.join('>');
  }

  /* ---------- החלת שינויים שמורים (רץ תמיד) ---------- */
  function applyOverrides(){
    /* טקסט / HTML */
    eachText(function(el){
      var k = keyOf(el);
      var o = overrides[k];
      if (!o) return;
      if (o.html != null) el.innerHTML = o.html;
      if (o.style){ el.setAttribute('style', (el.getAttribute('style')||'') + ';' + o.style); }
    });
    /* תמונות */
    eachSel(IMG_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (o && o.src) el.src = o.src;
    });
    /* אלמנטים שהוסתרו / שונה גודלם */
    eachSel(MOVE_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (!o) return;
      if (o.hidden) el.classList.add('pd-hidden');
      if (o.size){ el.style.width = o.size.w + 'px'; el.style.height = o.size.h + 'px'; }
    });
    /* תמונות רקע ראשיות שהוחלפו (page-head / hero) */
    eachSel(['.page-head', '.hero-layer.sky'], function(el){
      var o = overrides[keyOf(el)];
      if (o && o.bg){
        el.style.backgroundImage = 'url("'+o.bg+'")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-custom-bg');
      }
    });
    /* רקעים */
    eachSel(BG_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (o && o.bg){
        el.style.backgroundImage = 'url("' + o.bg + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-custom-bg');
      }
    });
    applyMoves();            /* מיקומי אלמנטים שהוזזו */
    applyTheme();
    renderBlocks();          /* בלוקים מותאמים אישית — תמיד מוצגים */
    injectInlineInserts(false);  /* בלוקים מעוגנים בין אלמנטים קיימים — גם למבקר */
  }

  /* החלת הזזות שמורות על אלמנטים קיימים */
  function applyMoves(){
    eachSel(MOVE_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (o && o.move){
        el.style.transform = 'translate(' + o.move.dx + 'px,' + o.move.dy + 'px)';
        el.style.position = el.style.position || 'relative';
        el.classList.add('pd-moved');
      }
    });
  }
  function applyTheme(){
    var root = document.documentElement;
    Object.keys(theme).forEach(function(v){ root.style.setProperty(v, theme[v]); });
  }

  function eachSel(sels, fn){
    sels.forEach(function(s){
      document.querySelectorAll(s).forEach(fn);
    });
  }
  function eachText(fn){ eachSel(TEXT_SELECTORS, fn); }

  /* ---------- בניית ממשק האדמין ---------- */
  function buildUI(){
    /* כפתור צף */
    var fab = el('button', 'admin-fab', '✎');
    fab.title = 'מצב עריכה (אדמין)';
    fab.addEventListener('click', requestLogin);
    document.body.appendChild(fab);

    /* סרגל עליון */
    var bar = el('div', 'admin-bar');
    bar.innerHTML =
      '<div class="ab-logo"><i>פד</i> מצב עריכה <b style="background:#1f87b0;color:#fff;border-radius:5px;padding:1px 7px;font-size:.72rem;margin-inline-start:6px">v58</b></div>' +
      '<button class="admin-btn primary" data-act="save">💾 שמירה</button>' +
      '<button class="admin-btn primary" data-act="add">➕ הוסף בלוק</button>' +
      '<button class="admin-btn" data-act="theme">🎨 עיצוב כללי</button>' +
      '<button class="admin-btn" data-act="grid">▦ רשת עזר</button>' +
      '<button class="admin-btn" data-act="export">⬇ ייצוא</button>' +
      '<button class="admin-btn" data-act="import">⬆ ייבוא</button>' +
      '<button class="admin-btn" data-act="pass">🔑 סיסמה</button>' +
      '<button class="admin-btn danger" data-act="reset">↺ איפוס</button>' +
      '<span class="ab-spacer"></span>' +
      '<span class="ab-status" id="abStatus">מוכן</span>' +
      '<button class="admin-btn exit" data-act="exit">✕ יציאה</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function(e){
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      if (act==='save'){ flush(); save(THEME_KEY, theme); save(BLOCKS_KEY, blocks); takeSnapshot(); setStatus('הכול נשמר ✓', true); publishToCloud(); }
      else if (act==='add') addBlockFlow();
      else if (act==='theme') toggleTheme();
      else if (act==='grid') toggleGrid(b);
      else if (act==='export') doExport();
      else if (act==='import') doImport();
      else if (act==='pass') changePass();
      else if (act==='reset') doReset();
      else if (act==='exit') exitAdmin();
    });

    /* סרגל עיצוב טקסט – גרסה משופרת */
    var fmt = el('div', 'fmt-toolbar');
    fmt.id = 'fmtToolbar';
    fmt.innerHTML =
      '<select data-font title="גופן">' +
        '<option value="">גופן</option>' +
        '<option value="Heebo" style="font-family:Heebo">Heebo</option>' +
        '<option value="Assistant" style="font-family:Assistant">Assistant</option>' +
        '<option value="Rubik" style="font-family:Rubik">Rubik</option>' +
        '<option value="David" style="font-family:David">דוד (David)</option>' +
        '<option value="Narkisim" style="font-family:Narkisim">נרקיסים</option>' +
        '<option value="FrankRuehl" style="font-family:FrankRuehl">פרנק-רוהל</option>' +
        '<option value="Miriam" style="font-family:Miriam">מרים</option>' +
        '<option value="Levenim MT" style="font-family:\'Levenim MT\'">לבנים</option>' +
        '<option value="Gisha" style="font-family:Gisha">גישה</option>' +
        '<option value="Rod" style="font-family:Rod">רוד</option>' +
        '<option value="Aharoni" style="font-family:Aharoni">אהרוני</option>' +
        '<option value="Guttman Yad" style="font-family:\'Guttman Yad\'">גוטמן יד</option>' +
        '<option value="Arial" style="font-family:Arial">Arial</option>' +
        '<option value="Tahoma" style="font-family:Tahoma">Tahoma</option>' +
        '<option value="Segoe UI" style="font-family:\'Segoe UI\'">Segoe UI</option>' +
        '<option value="Calibri" style="font-family:Calibri">Calibri</option>' +
        '<option value="Cambria" style="font-family:Cambria">Cambria</option>' +
        '<option value="Times New Roman" style="font-family:\'Times New Roman\'">Times</option>' +
        '<option value="Georgia" style="font-family:Georgia">Georgia</option>' +
        '<option value="Verdana" style="font-family:Verdana">Verdana</option>' +
        '<option value="Trebuchet MS" style="font-family:\'Trebuchet MS\'">Trebuchet</option>' +
        '<option value="Courier New" style="font-family:\'Courier New\'">Courier</option>' +
        '<option value="Impact" style="font-family:Impact">Impact</option>' +
      '</select>' +
      '<select data-size title="גודל גופן">' +
        '<option value="">גודל</option>' +
        '<option value="12px">12</option><option value="14px">14</option>' +
        '<option value="16px">16</option><option value="18px">18</option>' +
        '<option value="21px">21</option><option value="24px">24</option>' +
        '<option value="28px">28</option><option value="32px">32</option>' +
        '<option value="40px">40</option><option value="48px">48</option>' +
      '</select>' +
      '<select data-lh title="מרווח שורות">' +
        '<option value="">⇕ שורות</option>' +
        '<option value="1">1.0</option>' +
        '<option value="1.15">1.15</option>' +
        '<option value="1.3">1.3</option>' +
        '<option value="1.5">1.5</option>' +
        '<option value="1.8">1.8</option>' +
        '<option value="2">2.0</option>' +
      '</select>' +
      '<input type="color" data-color title="צבע טקסט" value="#16293a" />' +
      '<span class="sep"></span>' +
      '<button data-cmd="bold" title="מודגש">B</button>' +
      '<button data-cmd="italic" title="נטוי" style="font-style:italic">I</button>' +
      '<button data-cmd="underline" title="קו תחתי">U</button>' +
      '<span class="sep"></span>' +
      '<button data-cmd="justifyRight" title="יישור לימין">⇥</button>' +
      '<button data-cmd="justifyCenter" title="מרכוז">≡</button>' +
      '<button data-cmd="justifyLeft" title="יישור לשמאל">⇤</button>' +
      '<button data-cmd="justifyFull" title="דו צדדי">☰</button>' +
      '<span class="sep"></span>' +
      '<select data-bullet title="סגנון כוכביות">' +
        '<option value="">•</option>' +
        '<option value="disc">●</option><option value="circle">○</option>' +
        '<option value="square">■</option><option value="check">✓</option>' +
        '<option value="star">★</option><option value="arrow">→</option>' +
      '</select>' +
      '<select data-number title="מספור">' +
        '<option value="">1.</option>' +
        '<option value="decimal">1. 2.</option><option value="hebrew">א. ב.</option>' +
        '<option value="upper-roman">I. II.</option><option value="lower-roman">i. ii.</option>' +
      '</select>' +
      '<span class="sep"></span>' +
      '<button data-cmd="removeFormat" title="נקה">⌫</button>' +
      '<span class="sep"></span>' +
      '<span class="bg-controls" style="display:none; gap:4px; align-items:center">' +
        '<input type="color" data-bgcolor title="רקע תיבה" value="#ffffff" />' +
        '<input type="range" data-bgopacity title="אטימות" min="0" max="100" step="5" value="100" />' +
      '</span>';
    document.body.appendChild(fmt);

    /* הרשמה לאירועים
       חוסמים את ברירת-המחדל רק עבור כפתורי הפקודה (כדי לא לאבד את בחירת הטקסט).
       על select / input חובה לא לחסום — אחרת התפריט הנפתח / בוחר הצבע לא נפתחים כלל,
       ולכן הבחירה משוחזרת ידנית דרך restoreSel(). */
    fmt.addEventListener('mousedown', function(e){
      if (e.target.closest('button')) e.preventDefault();
    });

    /* לחצנים בסיסיים (בולד, איטליק וכו') */
    fmt.addEventListener('click', function(e){
      var b = e.target.closest('[data-cmd]'); if (!b) return;
      document.execCommand(b.dataset.cmd, false, null);
      markDirtyFromActive();
      setTimeout(refreshActiveBlockBg, 30);
    });

    /* גופן + גודל + צבע – מנגנון אמין */
    fmt.querySelector('[data-font]').addEventListener('change', function(e){
      applyInlineStyle({fontFamily: e.target.value});
    });
    fmt.querySelector('[data-size]').addEventListener('change', function(e){
      if (e.target.value) applyInlineStyle({fontSize: e.target.value});
    });
    fmt.querySelector('[data-color]').addEventListener('change', function(e){
      applyInlineStyle({color: e.target.value});
    });
    /* מרווח שורות — בשליטה ידנית מלאה, חל על תיבת הטקסט כולה */
    fmt.querySelector('[data-lh]').addEventListener('change', function(e){
      if (!activeEditable || !e.target.value) return;
      activeEditable.style.lineHeight = e.target.value;
      markDirtyFromActive();
      if (activeEditable.closest('.custom-block')) markBlocksDirty();
    });

    /* כוכביות ומספור משוכלל */
    // מאזינים לכוכביות ומספור
    const bulletSel = fmt.querySelector('[data-bullet]');
    const numberSel = fmt.querySelector('[data-number]');

    if (bulletSel) {
      bulletSel.addEventListener('change', function() {
        applyBulletStyle.call(this);
      });
    }
    if (numberSel) {
      numberSel.addEventListener('change', function() {
        applyNumberStyle.call(this);
      });
    }

    /* שליטה ברקע תיבת טקסט (מופיע רק בתוך בלוקים) */
    var bgc = fmt.querySelector('[data-bgcolor]');
    var bgo = fmt.querySelector('[data-bgopacity]');
    if (bgc) bgc.addEventListener('input', applyTextBoxBg);
    if (bgo) bgo.addEventListener('input', applyTextBoxBg);

    /* הצמדה לסרגל האדמין */
    bar.appendChild(fmt);
    fmt.classList.add('show');

    /* פאנל ערכת צבעים */
    var tp = el('div', 'theme-panel'); tp.id = 'themePanel';
    var rows = THEME_VARS.map(function(t){
      var cur = (theme[t.var] || cssVar(t.var) || '#000000').trim();
      return '<div class="tp-row"><label>'+t.label+'</label>' +
             '<input type="color" data-tvar="'+t.var+'" value="'+toHex(cur)+'"></div>';
    }).join('');
    tp.innerHTML = '<h3>עיצוב כללי</h3><div class="tp-sub">ערכת הצבעים של האתר</div>' + rows +
      '<button class="admin-btn primary" id="themeReset" style="margin-top:18px;width:100%;justify-content:center">החזר צבעי ברירת מחדל</button>' +
      '<div class="tp-note">הצבעים נשמרים אוטומטית ומשפיעים על כל האתר. ה"ירוק דן" הוא צבע ההדגשה הראשי.</div>';
    document.body.appendChild(tp);
    tp.addEventListener('input', function(e){
      var v = e.target.dataset.tvar; if (!v) return;
      theme[v] = e.target.value;
      document.documentElement.style.setProperty(v, e.target.value);
      save(THEME_KEY, theme); setStatus('נשמר', true);
    });
    tp.querySelector('#themeReset').addEventListener('click', function(){
      theme = {}; save(THEME_KEY, theme);
      THEME_VARS.forEach(function(t){ document.documentElement.style.removeProperty(t.var); });
      setStatus('אופס', true); setTimeout(function(){ location.reload(); }, 400);
    });

    /* input נסתר להעלאת תמונות */
    var fileIn = el('input'); fileIn.type='file'; fileIn.accept='image/*'; fileIn.id='admImgInput'; fileIn.style.display='none';
    document.body.appendChild(fileIn);

    /* מודאל */
    var modal = el('div','admin-modal'); modal.id='admModal';
    document.body.appendChild(modal);
  }

  /* ---------- כניסה / יציאה ---------- */
  function requestLogin(){
    showModal(
      '<h3>כניסת אדמין</h3><p>הזינו סיסמה כדי לערוך את האתר.</p>' +
      '<div class="am-err" id="loginErr"></div>' +
      '<input type="password" id="loginPass" placeholder="סיסמה" autofocus />' +
      '<div class="am-actions">' +
        '<button class="admin-btn" data-close>ביטול</button>' +
        '<button class="admin-btn primary" id="loginGo">כניסה</button>' +
      '</div>',
      function(box){
        var inp = box.querySelector('#loginPass');
        var go = function(){
          if (inp.value === getPass()){ hideModal(); enterAdmin(); }
          else { box.querySelector('#loginErr').textContent = 'סיסמה שגויה'; inp.select(); }
        };
        box.querySelector('#loginGo').addEventListener('click', go);
        inp.addEventListener('keydown', function(e){ if(e.key==='Enter') go(); });
        inp.focus();
      }
    );
  }

  /* צילום-מצב (snapshot) של המצב לפני תחילת העריכה — לצורך ביטול */
  var snapshot = null;
  function takeSnapshot(){
    snapshot = {
      overrides: localStorage.getItem(STORE_KEY),
      theme:     localStorage.getItem(THEME_KEY),
      blocks:    localStorage.getItem(BLOCKS_KEY)
    };
  }
  function restoreSnapshot(){
    if (!snapshot) return;
    setItemOrRemove(STORE_KEY,  snapshot.overrides);
    setItemOrRemove(THEME_KEY,  snapshot.theme);
    setItemOrRemove(BLOCKS_KEY, snapshot.blocks);
  }
  function setItemOrRemove(k, v){
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch(e){}
  }

  function enterAdmin(){
    adminOn = true;
    /* אם אין עריכות מקומיות אך קיים תוכן שפורסם — מתחילים לערוך ממנו */
    if (bakedContent && !load(STORE_KEY) && !load(BLOCKS_KEY)){
      if (bakedContent.overrides){ overrides = bakedContent.overrides; save(STORE_KEY, overrides); }
      if (bakedContent.theme)    { theme     = bakedContent.theme;     save(THEME_KEY, theme); }
      if (bakedContent.blocks)   { blocks    = bakedContent.blocks;    save(BLOCKS_KEY, blocks); }
    }
    takeSnapshot();          /* שומר את המצב המקורי לפני העריכה */
    document.body.classList.add('admin-on');
    document.body.classList.add('admin-mode');   /* מפעיל את סרגל הטקסט הצף (rich-text-toolbar) */
    enableEditing(true);
    renderBlocks();          /* רינדור מחדש עם כלי עריכה לבלוקים */
    injectInlineInserts(true);   /* מפרידי ＋ בין אלמנטים קיימים */
    setStatus('מצב עריכה פעיל');
    try { sessionStorage.setItem('pd_admin_session','1'); } catch(e){}
  }

  /* יציאה ממצב עריכה — שואל אם לשמור */
  function exitAdmin(){
    if (dirty) flush();
    showModal(
      '<h3>יציאה ממצב עריכה</h3><p>האם לשמור את השינויים שביצעת?</p>' +
      '<div class="am-actions">' +
        '<button class="admin-btn" data-close>המשך לערוך</button>' +
        '<button class="admin-btn danger" id="exDiscard">בטל שינויים</button>' +
        '<button class="admin-btn primary" id="exSave">שמור שינויים</button>' +
      '</div>',
      function(box){
        box.querySelector('#exSave').addEventListener('click', function(){
          hideModal(); finishExit();      /* השינויים כבר שמורים ב-localStorage */
          setStatus('השינויים נשמרו ✓', true);
          publishToCloud();               /* פרסום לכל המבקרים */
        });
        box.querySelector('#exDiscard').addEventListener('click', function(){
          restoreSnapshot();               /* החזרה למצב לפני העריכה */
          hideModal();
          location.reload();               /* טעינה מחדש כדי להציג את המצב המקורי */
        });
      }
    );
  }
  function finishExit(){
    adminOn = false;
    document.body.classList.remove('admin-on');
    enableEditing(false);
    renderBlocks();          /* רינדור מחדש ללא כלי עריכה */
    injectInlineInserts(true);   /* משאיר את הבלוקים המעוגנים, מסיר מפרידי ＋ דרך CSS */
    hideFmt();
    var tp = document.getElementById('themePanel'); if (tp) tp.classList.remove('show');
    try { sessionStorage.removeItem('pd_admin_session'); } catch(e){}
  }

  /* ---------- הפעלת עריכה ---------- */
  function enableEditing(on){
    eachText(function(el){
      if (on){
        el.setAttribute('data-editable','');
        el.setAttribute('contenteditable','true');
        el.addEventListener('input', onTextInput);
        el.addEventListener('mouseup', onSelect);
        el.addEventListener('keyup', onSelect);
        el.addEventListener('blur', onBlur);
      } else {
        el.removeAttribute('data-editable');
        el.removeAttribute('contenteditable');
        el.removeEventListener('input', onTextInput);
        el.removeEventListener('mouseup', onSelect);
        el.removeEventListener('keyup', onSelect);
        el.removeEventListener('blur', onBlur);
      }
    });
    eachSel(IMG_SELECTORS.concat(BG_SELECTORS), function(el){
      if (on){ el.setAttribute('data-img',''); el.addEventListener('click', onImgClick); }
      else { el.removeAttribute('data-img'); el.removeEventListener('click', onImgClick); }
    });
    enableMoving(on);
    enableHeroPickers(on);
  }

  /* כפתור בחירת תמונת רקע ראשית — מוצב על מיכל (host) אך מחליף רקע ביעד (target) */
  function enableHeroPickers(on){
    var specs = [];
    /* כל page-head: הכפתור והיעד הם אותו אלמנט */
    document.querySelectorAll('.page-head').forEach(function(n){ specs.push({host:n, target:n}); });
    /* עמוד הבית: הכפתור על .hero (לחיץ), היעד הוא שכבת התמונה .sky */
    var hero = document.querySelector('.hero');
    var sky  = document.querySelector('.hero-layer.sky');
    if (hero && sky) specs.push({host:hero, target:sky});

    specs.forEach(function(sp){
      var host = sp.host;
      if (on){
        if (host.querySelector(':scope > .pd-hero-pick')) return;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        var b = document.createElement('button');
        b.className = 'pd-hero-pick';
        b.type = 'button';
        b.textContent = '📷 תמונת רקע';
        b.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          heroPickTarget = sp.target;
          document.getElementById('admImgInput').click();
        });
        host.appendChild(b);
      } else {
        var ex = host.querySelector(':scope > .pd-hero-pick');
        if (ex) ex.remove();
      }
    });
  }

  /* ---------- הזזת אלמנטים קיימים ---------- */
  function enableMoving(on){
    eachSel(MOVE_SELECTORS, function(el){
      var existing = el.querySelector(':scope > .pd-move-handle');
      if (on){
        if (existing) return;
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.classList.add('pd-movable');
        var h = document.createElement('button');
        h.className = 'pd-move-handle';
        h.type = 'button';
        h.title = 'גררו כדי להזיז · לחיצה כפולה לאיפוס';
        h.textContent = '✥';
        h.addEventListener('pointerdown', function(e){ startMove(e, el, h); });
        h.addEventListener('dblclick', function(e){
          e.preventDefault(); e.stopPropagation();
          if (h._afterDrag) return;   /* לא לאפס בטעות אחרי גרירה */
          resetMove(el);
        });
        el.appendChild(h);
        /* כפתור הסתרה/מחיקה לאלמנט קיים */
        var dh = document.createElement('button');
        dh.className = 'pd-del-handle';
        dh.type = 'button';
        dh.title = 'הסתרת האלמנט';
        dh.textContent = '🗑';
        dh.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          hideExisting(el, dh);
        });
        el.appendChild(dh);
        /* 8 ידיות שינוי-גודל לאלמנט קיים */
        addExistingResizeHandles(el);
      } else {
        el.classList.remove('pd-movable');
        if (existing) existing.remove();
        var dx = el.querySelector(':scope > .pd-del-handle');
        if (dx) dx.remove();
        el.querySelectorAll(':scope > .cb-rz').forEach(function(n){ n.remove(); });
      }
    });
  }

  /* 8 ידיות שינוי-גודל לאלמנט קיים — נשמר ב-overrides[key].size={w,h} */
  function addExistingResizeHandles(el){
    if (el.querySelector(':scope > .cb-rz')) return;
    var dirs = ['n','s','e','w','ne','nw','se','sw'];
    dirs.forEach(function(d){
      var h = el2('div', 'cb-rz pd-rz cb-rz-' + d);
      h.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation();
        if (e.button != null && e.button !== 0) return;
        var sx = e.clientX, sy = e.clientY;
        var r = el.getBoundingClientRect();
        var startW = r.width, startH = r.height;
        selOnly(el);
        function mv(ev){
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          var nw = startW, nh = startH;
          if (d.indexOf('e') > -1) nw = startW + dx;
          if (d.indexOf('w') > -1) nw = startW - dx;
          if (d.indexOf('s') > -1) nh = startH + dy;
          if (d.indexOf('n') > -1) nh = startH - dy;
          nw = Math.max(60, Math.round(nw));
          nh = Math.max(40, Math.round(nh));
          el.style.width = nw + 'px';
          el.style.height = nh + 'px';
          el._sz = { w:nw, h:nh };
        }
        pdDrag(e, h, mv, function(){
          if (el._sz){
            var k = keyOf(el);
            overrides[k] = overrides[k] || {};
            overrides[k].size = el._sz;
            flush();
          }
        });
      });
      el.appendChild(h);
    });
  }
  function el2(tag, cls){ var e=document.createElement(tag); if(cls)e.className=cls; return e; }

  /* הסתרת אלמנט קיים (נשמר ב-overrides[key].hidden) — הפיך דרך איפוס */
  function hideExisting(el, btn){
    if (btn.dataset.armed === '1'){
      var k = keyOf(el);
      overrides[k] = overrides[k] || {};
      overrides[k].hidden = true;
      el.classList.add('pd-hidden');
      flush();
      setStatus('האלמנט הוסתר', true);
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = '⚠';
    btn.classList.add('pd-del-arm');
    setTimeout(function(){ btn.dataset.armed=''; btn.textContent='🗑'; btn.classList.remove('pd-del-arm'); }, 3000);
  }

  /* ---------- עוזר גרירה אחיד וחסין ----------
     • האזנה ב-document בשלב הלכידה (true) — שום stopPropagation או עזיבת
       הידית לא מאבדים אירועים; הבוקסה צמודה לסמן תמיד.
     • setPointerCapture כבונוס (אירועים גם מחוץ לחלון).
     • requestAnimationFrame — עדכון אחד לכל פריים, חלק ובלי פיגור. */
  var pdDragging = false;
  function pdDrag(e, handle, onMove, onEnd){
    pdDragging = true;
    try { handle.setPointerCapture(e.pointerId); } catch(_){}
    var raf = 0, last = null;
    function mv(ev){
      if (ev.pointerId !== e.pointerId) return;
      last = ev;
      if (!raf) raf = requestAnimationFrame(function(){ raf = 0; if (last && pdDragging) onMove(last); });
    }
    function up(ev){
      if (ev.pointerId !== e.pointerId) return;
      document.removeEventListener('pointermove', mv, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (last) onMove(last);           /* התנועה האחרונה — בלי לאבד פיקסל */
      try { handle.releasePointerCapture(e.pointerId); } catch(_){}
      pdDragging = false;
      onEnd(ev);
    }
    document.addEventListener('pointermove', mv, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
  }

  /* סימון אלמנט נבחר יחיד — רק עליו מוצגות הידיות */
  function selOnly(el){
    document.querySelectorAll('.pd-movable.pd-sel').forEach(function(n){
      if (n !== el) n.classList.remove('pd-sel');
    });
    el.classList.add('pd-sel');
  }
  function curMove(el){
    var o = overrides[keyOf(el)];
    return (o && o.move) ? { dx:o.move.dx, dy:o.move.dy } : { dx:0, dy:0 };
  }
  function startMove(e, el, handle){
    e.preventDefault(); e.stopPropagation();
    if (e.button != null && e.button !== 0) return;   /* כפתור שמאלי בלבד */
    var start = curMove(el);
    var sx = e.clientX, sy = e.clientY;
    var moved = false;
    selOnly(el);
    el.classList.add('pd-moving');
    el.style.transition = 'none';   /* מנצח כל transition של .reveal וכד' */
    pdDrag(e, handle, function(ev){
      var dx = start.dx + (ev.clientX - sx);
      var dy = start.dy + (ev.clientY - sy);
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      el._mv = { dx:dx, dy:dy };
    }, function(){
      el.classList.remove('pd-moving');
      el.style.transition = '';
      if (moved && el._mv){
        var k = keyOf(el);
        overrides[k] = overrides[k] || {};
        overrides[k].move = el._mv;
        el.classList.add('pd-moved');
        /* חסימת dblclick-איפוס בטעות מיד אחרי גרירה אמיתית */
        handle._afterDrag = true;
        setTimeout(function(){ handle._afterDrag = false; }, 400);
        flush();
      }
    });
  }
  function resetMove(el){
    var k = keyOf(el);
    if (overrides[k]) { delete overrides[k].move; }
    el.style.transform = '';
    el.classList.remove('pd-moved');
    el._mv = null;
    flush();
    setStatus('המיקום אופס', true);
  }

  function onTextInput(e){
    var el = e.currentTarget;
    var k = keyOf(el);
    overrides[k] = overrides[k] || {};
    overrides[k].html = el.innerHTML;
    markDirty();
  }
  function onBlur(){ if (dirty) flush(); }

  /* ---------- סרגל עיצוב טקסט ---------- */
  var activeEditable = null;
  var savedRange = null;
  /* שמירת טווח הבחירה — לפני שלחיצה על select/color-picker גוזלת את המיקוד */
  function saveSel(){
    var sel = window.getSelection();
    if (sel && sel.rangeCount){
      var r = sel.getRangeAt(0);
      if (activeEditable && activeEditable.contains(r.commonAncestorContainer)){
        savedRange = r.cloneRange();
      }
    }
  }
  /* החזרת הבחירה לפני הפעלת פקודת עיצוב */
  function restoreSel(){
    if (!activeEditable) return false;
    activeEditable.focus();
    if (savedRange){
      var sel = window.getSelection();
      sel.removeAllRanges();
      try { sel.addRange(savedRange); return true; } catch(e){ return false; }
    }
    return false;
  }
  function onSelect(e){
    activeEditable = e.currentTarget;
    saveSel();
    refreshFmtState();
    refreshActiveBlockBg();
  }
  function refreshFmtState(){
    ['bold','italic','underline'].forEach(function(c){
      var b = document.querySelector('#fmtToolbar [data-cmd="'+c+'"]');
      if (b){ try { b.classList.toggle('on', document.queryCommandState(c)); } catch(e){} }
    });
  }
  function hideFmt(){ /* הסרגל קבוע — אין צורך להסתיר */ }
  function markDirtyFromActive(){
    if (activeEditable){
      var k = keyOf(activeEditable);
      overrides[k] = overrides[k] || {};
      overrides[k].html = activeEditable.innerHTML;
      markDirty();
    }
  }

  /* === Helper: אוסף text nodes מהטווח בצורה אמינה === */
  function getTextNodesInRange(range) {
    const nodes = [];
    var __root = range.commonAncestorContainer;
    /* בחירה בתוך text-node יחיד — ה-TreeWalker לעולם לא מחזיר את שורש העץ עצמו,
       לכן מחזירים אותו ישירות (אחרת אין צמתים והעיצוב לא חל). */
    if (__root.nodeType === 3) return [__root];
    const walker = document.createTreeWalker(
      __root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
                 range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  /* === עיצוב טקסט יציב (Range + עטיפת text nodes) === */
  function applyInlineStyle(styles) {
    if (!activeEditable) return;
    restoreSel();                       /* החזרת הבחירה שאבדה בלחיצה על הסרגל */
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    try {
      /* פיצול ה-text nodes בקצוות הבחירה — כדי שנעטוף רק את מה שסומן,
         גם כשהבחירה מתחילה/נגמרת באמצע מילה או חוצה <strong> וכד'. */
      if (range.startContainer.nodeType === 3 &&
          range.startOffset > 0 && range.startOffset < range.startContainer.length) {
        var tail = range.startContainer.splitText(range.startOffset);
        range.setStart(tail, 0);
      }
      if (range.endContainer.nodeType === 3 &&
          range.endOffset > 0 && range.endOffset < range.endContainer.length) {
        range.endContainer.splitText(range.endOffset);
        range.setEnd(range.endContainer, range.endContainer.length);
      }

      var textNodes = getTextNodesInRange(range);
      if (textNodes.length === 0) return;

      /* עוטפים כל text-node שבטווח ב-span מעוצב (השיטה שעבדה ב-v42) */
      var spans = [];
      textNodes.forEach(function(tn){
        var span = document.createElement('span');
        if (styles.fontFamily) span.style.fontFamily = styles.fontFamily;
        if (styles.fontSize)   span.style.fontSize   = styles.fontSize;
        if (styles.color)      span.style.color      = styles.color;
        var copy = document.createTextNode(tn.nodeValue);
        span.appendChild(copy);
        tn.parentNode.replaceChild(span, tn);
        spans.push(span);
      });

      /* בחירה מחדש של הקטע שעוצב */
      sel.removeAllRanges();
      var nr = document.createRange();
      nr.setStartBefore(spans[0]);
      nr.setEndAfter(spans[spans.length - 1]);
      sel.addRange(nr);
      savedRange = nr.cloneRange();

      markDirtyFromActive();
      if (activeEditable.closest('.custom-block')) markBlocksDirty();
    } catch (e) {
      /* נפילה-לאחור בטוחה */
      if (styles.fontFamily) document.execCommand('fontName', false, styles.fontFamily);
      if (styles.color)      document.execCommand('foreColor', false, styles.color);
      markDirtyFromActive();
    }
  }

  function applyBulletStyle() {
    const val = this.value || 'disc';
    if (!activeEditable) return;
    restoreSel();
    document.execCommand('insertUnorderedList', false, null);

    // נותנים יותר זמן + חיפוש אגרסיבי
    setTimeout(() => {
      const sel = window.getSelection();
      let list = null;

      const tryFind = () => {
        if (sel && sel.anchorNode) {
          list = sel.anchorNode.closest ? sel.anchorNode.closest('ul') : null;
          if (list) return true;
        }
        if (sel && sel.focusNode) {
          let n = sel.focusNode;
          while (n && n !== document.body) {
            if (n.tagName === 'UL') { list = n; return true; }
            n = n.parentNode;
          }
        }
        // חיפוש דרך li
        const li = sel && sel.anchorNode && sel.anchorNode.closest ? sel.anchorNode.closest('li') : null;
        if (li && li.parentElement && li.parentElement.tagName === 'UL') {
          list = li.parentElement;
          return true;
        }
        return false;
      };

      if (!tryFind()) {
        // ניסיון שני אחרי עוד זמן
        setTimeout(() => {
          if (tryFind() && list) applyListStyle(list, val, true);
        }, 120);
        return;
      }

      if (list) applyListStyle(list, val, true);
    }, 70);
  }

  function applyNumberStyle() {
    const val = this.value || 'decimal';
    if (!activeEditable) return;
    restoreSel();
    document.execCommand('insertOrderedList', false, null);

    setTimeout(() => {
      const sel = window.getSelection();
      let list = null;

      const tryFind = () => {
        if (sel && sel.anchorNode) {
          list = sel.anchorNode.closest ? sel.anchorNode.closest('ol') : null;
          if (list) return true;
        }
        if (sel && sel.focusNode) {
          let n = sel.focusNode;
          while (n && n !== document.body) {
            if (n.tagName === 'OL') { list = n; return true; }
            n = n.parentNode;
          }
        }
        const li = sel && sel.anchorNode && sel.anchorNode.closest ? sel.anchorNode.closest('li') : null;
        if (li && li.parentElement && li.parentElement.tagName === 'OL') {
          list = li.parentElement;
          return true;
        }
        return false;
      };

      if (!tryFind()) {
        setTimeout(() => {
          if (tryFind() && list) applyListStyle(list, val, false);
        }, 120);
        return;
      }
      if (list) applyListStyle(list, val, false);
    }, 70);
  }

  function applyListStyle(listElement, value, isBullet) {
    if (!listElement) return;

    if (isBullet) {
      const custom = ['check', 'star', 'arrow'];
      if (custom.includes(value)) {
        listElement.style.listStyleType = 'none';
        listElement.setAttribute('data-bullet', value);
      } else {
        listElement.style.listStyleType = value || 'disc';
        listElement.removeAttribute('data-bullet');
      }
    } else {
      const map = {
        'hebrew': 'hebrew',
        'decimal': 'decimal',
        'upper-roman': 'upper-roman',
        'lower-roman': 'lower-roman'
      };
      listElement.style.listStyleType = map[value] || 'decimal';
    }

    markDirtyFromActive();

    if (activeEditable && activeEditable.closest('.custom-block')) {
      markBlocksDirty();
    }
  }

  function applyTextBoxBg() {
    if (!activeEditable) return;

    // מוצא את תיבת הטקסט הכי קרובה (גם אם findBlock יכשל)
    const txt = activeEditable.closest('.cb-text');
    if (!txt) return;

    const block = activeEditable.closest('.custom-block');
    if (!block) return;

    const c = document.querySelector('#fmtToolbar [data-bgcolor]');
    const o = document.querySelector('#fmtToolbar [data-bgopacity]');

    const color = c ? c.value : '#ffffff';
    const alpha = o ? parseFloat(o.value || 100) / 100 : 1;

    // עדכון חזותי מידי
    let r = 255, g = 255, b = 255;
    if (color && color[0] === '#') {
      r = parseInt(color.slice(1, 3), 16) || 255;
      g = parseInt(color.slice(3, 5), 16) || 255;
      b = parseInt(color.slice(5, 7), 16) || 255;
    }
    txt.style.backgroundColor = `rgba(${r},${g},${b},${alpha})`;

    // ניסיון לשמור בנתוני הבלוק
    const pid = (block.closest('[data-addzone]') || {}).dataset ? block.closest('[data-addzone]').dataset.addzone : (block.closest('.page') || {}).id;
    const id = block.dataset.blockId;
    const rec = findBlock(pid, id) || findBlock(anchoredKey(pid), id);
    if (rec) {
      rec.b.bgColor = color;
      rec.b.bgOpacity = alpha;
      markBlocksDirty();
    } else {
      // לפחות נסמן dirty על האלמנט כדי שלקראת שמירה יילכד
      markDirtyFromActive();
    }
  }

  function showTextBoxBgControls(show){
    var ctl = document.querySelector('#fmtToolbar .bg-controls');
    if (ctl) ctl.style.display = show ? 'flex' : 'none';
  }

  function refreshActiveBlockBg(){
    if (!activeEditable) return showTextBoxBgControls(false);
    var block = activeEditable.closest('.custom-block');
    showTextBoxBgControls(!!block);
    if (!block) return;
    var txt = block.querySelector('.cb-text');
    var c = document.querySelector('#fmtToolbar [data-bgcolor]');
    var o = document.querySelector('#fmtToolbar [data-bgopacity]');
    var pid = (block.closest('[data-addzone]') || {}).dataset ? block.closest('[data-addzone]').dataset.addzone : (block.closest('.page')||{}).id;
    var id = block.dataset.blockId;
    var rec = findBlock(pid, id) || findBlock(anchoredKey(pid), id);
    if (rec && rec.b) {
      if (c) c.value = rec.b.bgColor || '#ffffff';
      if (o) o.value = Math.round((rec.b.bgOpacity != null ? rec.b.bgOpacity : 1) * 100);
      if (txt && rec.b.bgColor) {
        var alpha = (rec.b.bgOpacity != null ? rec.b.bgOpacity : 1);
        var hex = rec.b.bgColor;
        var r = parseInt(hex.slice(1,3),16);
        var g = parseInt(hex.slice(3,5),16);
        var bb= parseInt(hex.slice(5,7),16);
        txt.style.backgroundColor = 'rgba('+r+','+g+','+bb+','+alpha+')';
      }
    }
  }

  /* ---------- החלפת תמונות / רקעים ---------- */
  var imgTarget = null;
  var blockImgTarget = null;   /* { pid, id, el } — תמונה בתוך בלוק מותאם */
  var heroPickTarget = null;   /* page-head / hero-layer.sky — תמונת רקע ראשית */
  function onImgClick(e){
    e.preventDefault(); e.stopPropagation();
    blockImgTarget = null;
    imgTarget = e.currentTarget;
    document.getElementById('admImgInput').click();
  }
  function initImgInput(){
    var fi = document.getElementById('admImgInput');
    /* כיווץ תמונה גדולה לפני שמירה — localStorage מוגבל (~5MB), ושתי תמונות
       מצלמה כ-base64 חורגות ממנו: הראשונה נשמרת והשנייה נכשלת בשקט.
       מקטינים לצלע מקסימלית 1600px ו-JPEG 85%. */
    function shrinkImage(data, cb){
      var im = new Image();
      im.onload = function(){
        var MAX = 1600;
        var w = im.naturalWidth, h = im.naturalHeight;
        var sc = Math.min(1, MAX / Math.max(w, h));
        try {
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * sc));
          c.height = Math.max(1, Math.round(h * sc));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          cb(c.toDataURL('image/jpeg', 0.85));
        } catch(e){ cb(data); }
      };
      im.onerror = function(){ cb(data); };
      im.src = data;
    }
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        var raw = reader.result;
        /* GIF נשאר כמו שהוא (אנימציה); קבצים קטנים לא נוגעים בהם */
        if (f.size > 300 * 1024 && f.type !== 'image/gif'){ shrinkImage(raw, applyData); }
        else applyData(raw);
      };
      function applyData(data){
        /* תמונת רקע ראשית (page-head / hero) */
        if (heroPickTarget){
          var hk = keyOf(heroPickTarget);
          overrides[hk] = overrides[hk] || {};
          overrides[hk].bg = data;
          heroPickTarget.style.backgroundImage = 'url("'+data+'")';
          heroPickTarget.style.backgroundSize = 'cover';
          heroPickTarget.style.backgroundPosition = 'center';
          heroPickTarget.classList.add('has-custom-bg');
          flush(); setStatus('תמונת הרקע הוחלפה', true);
          heroPickTarget = null; fi.value=''; return;
        }
        /* תמונה בתוך בלוק מותאם — כולל בלוק מעוגן בין אלמנטים קיימים */
        if (blockImgTarget){
          var rec = findBlock(blockImgTarget.pid, blockImgTarget.id) ||
                    findBlock(anchoredKey(blockImgTarget.pid), blockImgTarget.id);
          if (rec){
            var field = blockImgTarget.field || 'img';
            rec.b[field] = data;
            if (blockImgTarget.el) blockImgTarget.el.src = data;
            saveBlocks(); setStatus('התמונה הוחלפה', true);
          } else {
            setStatus('שגיאה: הבלוק לא נמצא', false);
          }
          blockImgTarget = null; fi.value=''; return;
        }
        if (!imgTarget) { fi.value=''; return; }
        var k = keyOf(imgTarget);
        overrides[k] = overrides[k] || {};
        if (imgTarget.tagName === 'IMG'){ imgTarget.src = data; overrides[k].src = data; }
        else {
          imgTarget.style.backgroundImage = 'url("'+data+'")';
          imgTarget.style.backgroundSize = 'cover';
          imgTarget.style.backgroundPosition = 'center';
          imgTarget.classList.add('has-custom-bg');
          overrides[k].bg = data;
        }
        flush(); setStatus('התמונה הוחלפה', true);
      };
      reader.readAsDataURL(f);
      fi.value = '';
    });
  }

  /* ---------- שמירה / מצב ---------- */
  var saveTimer = null;
  function markDirty(){
    dirty = true; setStatus('עריכה…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
  }
  function flush(){
    var ok = save(STORE_KEY, overrides);
    dirty = false;
    setStatus(ok ? 'נשמר ✓' : 'שגיאת שמירה (אולי גדול מדי)', ok);
  }
  function setStatus(t, saved){
    var s = document.getElementById('abStatus'); if(!s) return;
    s.textContent = t; s.classList.toggle('saved', !!saved);
  }

  /* ---------- ייצוא / ייבוא / איפוס ---------- */
  function doExport(){
    var payload = { overrides: overrides, theme: theme, blocks: blocks, exportedAt: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pricat-derech-content.json';
    a.click();
    setStatus('יוצא קובץ ✓', true);
  }
  function doImport(){
    var fi = el('input'); fi.type='file'; fi.accept='application/json,.json';
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if(!f) return;
      var r = new FileReader();
      r.onload = function(){
        try{
          var d = JSON.parse(r.result);
          if (d.overrides) overrides = d.overrides;
          if (d.theme) theme = d.theme;
          if (d.blocks) blocks = d.blocks;
          save(STORE_KEY, overrides); save(THEME_KEY, theme); save(BLOCKS_KEY, blocks);
          setStatus('יובא ✓ טוען מחדש…', true);
          setTimeout(function(){ location.reload(); }, 500);
        }catch(e){ alert('קובץ לא תקין'); }
      };
      r.readAsText(f);
    });
    fi.click();
  }
  function doReset(){
    showModal(
      '<h3>איפוס כל השינויים</h3><p>הפעולה תמחק את כל העריכות (טקסט, תמונות, צבעים ובלוקים שנוספו) ותחזיר את האתר למקור. לא ניתן לבטל.</p>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button>' +
      '<button class="admin-btn danger" id="resetGo">מחק הכול</button></div>',
      function(box){
        box.querySelector('#resetGo').addEventListener('click', function(){
          localStorage.removeItem(STORE_KEY); localStorage.removeItem(THEME_KEY); localStorage.removeItem(BLOCKS_KEY);
          hideModal(); location.reload();
        });
      }
    );
  }
  function changePass(){
    showModal(
      '<h3>שינוי סיסמת אדמין</h3><p>בחרו סיסמה חדשה לכניסה למצב עריכה (נשמרת בדפדפן זה).</p>' +
      '<input type="password" id="newPass" placeholder="סיסמה חדשה" />' +
      '<input type="password" id="newPass2" placeholder="הקלידו שוב לאימות" />' +
      '<div class="am-err" id="passErr"></div>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button>' +
      '<button class="admin-btn primary" id="passGo">שמירה</button></div>',
      function(box){
        var p1 = box.querySelector('#newPass'), p2 = box.querySelector('#newPass2');
        var err = box.querySelector('#passErr');
        p1.focus();
        function go(){
          var v = p1.value.trim(), v2 = p2.value.trim();
          if (v.length < 4){ err.textContent = 'הסיסמה קצרה מדי (לפחות 4 תווים)'; p1.focus(); return; }
          if (v !== v2){ err.textContent = 'הסיסמאות אינן תואמות — נסו שוב'; p2.value=''; p2.focus(); return; }
          localStorage.setItem(PASS_KEY, v); hideModal(); setStatus('הסיסמה עודכנה ✓', true);
        }
        box.querySelector('#passGo').addEventListener('click', go);
        p2.addEventListener('keydown', function(e){ if(e.key==='Enter') go(); });
        p1.addEventListener('keydown', function(e){ if(e.key==='Enter') p2.focus(); });
      }
    );
  }

  function toggleTheme(){ document.getElementById('themePanel').classList.toggle('show'); }

  /* רשת עזר למיקום מדויק — אופציונלית, לא נשמרת */
  /* רשת עזר — לחיצות מחזוריות: כחול → שחור → בז' → כבוי */
  var gridStates = ['', 'g-black', 'g-beige', 'off'];
  var gridLabels = ['▦ רשת: כחול', '▦ רשת: שחור', "▦ רשת: בז'", '▦ רשת עזר'];
  var gridIdx = -1;
  function toggleGrid(btn){
    gridIdx = (gridIdx + 1) % gridStates.length;
    var state = gridStates[gridIdx];
    var g = document.getElementById('pdGrid');
    if (state === 'off'){
      if (g) g.remove();
      if (btn){ btn.classList.remove('on'); btn.textContent = gridLabels[3]; }
      return;
    }
    if (!g){ g = el('div'); g.id = 'pdGrid'; document.body.appendChild(g); }
    g.className = state;     /* '' = כחול ברירת מחדל */
    if (btn){ btn.classList.add('on'); btn.textContent = gridLabels[gridIdx]; }
  }

  /* ===================================================================
     בלוקים מותאמים אישית — הוספת שדות טקסט/תמונה חדשים
     =================================================================== */
  function uid(){ return 'b' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36); }
  function saveBlocks(){ var ok = save(BLOCKS_KEY, blocks); setStatus(ok?'נשמר ✓':'שגיאת שמירה', ok); }

  /* יצירת אזור-תוספות בראש התוכן של כל פרק (פעם אחת) */
  function ensureAddZones(){
    document.querySelectorAll('.page').forEach(function(page){
      if (page.querySelector(':scope > .admin-blocks')) return;
      var zone = el('div', 'container admin-blocks');
      zone.setAttribute('data-addzone', page.id);
      /* ממקמים מיד אחרי כותרת הפרק (page-head) או אחרי ה-hero — בראש התוכן */
      var anchor = page.querySelector(':scope > .page-head') || page.querySelector(':scope > .hero');
      if (anchor && anchor.nextSibling) page.insertBefore(zone, anchor.nextSibling);
      else if (anchor) page.appendChild(zone);
      else page.insertBefore(zone, page.firstChild);
    });
  }

  /* רינדור כל הבלוקים השמורים */
  function renderBlocks(){
    if (pdDragging) return;   /* לא מחליפים את ה-DOM באמצע גרירה */
    ensureAddZones();
    /* הסרת בלוקים צפים קודמים */
    document.querySelectorAll('.custom-block.cb-free').forEach(function(n){ n.remove(); });
    document.querySelectorAll('.admin-blocks').forEach(function(zone){
      var pid = zone.getAttribute('data-addzone');
      var list = blocks[pid] || [];
      zone.innerHTML = '';
      if (adminOn) zone.appendChild(makeInsertZone(pid, 0));   /* מפריד בראש */
      list.forEach(function(b, i){
        try {
          var node = renderBlock(b, pid, i, list.length);
          if (b.free){
            var page = document.getElementById(pid);
            if (page){ applyFreePos(node, b); page.appendChild(node); }
            else zone.appendChild(node);
          } else {
            zone.appendChild(node);
            if (adminOn) zone.appendChild(makeInsertZone(pid, i + 1));  /* מפריד אחרי כל בלוק */
          }
        } catch(err){
          window.dispatchEvent(new ErrorEvent('error',{message:'renderBlock '+(b&&b.type)+': '+err.message, filename:'admin.js', lineno:0, colno:0}));
        }
      });
    });
  }

  /* מפריד הוספה — קו עם כפתור ＋ להוספת בלוק במיקום מדויק */
  function makeInsertZone(pid, index){
    var z = el('div', 'cb-insert');
    var btn = el('button', 'cb-insert-btn', '＋ הוסף כאן');
    btn.type = 'button';
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      chooseTypeAt(pid, index);
    });
    z.appendChild(btn);
    return z;
  }

  /* ---------- מפרידי ＋ בין האלמנטים הקיימים של האתר ---------- */
  /* בלוקים שמעוגנים "אחרי אלמנט קיים" נשמרים תחת b.after = keyOf(el) */
  function injectInlineInserts(showPlus){
    /* ניקוי קודמים */
    document.querySelectorAll('.cb-inline-host').forEach(function(n){ n.remove(); });
    document.querySelectorAll('.cb-anchored').forEach(function(n){ n.remove(); });

    document.querySelectorAll('.page').forEach(function(page){
      var pid = page.id;
      INSERT_AFTER_SELECTORS.forEach(function(sel){
        page.querySelectorAll(sel).forEach(function(elm){
          /* לא בתוך בלוק מותאם וגם לא בתוך page-head/hero */
          if (elm.closest('.custom-block')) return;
          if (elm.closest('.page-head') || elm.closest('.hero')) return;
          var key = keyOf(elm);
          /* רנדר בלוקים שכבר עוגנו אחרי האלמנט הזה (תמיד, גם למבקר) */
          renderAnchoredAfter(pid, key, elm);
          /* מפריד ＋ — רק במצב אדמין */
          if (showPlus){
            var host = el('div','cb-inline-host');
            var btn = el('button','cb-insert-btn cb-inline-btn','＋ הוסף כאן');
            btn.type = 'button';
            btn.addEventListener('click', function(e){
              e.preventDefault(); e.stopPropagation();
              chooseAnchoredAt(pid, key, elm);
            });
            host.appendChild(btn);
            elm.parentNode.insertBefore(host, elm.nextSibling);
          }
        });
      });
    });
  }

  function anchoredKey(pid){ return 'anchored::' + pid; }
  function renderAnchoredAfter(pid, key, elm){
    var list = (blocks[anchoredKey(pid)] || []).filter(function(b){ return b.after === key; });
    /* מרנדרים בסדר הפוך כי כל אחד מוכנס מיד אחרי elm */
    for (var i = list.length - 1; i >= 0; i--){
      (function(b){
        var node = renderBlock(b, anchoredKey(pid), 0, 1);
        node.classList.add('cb-anchored');
        elm.parentNode.insertBefore(node, elm.nextSibling);
      })(list[i]);
    }
  }
  function chooseAnchoredAt(pid, key, elm){
    var TYPES = [
      {t:'text',i:'¶',l:'טקסט'},{t:'image',i:'🖼',l:'תמונה'},
      {t:'text-side',i:'⊟',l:'טקסט בצד'},{t:'text-below',i:'⊏',l:'טקסט למטה'},
      {t:'text-over',i:'▦',l:'טקסט על תמונה'},{t:'before-after',i:'⇄',l:'לפני/אחרי'},
      {t:'spacer',i:'↕',l:'מרווח ריק'}
    ];
    var btns = TYPES.map(function(o){
      return '<button class="ct-opt" data-t="'+o.t+'"><span>'+o.i+'</span>'+o.l+'</button>';
    }).join('');
    showModal('<h3>הוספת תוכן כאן</h3><p>הבלוק יתווסף מתחת לאלמנט הזה.</p>' +
      '<div class="ct-grid">'+btns+'</div>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button></div>',
      function(box){
        box.querySelectorAll('.ct-opt').forEach(function(btn){
          btn.addEventListener('click', function(){
            hideModal();
            addAnchoredBlock(pid, key, btn.dataset.t);
          });
        });
      });
  }
  function addAnchoredBlock(pid, key, type){
    var ak = anchoredKey(pid);
    blocks[ak] = blocks[ak] || [];
    var nb = { id: uid(), type: type || 'text', html:'', img:'', caption:'', after: key };
    blocks[ak].push(nb);
    saveBlocks();
    injectInlineInserts(true);   /* רינדור מחדש של המעוגנים */
    setTimeout(function(){
      var node = document.querySelector('[data-block-id="'+nb.id+'"]');
      if (node){
        node.scrollIntoView({behavior:'smooth', block:'center'});
        node.classList.add('cb-flash');
        setTimeout(function(){ node.classList.remove('cb-flash'); }, 1400);
      }
    }, 60);
    setStatus('בלוק נוסף מתחת לאלמנט', true);
  }

  /* רקע הבוקסה בשקיפות שבחר המשתמש (b.boxOpacity 0–100, b.boxBg צבע).
     ההגדרה האינליינית גוברת על רקע ברירת-המחדל של בלוק צף (לבן 92%). */
  function applyBoxBg(node, b){
    if (b.boxOpacity == null) return;
    var hex = b.boxBg || '#ffffff';
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), bl = parseInt(hex.slice(5,7),16);
    var a = Math.max(0, Math.min(100, b.boxOpacity)) / 100;
    node.style.background = 'rgba('+r+','+g+','+bl+','+a+')';
    node.style.backdropFilter = 'none';
    node.style.webkitBackdropFilter = 'none';
    node.style.boxShadow = (a <= 0.05) ? 'none' : '';
  }

  function applyFreePos(node, b){
    node.classList.add('cb-free');
    node.style.position = 'absolute';
    node.style.left = (b.x != null ? b.x : 50) + '%';   /* left רגיל — לא RTL-aware, כדי שלא יתהפך */
    node.style.right = 'auto';
    node.style.top = (b.y != null ? b.y : 18) + '%';
    node.style.width = (b.w ? b.w + 'px' : 'min(420px,80vw)');
    node.style.zIndex = 30;
  }

  function renderBlock(b, pid, idx, total){
    var wrap = el('div','custom-block');
    wrap.setAttribute('data-block-id', b.id);
    if (!b.type) b.type = 'text-image';
    wrap.setAttribute('data-type', b.type);
    if (!b.free && b.w) wrap.style.maxWidth = b.w + 'px';
    var textHTML = b.html || '<h3>כותרת חדשה</h3><p>כאן אפשר לכתוב טקסט חופשי…</p>';
    var imgSrc  = b.img || IMG_PLACEHOLDER;
    /* שקיפות תמונה שמורה */
    var op = (b.imgOpacity != null ? b.imgOpacity : 1);
    var opStyle = 'opacity:' + op + ';';
    var hStyle = b.h ? 'height:'+b.h+'px;' : '';
    var imgStyleAttr = ' style="'+opStyle+hStyle+'"';
    var bgStyle = '';
    if (b.bgColor) {
      var alpha = (b.bgOpacity != null ? b.bgOpacity : 1);
      var hex = b.bgColor.replace('#','');
      var r = parseInt(hex.substring(0,2),16);
      var g = parseInt(hex.substring(2,4),16);
      var bb = parseInt(hex.substring(4,6),16);
      bgStyle = ' style="background-color:rgba('+r+','+g+','+bb+','+alpha+')"';
    }
    var T = '<div class="cb-text"'+bgStyle+'>'+textHTML+'</div>';
    var inner = '';

    if (b.type === 'spacer'){
      var sh = b.h ? b.h : 60;
      inner = '<div class="cb-spacer" style="height:'+sh+'px"><span class="cb-spacer-lbl">מרווח · '+sh+'px</span></div>';
    } else if (b.type === 'text'){
      inner = T;
    } else if (b.type === 'image'){
      var figCls = 'cb-figure' + (b.frameless?' cb-frameless':'') + (b.feather?' cb-feather-'+b.feather:'');
      var rotStyle = b.rotate ? 'transform:rotate('+b.rotate+'deg);' : '';
      inner = '<figure class="'+figCls+'"><img class="cb-img" style="'+opStyle+hStyle+rotStyle+'" src="'+imgSrc+'" alt="" /></figure>';
      if (adminOn) inner += '<div class="cb-imgfx">' +
        '<button type="button" class="cb-imgfx-btn'+(b.frameless?' on':'')+'" data-frameless>⬚ ללא מסגרת</button>' +
        '<label class="cb-imgfx-feather">ריכוך שוליים<input type="range" class="cb-feather-range" min="0" max="5" step="1" value="'+(b.feather||0)+'"></label>' +
        '<label class="cb-imgfx-feather">סיבוב<input type="range" class="cb-rotate-range" min="-180" max="180" step="1" value="'+(b.rotate||0)+'"></label>' +
        '<button type="button" class="cb-imgfx-btn" data-rotate90>↻ 90°</button>' +
        '</div>';
    } else if (b.type === 'text-side'){
      /* טקסט בצד התמונה */
      inner = '<div class="cb-split"><div class="cb-col">'+T+'</div>' +
              '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure></div>';
    } else if (b.type === 'text-below'){
      /* תמונה למעלה, טקסט מתחת (ממורכז) */
      inner = '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure>' +
              '<div class="cb-text cb-center"'+bgStyle+'>'+textHTML+'</div>';
    } else if (b.type === 'text-over'){
      /* טקסט מעל התמונה */
      inner = '<div class="cb-over">' +
                '<img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' />' +
                '<div class="cb-over-text"><div class="cb-text"'+bgStyle+'>'+textHTML+'</div></div>' +
              '</div>';
    } else if (b.type === 'before-after'){
      /* השוואת לפני/אחרי עם וילון נגרר */
      var imgA = b.imgA || IMG_PLACEHOLDER;   /* אחרי (תמונת בסיס, מתחת) */
      var imgB = b.imgB || IMG_PLACEHOLDER;   /* לפני (נחשפת ע"י הווילון) */
      var labA = b.labelA || 'אחרי';
      var labB = b.labelB || 'לפני';
      var pos  = (b.split != null ? b.split : 50);
      var hPx  = b.h ? b.h : 380;
      var titleHTML = b.html || '<h3>לפני ואחרי</h3>';
      inner = (b.noTitle ? '' : '<div class="cb-text cb-center cb-ba-title">'+titleHTML+'</div>') +
        '<div class="cb-ba'+(b.frameless ? ' cb-ba-frameless' : '')+'" style="height:'+hPx+'px">' +
          '<img class="cb-ba-img cb-ba-after" data-baimg="A" src="'+imgA+'" alt="" />' +
          '<img class="cb-ba-img cb-ba-before" data-baimg="B" src="'+imgB+'" alt="" style="clip-path:inset(0 '+(100-pos)+'% 0 0)" />' +
          '<span class="cb-ba-lab cb-ba-lab-b">'+labB+'</span>' +
          '<span class="cb-ba-lab cb-ba-lab-a">'+labA+'</span>' +
          '<div class="cb-ba-handle" style="left:'+pos+'%"><span>⇄</span></div>' +
        '</div>';
    } else { /* text-image (ברירת מחדל = טקסט בצד) */
      b.type = 'text-side';
      wrap.setAttribute('data-type','text-side');
      inner = '<div class="cb-split"><div class="cb-col">'+T+'</div>' +
              '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure></div>';
    }
    wrap.innerHTML = '<div class="cb-inner">'+inner+'</div>';
    applyBoxBg(wrap, b);   /* שקיפות רקע הבוקסה — חל גם למבקר */
    /* מחוון שקיפות רקע — בכל בוקסה עם טקסט (לא תמונה/מרווח) */
    if (adminOn && b.type !== 'image' && b.type !== 'spacer'){
      var bgfx = el('div','cb-imgfx');
      var bgv = (b.boxOpacity != null ? b.boxOpacity : (b.free ? 92 : 0));
      bgfx.innerHTML = '<label class="cb-imgfx-feather">שקיפות רקע ' +
        '<input type="range" class="cb-bgop-range" min="0" max="100" step="5" value="'+bgv+'">' +
        '<span class="cb-bgop-val">'+bgv+'%</span></label>';
      if (b.type === 'before-after'){
        bgfx.insertAdjacentHTML('afterbegin',
          '<button type="button" class="cb-imgfx-btn'+(b.noTitle?' on':'')+'" data-ba-notitle>🚫 ללא כותרת</button>' +
          '<button type="button" class="cb-imgfx-btn'+(b.frameless?' on':'')+'" data-ba-frameless>⬚ ללא מסגרת</button>');
      }
      wrap.appendChild(bgfx);
    }
    try { if (b.type === 'before-after') wireBeforeAfter(wrap, b); }   /* וילון — פעיל גם למבקר */
    catch(e){ window.dispatchEvent(new ErrorEvent('error',{message:'wireBeforeAfter: '+e.message,filename:'admin.js'})); }
    if (adminOn){
      try { addBlockControls(wrap, b, pid, idx, total); }
      catch(e){ window.dispatchEvent(new ErrorEvent('error',{message:'addBlockControls: '+e.message,filename:'admin.js'})); }
    }
    return wrap;
  }

  /* ---------- וילון "לפני/אחרי" ---------- */
  function wireBeforeAfter(wrap, b){
    var ba = wrap.querySelector('.cb-ba'); if (!ba) return;
    var beforeImg = ba.querySelector('.cb-ba-before');
    var handle = ba.querySelector('.cb-ba-handle');
    function setSplit(pct){
      pct = Math.max(0, Math.min(100, pct));
      b.split = pct;
      beforeImg.style.clipPath = 'inset(0 ' + (100-pct) + '% 0 0)';
      handle.style.left = pct + '%';
    }
    function startDrag(e){
      e.preventDefault();
      var rect = ba.getBoundingClientRect();
      function move(ev){
        var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
        setSplit(((cx - rect.left) / rect.width) * 100);
      }
      function end(){
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        if (adminOn) { clearTimeout(wrap._st); wrap._st = setTimeout(saveBlocks, 300); }
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
    }
    handle.addEventListener('pointerdown', startDrag);
    /* קליק על הפס מזיז ישירות */
    ba.addEventListener('pointerdown', function(e){
      if (e.target.closest('.cb-ba-handle')) return;
      if (e.target.closest('.cb-ba-img') && adminOn) return; /* באדמין: קליק על תמונה = העלאה */
      var rect = ba.getBoundingClientRect();
      setSplit(((e.clientX - rect.left) / rect.width) * 100);
      startDrag(e);
    });
  }

  function addBlockControls(wrap, b, pid, idx, total){
    wrap.classList.add('cb-editing');

    /* סרגל כלים עליון: ידית-גרירה · בורר סוג · עיגון · מחיקה */
    var TYPES = [
      {t:'text',       i:'¶',  l:'טקסט'},
      {t:'image',      i:'🖼', l:'תמונה'},
      {t:'text-side',  i:'⊟',  l:'טקסט בצד'},
      {t:'text-below', i:'⊏',  l:'טקסט למטה'},
      {t:'text-over',  i:'▦',  l:'טקסט על התמונה'},
      {t:'before-after', i:'⇄', l:'לפני / אחרי'}
    ];
    var typeBtns = TYPES.map(function(o){
      return '<button class="cb-tbtn'+(b.type===o.t?' on':'')+'" data-type="'+o.t+'" title="'+o.l+'">'+o.i+'</button>';
    }).join('');
    var hasImg = (b.type !== 'text');
    var opVal = (b.imgOpacity != null ? b.imgOpacity : 1);
    var opCtl = hasImg ?
      '<span class="cb-op" title="שקיפות התמונה">🌫' +
        '<input type="range" class="cb-op-range" min="0" max="100" value="'+Math.round(opVal*100)+'" />' +
      '</span>' : '';
    /* בלוק לפני/אחרי — שני כפתורי העלאה מפורשים */
    var baCtl = (b.type === 'before-after') ?
      '<button class="cb-ctl" data-baup="imgB" title="העלאת התמונה הראשונה">📷 לפני</button>' +
      '<button class="cb-ctl" data-baup="imgA" title="העלאת התמונה השנייה">📷 אחרי</button>' : '';
    var bar = el('div','cb-bar');
    bar.innerHTML =
      '<button class="cb-ctl cb-drag" data-drag title="גררו כדי להזיז">✥ הזז</button>' +
      '<span class="cb-types-inline">' + typeBtns + '</span>' +
      baCtl + opCtl +
      '<span class="cb-bar-sp"></span>' +
      (b.free ? '<button class="cb-ctl" data-anchor title="החזר לזרימת העמוד">📌 עגן</button>' : '') +
      '<button class="cb-ctl danger" data-del title="מחיקת הבלוק">🗑 מחק</button>';
    wrap.appendChild(bar);

    /* כפתור X צף פשוט ומדויק לסגירה מהירה של החלל (כמו בתמונה) */
    var closeBtn = el('button', 'cb-close', '✕');
    closeBtn.title = 'סגור חלל';
    wrap.appendChild(closeBtn);

    closeBtn.addEventListener('click', function(e){
      e.stopPropagation();
      if (closeBtn.classList.contains('cb-armed')){
        closeBtn.classList.remove('cb-armed');
        // הסרה נקיה + עדכון נתונים
        wrap.style.transition = 'all .18s ease';
        wrap.style.opacity = '0';
        wrap.style.transform = 'scale(.92)';
        setTimeout(function(){
          deleteBlock(pid, b.id);
        }, 160);
      } else {
        closeBtn.classList.add('cb-armed');
        setTimeout(function(){
          if (closeBtn && closeBtn.parentNode) closeBtn.classList.remove('cb-armed');
        }, 1800);
      }
    });
    bar.addEventListener('click', function(e){
      var tb = e.target.closest('[data-type]');
      if (tb){ b.type = tb.dataset.type; saveBlocks(); renderBlocks(); return; }
      if (e.target.closest('[data-anchor]')){ b.free=false; b.x=null; b.y=null; saveBlocks(); renderBlocks(); return; }
    });
    /* כפתורי העלאת תמונה בלפני/אחרי — מאזין ישיר על כל כפתור */
    bar.querySelectorAll('[data-baup]').forEach(function(up){
      up.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        var field = up.dataset.baup;                       /* imgA / imgB */
        var sel = (field === 'imgA') ? '.cb-ba-after' : '.cb-ba-before';
        blockImgTarget = { pid: pid, id: b.id, el: wrap.querySelector(sel), field: field };
        document.getElementById('admImgInput').click();
      };
    });
    /* מחיקה — שלב אזהרה: לחיצה ראשונה מהבהבת, שנייה מוחקת */
    var delBtn = bar.querySelector('[data-del]');
    if (delBtn){
      delBtn.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        if (delBtn.dataset.armed === '1'){
          deleteBlock(pid, b.id);
          return;
        }
        delBtn.dataset.armed = '1';
        delBtn.textContent = '⚠ לחצו שוב למחיקה';
        delBtn.classList.add('cb-arm');
        clearTimeout(delBtn._t);
        delBtn._t = setTimeout(function(){
          delBtn.dataset.armed = '';
          delBtn.textContent = '🗑 מחק';
          delBtn.classList.remove('cb-arm');
        }, 3000);
      };
    }
    /* מחוון שקיפות תמונה — חי, בלי רינדור מחדש */
    var opRange = bar.querySelector('.cb-op-range');
    if (opRange){
      opRange.addEventListener('input', function(){
        b.imgOpacity = (+opRange.value) / 100;
        wrap.querySelectorAll('.cb-img').forEach(function(im){ im.style.opacity = b.imgOpacity; });
        clearTimeout(wrap._ot); wrap._ot = setTimeout(saveBlocks, 400);
      });
      /* לא לגרור את הבלוק כששולטים במחוון */
      opRange.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    }

    /* מרווח ריק — גרירת הקצה התחתון לשינוי גובה */
    var spacer = wrap.querySelector('.cb-spacer');
    if (spacer){
      var grip = document.createElement('div');
      grip.className = 'cb-spacer-grip';
      grip.title = 'גררו לשינוי גובה';
      spacer.appendChild(grip);
      grip.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation();
        var startY = e.clientY;
        var startH = b.h ? b.h : 60;
        function mv(ev){
          var nh = Math.max(10, Math.round(startH + (ev.clientY - startY)));
          b.h = nh;
          spacer.style.height = nh + 'px';
          var lbl = spacer.querySelector('.cb-spacer-lbl');
          if (lbl) lbl.textContent = 'מרווח · ' + nh + 'px';
        }
        function done(){
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', done);
          saveBlocks();
        }
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', done);
      });
    }

    /* גרירה חופשית — מהידית בלבד */
    var handle = bar.querySelector('[data-drag]');
    if (handle) enableDrag(handle, wrap, b, pid);

    /* טקסט נערך */
    wrap.querySelectorAll('.cb-text, .cb-cap').forEach(function(t){
      t.setAttribute('contenteditable','true');
      t.setAttribute('data-editable','');
      t.addEventListener('input', function(){
        if (t.classList.contains('cb-cap')) b.caption = t.textContent;
        else b.html = t.innerHTML;
        markBlocksDirty();
      });
      t.addEventListener('mouseup', onSelect);
      t.addEventListener('keyup', onSelect);
    });

    /* תמונה רגילה ניתנת להחלפה */
    var img = wrap.querySelector('.cb-img');
    if (img){
      img.setAttribute('data-img','');
      img.addEventListener('click', function(e){
        e.preventDefault();
        blockImgTarget = { pid: pid, id: b.id, el: img, field: 'img' };
        document.getElementById('admImgInput').click();
      });
    }
    /* שתי תמונות בבלוק לפני/אחרי */
    wrap.querySelectorAll('.cb-ba-img').forEach(function(bimg){
      bimg.setAttribute('data-img','');
      bimg.style.cursor = 'pointer';
      bimg.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var field = bimg.getAttribute('data-baimg') === 'A' ? 'imgA' : 'imgB';
        blockImgTarget = { pid: pid, id: b.id, el: bimg, field: field };
        document.getElementById('admImgInput').click();
      });
    });
    /* תוויות לפני/אחרי ניתנות לעריכה */
    var labA = wrap.querySelector('.cb-ba-lab-a'), labB = wrap.querySelector('.cb-ba-lab-b');
    if (labA){ labA.setAttribute('contenteditable','true'); labA.addEventListener('input', function(){ b.labelA = labA.textContent; markBlocksDirty(); }); labA.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }
    if (labB){ labB.setAttribute('contenteditable','true'); labB.addEventListener('input', function(){ b.labelB = labB.textContent; markBlocksDirty(); }); labB.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }

    /* שחזור מידות שמורות */
    if (b.boxH) wrap.style.height = b.boxH + 'px';
    /* ידיות שינוי-גודל לכל הכיוונים (8 נקודות) */
    addResizeHandles(wrap, b);
  }

  /* ---------- ידיות שינוי-גודל לכל הכיוונים ---------- */
  function addResizeHandles(wrap, b){
    var dirs = ['n','s','e','w','ne','nw','se','sw'];
    dirs.forEach(function(d){
      var h = el('div', 'cb-rz cb-rz-' + d);
      h.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation();
        var sx = e.clientX, sy = e.clientY;
        var r = wrap.getBoundingClientRect();
        var startW = r.width, startH = r.height;
        var startLeft = wrap.offsetLeft, startTop = wrap.offsetTop;
        var isFree = wrap.classList.contains('cb-free');
        function mv(ev){
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          var nw = startW, nh = startH;
          if (d.indexOf('e') > -1) nw = startW + dx;
          if (d.indexOf('w') > -1) nw = startW - dx;
          if (d.indexOf('s') > -1) nh = startH + dy;
          if (d.indexOf('n') > -1) nh = startH - dy;
          nw = Math.max(200, Math.round(nw));
          nh = Math.max(80, Math.round(nh));
          wrap.style.width = nw + 'px';
          wrap.style.maxWidth = 'none';
          wrap.style.height = nh + 'px';
          b.w = nw; b.boxH = nh;
          /* בלוק צף — תזוזת קצה צפון/מערב גם מזיזה מיקום */
          if (isFree){
            var page = wrap.offsetParent;
            if (page){
              if (d.indexOf('w') > -1){ b.x = ((startLeft + (startW - nw)) / page.offsetWidth) * 100; wrap.style.left = b.x + '%'; }
              if (d.indexOf('n') > -1){ b.y = ((startTop  + (startH - nh)) / page.offsetHeight) * 100; wrap.style.top = b.y + '%'; }
            }
          }
        }
        pdDrag(e, h, mv, function(){ saveBlocks(); });
      });
      wrap.appendChild(h);
    });
  }

  /* ---------- מנגנון גרירה חופשית ---------- */
  function enableDrag(handle, wrap, b, pid){
    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      var page = document.getElementById(pid);
      if (!page) return;

      /* בפעם הראשונה — הופכים לצף וממקמים במיקום הנוכחי */
      if (!b.free){
        var pr0 = page.getBoundingClientRect();
        var wr0 = wrap.getBoundingClientRect();
        b.free = true;
        b.x = ((wr0.left - pr0.left) / pr0.width) * 100;
        b.y = ((wr0.top  - pr0.top ) / pr0.height) * 100;
        b.w = Math.round(wr0.width);
        page.appendChild(wrap);
        applyFreePos(wrap, b);
      }

      wrap.classList.add('cb-dragging');
      wrap.style.transition = 'none';            /* שום אנימציה לא תרכך את התנועה */
      var wr = wrap.getBoundingClientRect();
      var offX = e.clientX - wr.left;
      var offY = e.clientY - wr.top;
      var lastX = wrap.offsetLeft, lastY = wrap.offsetTop;

      pdDrag(e, handle, function(ev){
        /* מיקום בפיקסלים בזמן הגרירה — צמידות מוחלטת לסמן.
           המרה לאחוזים (לשמירה רספונסיבית) רק בשחרור. */
        var pr = page.getBoundingClientRect();
        var x = ev.clientX - pr.left - offX;
        var y = ev.clientY - pr.top  - offY;
        x = Math.max(0, Math.min(x, pr.width  - wr.width));
        y = Math.max(0, Math.min(y, pr.height - wr.height));
        lastX = x; lastY = y;
        wrap.style.left = x + 'px';
        wrap.style.right = 'auto';
        wrap.style.top = y + 'px';
      }, function(){
        var pr = page.getBoundingClientRect();
        b.x = (lastX / pr.width)  * 100;
        b.y = (lastY / pr.height) * 100;
        wrap.style.left = b.x + '%';
        wrap.style.top  = b.y + '%';
        wrap.style.transition = '';
        wrap.classList.remove('cb-dragging');
        saveBlocks();
      });
    });
  }

  var blocksDirtyTimer = null;
  function markBlocksDirty(){
    setStatus('עריכה…');
    clearTimeout(blocksDirtyTimer);
    blocksDirtyTimer = setTimeout(saveBlocks, 700);
  }

  function findBlock(pid, id){
    var list = blocks[pid] || [];
    for (var i=0;i<list.length;i++) if (list[i].id===id) return {list:list, i:i, b:list[i]};
    return null;
  }
  function deleteBlock(pid, id){
    var f = findBlock(pid, id); if(!f) return;
    f.list.splice(f.i, 1);
    saveBlocks();
    renderBlocks();
    injectInlineInserts(adminOn);   /* רענון בלוקים מעוגנים בין אלמנטים */
    setStatus('הבלוק נמחק', true);
  }
  function moveBlock(pid, id, dir){
    var f = findBlock(pid, id); if(!f) return;
    var j = dir==='up' ? f.i-1 : f.i+1;
    if (j<0 || j>=f.list.length) return;
    var tmp = f.list[j]; f.list[j]=f.list[f.i]; f.list[f.i]=tmp;
    saveBlocks(); renderBlocks();
  }

  /* הוספת בלוק — מיידי, גלוי בראש הפרק הנוכחי */
  function addBlockFlow(){
    var active = document.querySelector('.page.active');
    addBlock(active ? active.id : 'home');
  }
  function addBlock(pid, type, index){
    blocks[pid] = blocks[pid] || [];
    var nb = { id: uid(), type: type || 'text-image', html:'', img:'', caption:'' };
    if (typeof index === 'number' && index >= 0) blocks[pid].splice(index, 0, nb);
    else blocks[pid].unshift(nb);     /* ברירת מחדל — בראש */
    saveBlocks();
    renderBlocks();
    setTimeout(function(){
      var node = document.querySelector('[data-block-id="'+nb.id+'"]');
      if (node){
        node.scrollIntoView({behavior:'smooth', block:'center'});
        node.classList.add('cb-flash');
        setTimeout(function(){ node.classList.remove('cb-flash'); }, 1400);
      }
    }, 60);
    setStatus('בלוק נוסף — גררו ב"✥ הזז" למיקום הרצוי', true);
  }

  /* בורר סוג להוספה במיקום מסוים (מפריד ＋ בין אלמנטים) */
  function chooseTypeAt(pid, index){
    var TYPES = [
      {t:'text',i:'¶',l:'טקסט'},{t:'image',i:'🖼',l:'תמונה'},
      {t:'text-side',i:'⊟',l:'טקסט בצד'},{t:'text-below',i:'⊏',l:'טקסט למטה'},
      {t:'text-over',i:'▦',l:'טקסט על תמונה'},{t:'before-after',i:'⇄',l:'לפני/אחרי'},
      {t:'spacer',i:'↕',l:'מרווח ריק'}
    ];
    var btns = TYPES.map(function(o){
      return '<button class="ct-opt" data-t="'+o.t+'"><span>'+o.i+'</span>'+o.l+'</button>';
    }).join('');
    showModal('<h3>הוספת בלוק כאן</h3><p>בחרו את סוג התוכן להוספה במיקום זה.</p>' +
      '<div class="ct-grid">'+btns+'</div>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button></div>',
      function(box){
        box.querySelectorAll('.ct-opt').forEach(function(btn){
          btn.addEventListener('click', function(){
            hideModal();
            addBlock(pid, btn.dataset.t, index);
          });
        });
      });
  }

  /* ---------- מודאל גנרי ---------- */
  function showModal(html, onReady){
    var m = document.getElementById('admModal');
    m.innerHTML = '<div class="am-box">' + html + '</div>';
    m.classList.add('show');
    m.addEventListener('click', function(e){ if (e.target===m || e.target.hasAttribute('data-close')) hideModal(); });
    if (onReady) onReady(m.querySelector('.am-box'));
  }
  function hideModal(){ var m=document.getElementById('admModal'); if(m){ m.classList.remove('show'); m.innerHTML=''; } }

  /* ---------- עזרי DOM ---------- */
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; }
  function cssVar(v){ return getComputedStyle(document.documentElement).getPropertyValue(v); }
  function toHex(c){
    c = (c||'').trim();
    if (c[0]==='#'){ if(c.length===4) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c.slice(0,7); }
    var m = c.match(/(\d+)/g);
    if (m && m.length>=3){ return '#'+m.slice(0,3).map(function(n){var h=(+n).toString(16);return h.length<2?'0'+h:h;}).join(''); }
    return '#000000';
  }

  /* ---------- אתחול ---------- */
  /* ---------- תוכן מפורסם (content.json) ----------
     עריכות שפורסמו לכל המבקרים — נטען מהמאגר. עריכות מקומיות של
     העורך (localStorage) גוברות; מבקר רגיל מקבל את התוכן שפורסם.
     נכשל בשקט אם הקובץ לא קיים. */
  var bakedContent = null;
  function applyBaked(d){
    if (!d) return;
    bakedContent = d;
    var changed = false;
    if (!load(STORE_KEY)  && d.overrides){ overrides = d.overrides; changed = true; }
    if (!load(THEME_KEY)  && d.theme)    { theme     = d.theme;     changed = true; }
    if (!load(BLOCKS_KEY) && d.blocks)   { blocks    = d.blocks;    changed = true; }
    if (changed) applyOverrides();
  }
  function loadBakedContent(){
    /* קודם הענן (Supabase — תמיד הטרי ביותר), ואם אין — content.json מהמאגר */
    var fromFile = function(){
      fetch('assets/data/content.json?t=' + Date.now())
        .then(function(r){ if (!r.ok) throw 0; return r.json(); })
        .then(applyBaked)
        .catch(function(){});
    };
    if (window.PDDB){
      PDDB.load().then(function(d){ if (d) applyBaked(d); else fromFile(); })
                 .catch(fromFile);
    } else fromFile();
  }

  /* ---------- פרסום לענן — השינויים נראים לכל המבקרים מיד ---------- */
  var publishRetry = null;
  function publishToCloud(){
    if (!window.PDDB) return;
    var payload = { overrides: overrides, theme: theme, blocks: blocks, exportedAt: new Date().toISOString() };
    if (!PDDB.isAuthed()){ askCloudLogin(payload); return; }
    setStatus('מפרסם…');
    PDDB.save(payload)
      .then(function(){ bakedContent = payload; setStatus('פורסם לאתר ✓ — כל המבקרים רואים', true); })
      .catch(function(err){
        /* חיבור פג / נדחה — מבקשים התחברות מחדש */
        if (/401|403|session|sign/i.test(String(err))) { PDDB.signOut(); askCloudLogin(payload); }
        else setStatus('שגיאת פרסום: ' + err.message, false);
      });
  }
  function askCloudLogin(payload){
    showModal(
      '<h3>פרסום לאתר החי</h3>' +
      '<p>התחברות חד-פעמית בחשבון הניהול שלך (אותם פרטים כמו ב-marvah.co.il). החיבור נשמר בדפדפן.</p>' +
      '<div class="am-err" id="clErr"></div>' +
      '<input type="email" id="clEmail" placeholder="אימייל" autocomplete="username" />' +
      '<input type="password" id="clPass" placeholder="סיסמה" autocomplete="current-password" style="margin-top:8px" />' +
      '<div class="am-actions">' +
        '<button class="admin-btn" data-close>לא עכשיו</button>' +
        '<button class="admin-btn primary" id="clGo">התחבר ופרסם</button>' +
      '</div>',
      function(box){
        var em = box.querySelector('#clEmail'), pw = box.querySelector('#clPass');
        var go = function(){
          box.querySelector('#clErr').textContent = '';
          PDDB.signIn(em.value.trim(), pw.value)
            .then(function(){ hideModal(); publishToCloud(); })
            .catch(function(err){ box.querySelector('#clErr').textContent = err.message || 'התחברות נכשלה'; });
        };
        box.querySelector('#clGo').addEventListener('click', go);
        pw.addEventListener('keydown', function(e){ if (e.key==='Enter') go(); });
        em.focus();
      }
    );
  }

  function init(){
    applyOverrides();        /* תמיד — גם למבקר רגיל */
    loadBakedContent();      /* תוכן שפורסם — מוצג לכל מבקר בלי עריכות מקומיות */
    buildUI();
    initImgInput();

    /* קיצור מקלדת: Ctrl+Shift+E לפתיחת כניסה */
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key==='E'||e.key==='e')){ e.preventDefault(); adminOn?exitAdmin():requestLogin(); }
      if (e.key==='Escape'){ hideFmt(); }
    });

    /* כניסה אוטומטית אם ?admin=1 או אם כבר במהלך סשן */
    var qs = new URLSearchParams(location.search);
    if (qs.get('admin')==='1' || sessionStorage.getItem('pd_admin_session')==='1') requestLogin();

    /* שמירה לפני יציאה */
    window.addEventListener('beforeunload', function(){ if(dirty) save(STORE_KEY, overrides); });
    document.addEventListener('scroll', hideFmt, true);

    /* החלת כלי האדמין מחדש אחרי מעבר טאב/תת-טאב (תוכן חדש נחשף) */
    document.addEventListener('click', function(e){
      if (!adminOn) return;
      if (e.target.closest('.nav-link, .subtab, [data-goto]')){
        setTimeout(refreshAdminTools, 60);
      }
    }, true);

    /* בקרות תמונה: ללא מסגרת + ריכוך שוליים (האזנה מואצלת, פעם אחת) */
    function pdImgBlockRec(el){
      var blk = el.closest && el.closest('.custom-block'); if (!blk) return null;
      var id = blk.getAttribute('data-block-id');
      var host = blk.closest('[data-addzone]');
      var pid = host ? host.getAttribute('data-addzone') : (blk.closest('.page')||{}).id;
      var rec = findBlock(pid, id) || findBlock(anchoredKey(pid), id);
      return rec ? { blk: blk, b: rec.b } : null;
    }
    document.addEventListener('click', function(e){
      var fb = e.target.closest ? e.target.closest('[data-frameless]') : null;
      if (!fb || !adminOn) return;
      e.preventDefault(); e.stopPropagation();
      var r = pdImgBlockRec(fb); if (!r) return;
      r.b.frameless = !r.b.frameless;
      fb.classList.toggle('on', !!r.b.frameless);
      var fig = r.blk.querySelector('.cb-figure');
      if (fig) fig.classList.toggle('cb-frameless', !!r.b.frameless);
      saveBlocks();
    });
    document.addEventListener('input', function(e){
      var fr = e.target.closest ? e.target.closest('.cb-feather-range') : null;
      if (!fr || !adminOn) return;
      var r = pdImgBlockRec(fr); if (!r) return;
      var lvl = parseInt(fr.value, 10) || 0;
      r.b.feather = lvl;
      var fig = r.blk.querySelector('.cb-figure');
      if (fig){ for (var i = 1; i <= 5; i++) fig.classList.remove('cb-feather-' + i); if (lvl) fig.classList.add('cb-feather-' + lvl); }
      saveBlocks();
    });
    /* סיבוב תמונה על צירה */
    function pdSetRotate(r, deg){
      r.b.rotate = deg;
      var img = r.blk.querySelector('.cb-img');
      if (img) img.style.transform = deg ? 'rotate(' + deg + 'deg)' : '';
      var rng = r.blk.querySelector('.cb-rotate-range');
      if (rng && parseInt(rng.value,10) !== deg) rng.value = deg;
      saveBlocks();
    }
    document.addEventListener('input', function(e){
      var rr = e.target.closest ? e.target.closest('.cb-rotate-range') : null;
      if (!rr || !adminOn) return;
      var r = pdImgBlockRec(rr); if (!r) return;
      pdSetRotate(r, parseInt(rr.value, 10) || 0);
    });
    document.addEventListener('click', function(e){
      var rb = e.target.closest ? e.target.closest('[data-rotate90]') : null;
      if (!rb || !adminOn) return;
      e.preventDefault(); e.stopPropagation();
      var r = pdImgBlockRec(rb); if (!r) return;
      var d = (r.b.rotate || 0) + 90; if (d > 180) d -= 360;
      pdSetRotate(r, d);
    });
    /* שקיפות רקע הבוקסה (0–100%) */
    document.addEventListener('input', function(e){
      var br = e.target.closest ? e.target.closest('.cb-bgop-range') : null;
      if (!br || !adminOn) return;
      var r = pdImgBlockRec(br); if (!r) return;
      r.b.boxOpacity = parseInt(br.value, 10) || 0;
      applyBoxBg(r.blk, r.b);
      var v = r.blk.querySelector('.cb-bgop-val');
      if (v) v.textContent = r.b.boxOpacity + '%';
      saveBlocks();
    });
    /* לפני/אחרי: ביטול כותרת + העלמת מסגרת */
    document.addEventListener('click', function(e){
      var tb = e.target.closest ? e.target.closest('[data-ba-notitle], [data-ba-frameless]') : null;
      if (!tb || !adminOn) return;
      e.preventDefault(); e.stopPropagation();
      var r = pdImgBlockRec(tb); if (!r) return;
      if (tb.hasAttribute('data-ba-notitle')) r.b.noTitle = !r.b.noTitle;
      else r.b.frameless = !r.b.frameless;
      saveBlocks();
      refreshAdminTools();   /* רינדור מחדש — גם לבלוקים מעוגנים */
    });
  }

  /* מרענן ידיות הזזה, מפרידי ＋ ועריכת טקסט על התוכן הנראה כעת */
  function refreshAdminTools(){
    if (!adminOn) return;
    enableEditing(true);     /* מוסיף data-editable/handles לאלמנטים חדשים (קיימים מדלגים) */
    injectInlineInserts(true);
    renderBlocks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
