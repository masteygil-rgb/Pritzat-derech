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
      '<div class="ab-logo"><i>פד</i> מצב עריכה <b style="background:#1f87b0;color:#fff;border-radius:5px;padding:1px 7px;font-size:.72rem;margin-inline-start:6px">v30</b></div>' +
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
      if (act==='save'){ flush(); save(THEME_KEY, theme); save(BLOCKS_KEY, blocks); takeSnapshot(); setStatus('הכול נשמר ✓', true); }
      else if (act==='add') addBlockFlow();
      else if (act==='theme') toggleTheme();
      else if (act==='grid') toggleGrid(b);
      else if (act==='export') doExport();
      else if (act==='import') doImport();
      else if (act==='pass') changePass();
      else if (act==='reset') doReset();
      else if (act==='exit') exitAdmin();
    });

    /* סרגל עיצוב טקסט */
    var fmt = el('div', 'fmt-toolbar');
    fmt.id = 'fmtToolbar';
    fmt.innerHTML =
      '<select data-font title="גופן">' +
        '<option value="">גופן</option>' +
        '<option value="Heebo">Heebo</option>' +
        '<option value="Assistant">Assistant</option>' +
        '<option value="Arial">Arial</option>' +
        '<option value="Times New Roman">Times</option>' +
        '<option value="Georgia">Georgia</option>' +
        '<option value="Courier New">Courier</option>' +
      '</select>' +
      '<select data-size title="גודל גופן">' +
        '<option value="">גודל</option>' +
        '<option value="1">זעיר</option><option value="2">קטן</option>' +
        '<option value="3">רגיל</option><option value="4">בינוני</option>' +
        '<option value="5">גדול</option><option value="6">גדול מאוד</option><option value="7">ענק</option>' +
      '</select>' +
      '<span class="sep"></span>' +
      '<button data-cmd="bold" title="מודגש">B</button>' +
      '<button data-cmd="italic" title="נטוי" style="font-style:italic">I</button>' +
      '<button data-cmd="underline" title="קו תחתי" style="text-decoration:underline">U</button>' +
      '<input type="color" data-color title="צבע גופן" value="#16293a" />' +
      '<span class="sep"></span>' +
      '<button data-cmd="justifyRight" title="יישור לימין">⇥</button>' +
      '<button data-cmd="justifyCenter" title="מרכוז">≡</button>' +
      '<button data-cmd="justifyLeft" title="יישור לשמאל">⇤</button>' +
      '<button data-cmd="justifyFull" title="יישור דו-צדדי">☰</button>' +
      '<span class="sep"></span>' +
      '<button data-cmd="insertUnorderedList" title="רשימת נקודות">•≡</button>' +
      '<button data-cmd="insertOrderedList" title="רשימה ממוספרת">1.≡</button>' +
      '<span class="sep"></span>' +
      '<button data-cmd="removeFormat" title="נקה עיצוב">⌫</button>';
    document.body.appendChild(fmt);
    fmt.addEventListener('mousedown', function(e){ e.preventDefault(); }); /* שמירת הסימון */
    fmt.addEventListener('click', function(e){
      var b = e.target.closest('[data-cmd]'); if (!b) return;
      document.execCommand(b.dataset.cmd, false, null);
      markDirtyFromActive();
      refreshFmtState();
    });
    fmt.querySelector('[data-color]').addEventListener('input', function(e){
      document.execCommand('foreColor', false, e.target.value); markDirtyFromActive();
    });
    fmt.querySelector('[data-size]').addEventListener('change', function(e){
      if (e.target.value){ document.execCommand('fontSize', false, e.target.value); markDirtyFromActive(); }
    });
    fmt.querySelector('[data-font]').addEventListener('change', function(e){
      if (e.target.value){ document.execCommand('fontName', false, e.target.value); markDirtyFromActive(); }
    });
    /* הסרגל הוא שורה שנייה קבועה בתוך סרגל האדמין — תמיד גלוי במצב עריכה */
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
    takeSnapshot();          /* שומר את המצב המקורי לפני העריכה */
    document.body.classList.add('admin-on');
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
        h.addEventListener('dblclick', function(e){ e.preventDefault(); e.stopPropagation(); resetMove(el); });
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
      var h = el2('div', 'cb-rz cb-rz-' + d);
      h.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation();
        var sx = e.clientX, sy = e.clientY;
        var r = el.getBoundingClientRect();
        var startW = r.width, startH = r.height;
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
        function up(){
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
          if (el._sz){
            var k = keyOf(el);
            overrides[k] = overrides[k] || {};
            overrides[k].size = el._sz;
            flush();
          }
        }
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
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

  function curMove(el){
    var o = overrides[keyOf(el)];
    return (o && o.move) ? { dx:o.move.dx, dy:o.move.dy } : { dx:0, dy:0 };
  }
  function startMove(e, el, handle){
    e.preventDefault(); e.stopPropagation();
    var start = curMove(el);
    var sx = e.clientX, sy = e.clientY;
    el.classList.add('pd-moving');
    function move(ev){
      var dx = start.dx + (ev.clientX - sx);
      var dy = start.dy + (ev.clientY - sy);
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      el._mv = { dx:dx, dy:dy };
    }
    function up(){
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('pd-moving');
      if (el._mv){
        var k = keyOf(el);
        overrides[k] = overrides[k] || {};
        overrides[k].move = el._mv;
        el.classList.add('pd-moved');
        flush();
      }
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
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
  function onSelect(e){
    /* הסרגל קבוע למעלה — רק עוקבים אחרי האלמנט הפעיל ומעדכנים מצב כפתורים */
    activeEditable = e.currentTarget;
    refreshFmtState();
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
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        var data = reader.result;
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
        /* תמונה בתוך בלוק מותאם */
        if (blockImgTarget){
          var rec = findBlock(blockImgTarget.pid, blockImgTarget.id);
          if (rec){
            var field = blockImgTarget.field || 'img';
            rec.b[field] = data;
            blockImgTarget.el.src = data;
            saveBlocks(); setStatus('התמונה הוחלפה', true);
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
    var T = '<div class="cb-text">'+textHTML+'</div>';
    var inner = '';

    if (b.type === 'spacer'){
      var sh = b.h ? b.h : 60;
      inner = '<div class="cb-spacer" style="height:'+sh+'px"><span class="cb-spacer-lbl">מרווח · '+sh+'px</span></div>';
    } else if (b.type === 'text'){
      inner = T;
    } else if (b.type === 'image'){
      inner = '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' />' +
              '<figcaption class="cb-cap">'+(b.caption||'כיתוב תמונה')+'</figcaption></figure>';
    } else if (b.type === 'text-side'){
      /* טקסט בצד התמונה */
      inner = '<div class="cb-split"><div class="cb-col">'+T+'</div>' +
              '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure></div>';
    } else if (b.type === 'text-below'){
      /* תמונה למעלה, טקסט מתחת (ממורכז) */
      inner = '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure>' +
              '<div class="cb-text cb-center">'+textHTML+'</div>';
    } else if (b.type === 'text-over'){
      /* טקסט מעל התמונה */
      inner = '<div class="cb-over">' +
                '<img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' />' +
                '<div class="cb-over-text"><div class="cb-text">'+textHTML+'</div></div>' +
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
      inner = '<div class="cb-text cb-center cb-ba-title">'+titleHTML+'</div>' +
        '<div class="cb-ba" style="height:'+hPx+'px">' +
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
        function up(){
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
          saveBlocks();
        }
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
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
      var pr = page.getBoundingClientRect();
      var wr = wrap.getBoundingClientRect();
      var offX = e.clientX - wr.left;
      var offY = e.clientY - wr.top;

      function move(ev){
        var x = ev.clientX - pr.left - offX;
        var y = ev.clientY - pr.top  - offY;
        /* גבולות */
        x = Math.max(0, Math.min(x, pr.width  - wr.width));
        y = Math.max(0, Math.min(y, pr.height - wr.height));
        b.x = (x / pr.width)  * 100;
        b.y = (y / pr.height) * 100;
        wrap.style.left = b.x + '%';
        wrap.style.right = 'auto';
        wrap.style.top = b.y + '%';
      }
      function up(){
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        wrap.classList.remove('cb-dragging');
        saveBlocks();
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
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
  function init(){
    applyOverrides();        /* תמיד — גם למבקר רגיל */
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
